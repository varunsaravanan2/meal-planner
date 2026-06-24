'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  getWeeklyPlan, addMealPlan, deleteMealPlan, getRecipes, isLoggedIn, getWeeklyWorkouts,
  getSubscriptionStatus, listPlanSnapshots, restorePlanSnapshot,
  saveWorkout, deleteWorkoutEntry, getWorkoutTemplates,
  type SubscriptionStatus, type PlanSnapshot, type ExerciseEntry, type WorkoutTemplate,
} from '@/lib/api';
import type { MealPlanEntry, Recipe, WorkoutPlan, NutritionInfo } from '@/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// ── constants ──────────────────────────────────────────────────────────────────

const SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
const BLUE   = '#3b82f6';
const CARD   = 'var(--bg-card)';
const BORDER = 'var(--border-color)';
const TEXT   = 'var(--text-primary)';
const MUTED  = 'var(--text-tertiary)';
const DIM    = 'var(--text-placeholder)';

const SLOT_META: Record<string, { label: string }> = {
  breakfast: { label: 'Breakfast' },
  lunch:     { label: 'Lunch'     },
  dinner:    { label: 'Dinner'    },
  snack:     { label: 'Snack'     },
};
const WORKOUT_TYPES = ['strength','cardio','hiit','yoga','running','cycling','other'];

// ── date helpers ───────────────────────────────────────────────────────────────

function isoWeekMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
}
function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function formatDay(s: string) {
  const d = new Date(s + 'T00:00:00');
  return { weekday: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(), date: d.getDate() };
}
function formatTs(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
function timeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'GOOD MORNING';
  if (h < 17) return 'GOOD AFTERNOON';
  return 'GOOD EVENING';
}
function todayLabel() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

// ── animated ring ──────────────────────────────────────────────────────────────

function Ring({ pct, color, size = 68, track = 'var(--bg-soft)' }: {
  pct: number; color: string; size?: number; track?: string;
}) {
  const [cur, setCur] = useState(0);
  useEffect(() => { const t = setTimeout(() => setCur(pct), 150); return () => clearTimeout(t); }, [pct]);
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * Math.min(cur, 1);
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={track} strokeWidth={6} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={6}
        strokeLinecap="round" strokeDasharray={`${dash} ${circ - dash}`}
        style={{ transition: 'stroke-dasharray 1.4s cubic-bezier(0.4,0,0.2,1)' }} />
    </svg>
  );
}

// ── count-up ───────────────────────────────────────────────────────────────────

function CountUp({ to, decimals = 0 }: { to: number; decimals?: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (to === 0) { setN(0); return; }
    let frame = 0; const total = 70;
    const timer = setInterval(() => {
      frame++;
      setN(Math.round(((to / total) * frame) * Math.pow(10, decimals)) / Math.pow(10, decimals));
      if (frame >= total) { setN(to); clearInterval(timer); }
    }, 1200 / total);
    return () => clearInterval(timer);
  }, [to, decimals]);
  return <>{decimals > 0 ? n.toFixed(decimals) : Math.round(n).toLocaleString()}</>;
}

// ── stat card ──────────────────────────────────────────────────────────────────

function StatCard({ label, value, max, color, unit = '', icon, delay = 0 }: {
  label: string; value: number; max: number; color: string; unit?: string; icon: React.ReactNode; delay?: number;
}) {
  const pct = max > 0 ? value / max : 0;
  return (
    <div style={{
      background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16,
      padding: '20px 22px 16px', flex: 1,
      animation: `dashFadeUp 0.55s ease ${delay}ms both`,
    }}>
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: MUTED, textTransform: 'uppercase', marginBottom: 14 }}>{label}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <Ring pct={pct} color={color} size={68} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
        </div>
        <div>
          <p style={{ fontSize: 32, fontWeight: 800, color: TEXT, letterSpacing: '-1px', lineHeight: 1 }}>
            <CountUp to={value} />{unit}
          </p>
          <p style={{ fontSize: 13, color: DIM, marginTop: 5 }}>of {max.toLocaleString()}{unit}</p>
        </div>
      </div>
      <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, height: 3, borderRadius: 2, background: 'var(--bg-soft)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.min(pct * 100, 100)}%`, background: color, borderRadius: 2, transition: 'width 1.4s cubic-bezier(0.4,0,0.2,1)' }} />
        </div>
        <span style={{ fontSize: 12, color: DIM, flexShrink: 0 }}>{Math.round(pct * 100)}%</span>
      </div>
    </div>
  );
}

// ── nutrition label ────────────────────────────────────────────────────────────

function NutritionLabel({ n }: { n: NutritionInfo }) {
  const cal = n.calories != null ? Math.round(n.calories / 10) * 10 : null;
  const rows: [string, number | null, string][] = [
    ['Total Fat', n.fat_g, 'g'], ['  Saturated Fat', n.saturated_fat_g, 'g'],
    ['Cholesterol', n.cholesterol_mg, 'mg'], ['Sodium', n.sodium_mg, 'mg'],
    ['Total Carbohydrate', n.carbs_g, 'g'], ['  Dietary Fiber', n.fiber_g, 'g'],
    ['  Total Sugars', n.sugar_g, 'g'], ['Protein', n.protein_g, 'g'],
  ];
  return (
    <div style={{ border: `2px solid ${BORDER}`, borderRadius: 12, padding: '14px 16px' }}>
      <p style={{ fontWeight: 900, fontSize: 21, color: TEXT, borderBottom: `8px solid ${BORDER}`, paddingBottom: 4, marginBottom: 4 }}>Nutrition Facts</p>
      <p style={{ fontSize: 13, color: MUTED, borderBottom: `1px solid ${BORDER}`, paddingBottom: 4, marginBottom: 4 }}>Per serving</p>
      {cal != null && (
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', borderBottom: `4px solid ${BORDER}`, paddingBottom: 4, marginBottom: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>Calories</span>
          <span style={{ fontWeight: 900, fontSize: 34, color: TEXT }}>{cal}</span>
        </div>
      )}
      {rows.map(([label, val, unit]) => val != null && (
        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: `1px solid ${BORDER}`, paddingBottom: 3, marginBottom: 2 }}>
          <span style={{ color: TEXT, paddingLeft: label.startsWith('  ') ? 12 : 0, fontWeight: label.startsWith('  ') ? 400 : 600 }}>{label.trim()}</span>
          <span style={{ color: TEXT }}><strong>{Math.round(val * 10) / 10}</strong>{unit}</span>
        </div>
      ))}
    </div>
  );
}

// ── workout modal ──────────────────────────────────────────────────────────────

interface WorkoutFormState {
  planned_date: string; is_rest_day: boolean; workout_type: string;
  title: string; duration_minutes: string; notes: string; exercises: ExerciseEntry[];
}

function WorkoutModal({ date, existing, onClose, onSaved }: {
  date: string; existing: WorkoutPlan | null; onClose: () => void; onSaved: () => void;
}) {
  const [tab, setTab] = useState<'custom' | 'templates'>('custom');
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [form, setForm] = useState<WorkoutFormState>({
    planned_date: date, is_rest_day: existing?.is_rest_day ?? false,
    workout_type: existing?.workout_type ?? '', title: existing?.title ?? '',
    duration_minutes: existing?.duration_minutes ? String(existing.duration_minutes) : '',
    notes: existing?.notes ?? '', exercises: (existing?.exercises as unknown as ExerciseEntry[]) ?? [],
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (tab === 'templates' && templates.length === 0) {
      setTemplatesLoading(true);
      getWorkoutTemplates().then(setTemplates).catch(() => {}).finally(() => setTemplatesLoading(false));
    }
  }, [tab]);

  function applyTemplate(t: WorkoutTemplate) {
    setForm(f => ({ ...f, is_rest_day: false, title: t.title, workout_type: t.workout_type ?? '', duration_minutes: t.duration_minutes ? String(t.duration_minutes) : '', exercises: (t.exercises as unknown as ExerciseEntry[]) ?? [] }));
    setTab('custom');
  }

  function setField<K extends keyof WorkoutFormState>(k: K, v: WorkoutFormState[K]) { setForm(f => ({ ...f, [k]: v })); }
  function addExercise() { setForm(f => ({ ...f, exercises: [...f.exercises, { name: '', sets: undefined, reps: '', notes: '' }] })); }
  function setEx(i: number, k: keyof ExerciseEntry, v: string) {
    setForm(f => { const e = [...f.exercises]; e[i] = { ...e[i], [k]: k === 'sets' ? (v ? parseInt(v, 10) : undefined) : v }; return { ...f, exercises: e }; });
  }
  function removeEx(i: number) { setForm(f => ({ ...f, exercises: f.exercises.filter((_, j) => j !== i) })); }

  async function handleSave() {
    if (!form.is_rest_day && !form.title.trim()) { setErr('Title is required.'); return; }
    setSaving(true); setErr('');
    try {
      await saveWorkout({ planned_date: form.planned_date, is_rest_day: form.is_rest_day, workout_type: form.workout_type || undefined, title: form.title.trim() || undefined, duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes, 10) : undefined, notes: form.notes.trim() || undefined, exercises: form.exercises.filter(e => e.name.trim()) });
      onSaved();
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Save failed.'); } finally { setSaving(false); }
  }
  async function handleDelete() {
    if (!existing?.id) return;
    setSaving(true);
    try { await deleteWorkoutEntry(existing.id); onSaved(); }
    catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Delete failed.'); setSaving(false); }
  }

  const inp: React.CSSProperties = { height: 48, padding: '0 14px', border: `1px solid ${BORDER}`, borderRadius: 10, color: TEXT, background: 'var(--bg-soft)', width: '100%', fontSize: 14, outline: 'none' };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-lg flex flex-col" style={{ background: CARD, borderRadius: 20, maxHeight: '90vh', border: `1px solid ${BORDER}`, animation: 'modalIn 0.25s ease' }}>
        <div style={{ height: 3, borderRadius: '20px 20px 0 0', background: BLUE }} />
        <div style={{ padding: '18px 22px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontWeight: 700, fontSize: 15, color: TEXT }}>
            {existing ? 'Edit workout' : 'Log workout'} — {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </h3>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${BORDER}`, background: 'var(--bg-soft)', color: MUTED, fontSize: 14, cursor: 'pointer' }}>✕</button>
        </div>
        {!existing && (
          <div style={{ display: 'flex', gap: 8, padding: '14px 22px 0' }}>
            {(['custom', 'templates'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{ flex: 1, height: 36, borderRadius: 8, border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer', background: tab === t ? BLUE : 'var(--bg-soft)', color: tab === t ? '#fff' : MUTED }}>
                {t === 'custom' ? 'Custom' : 'Templates'}
              </button>
            ))}
          </div>
        )}
        {tab === 'templates' ? (
          <div style={{ overflowY: 'auto', padding: '14px 22px', maxHeight: '60vh' }}>
            {templatesLoading ? <p style={{ color: MUTED, fontSize: 14 }}>Loading…</p>
            : templates.length === 0 ? <p style={{ color: MUTED, fontSize: 14 }}>No templates yet. Create some in the Workouts tab.</p>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {templates.map(t => (
                  <button key={t.id} onClick={() => applyTemplate(t)} style={{ textAlign: 'left', background: 'var(--bg-soft)', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '12px 16px', cursor: 'pointer' }}>
                    <p style={{ fontWeight: 600, fontSize: 14, color: TEXT }}>{t.title}</p>
                    <p style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{t.workout_type}{t.duration_minutes ? ` · ${t.duration_minutes} min` : ''}</p>
                  </button>
                ))}
              </div>}
          </div>
        ) : (
          <div style={{ overflowY: 'auto', padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {err && <p style={{ color: '#f87171', fontSize: 13 }}>{err}</p>}
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.is_rest_day} onChange={e => setField('is_rest_day', e.target.checked)} />
              <span style={{ fontSize: 14, color: TEXT }}>Rest day</span>
            </label>
            {!form.is_rest_day && (<>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: MUTED, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Title *</label>
                <input value={form.title} onChange={e => setField('title', e.target.value)} placeholder="e.g. Upper body push" style={inp} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: MUTED, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Type</label>
                  <Select value={form.workout_type || undefined} onValueChange={v => setField('workout_type', v)}>
                    <SelectTrigger size="lg" className="w-full"><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>
                      {WORKOUT_TYPES.map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: MUTED, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Duration (min)</label>
                  <input type="number" value={form.duration_minutes} onChange={e => setField('duration_minutes', e.target.value)} placeholder="45" style={inp} />
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Exercises</label>
                  <button onClick={addExercise} style={{ fontSize: 12, fontWeight: 700, color: BLUE, background: 'none', border: 'none', cursor: 'pointer' }}>+ Add</button>
                </div>
                {form.exercises.map((ex, i) => (
                  <div key={i} style={{ background: 'var(--bg-soft)', borderRadius: 10, padding: '10px 12px', marginBottom: 8, border: `1px solid ${BORDER}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <input value={ex.name} onChange={e => setEx(i, 'name', e.target.value)} placeholder="Exercise name" style={{ flex: 1, fontSize: 13, background: 'transparent', border: 'none', outline: 'none', color: TEXT, borderBottom: `1px solid ${BORDER}`, paddingBottom: 2 }} />
                      <button onClick={() => removeEx(i)} style={{ fontSize: 12, color: MUTED, background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <input type="number" value={ex.sets ?? ''} onChange={e => setEx(i, 'sets', e.target.value)} placeholder="Sets" style={{ ...inp, height: 36 }} />
                      <input value={(ex.reps as string) ?? ''} onChange={e => setEx(i, 'reps', e.target.value)} placeholder="Reps" style={{ ...inp, height: 36 }} />
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: MUTED, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Notes</label>
                <textarea value={form.notes} onChange={e => setField('notes', e.target.value)} placeholder="Any notes…" rows={2} style={{ width: '100%', padding: '10px 14px', border: `1px solid ${BORDER}`, borderRadius: 10, color: TEXT, background: 'var(--bg-soft)', fontSize: 14, resize: 'none', outline: 'none' }} />
              </div>
            </>)}
          </div>
        )}
        <div style={{ padding: '14px 22px', borderTop: `1px solid ${BORDER}`, display: 'flex', gap: 10 }}>
          {existing && <button onClick={handleDelete} disabled={saving} style={{ height: 44, padding: '0 16px', borderRadius: 10, border: '1px solid rgba(248,113,113,0.4)', color: '#f87171', background: 'transparent', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Delete</button>}
          <button onClick={onClose} style={{ flex: 1, height: 44, borderRadius: 10, border: `1px solid ${BORDER}`, color: MUTED, background: 'transparent', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          {tab === 'custom' && (
            <button onClick={handleSave} disabled={saving} style={{ flex: 1, height: 44, borderRadius: 10, background: BLUE, color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.5 : 1 }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── restore modal ──────────────────────────────────────────────────────────────

function RestoreModal({ weekStart, onClose, onRestored }: { weekStart: string; onClose: () => void; onRestored: () => void }) {
  const [snaps, setSnaps] = useState<PlanSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    listPlanSnapshots(weekStart).then(setSnaps).catch(() => setErr('Could not load snapshots.')).finally(() => setLoading(false));
  }, [weekStart]);

  async function handleRestore(id: string) {
    setRestoring(id); setErr('');
    try { const r = await restorePlanSnapshot(id); alert(`Restored ${r.meals_restored} meals.`); onRestored(); }
    catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Restore failed.'); setRestoring(null); }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
      <div style={{ background: CARD, borderRadius: 20, border: `1px solid ${BORDER}`, width: '100%', maxWidth: 380, animation: 'modalIn 0.25s ease' }}>
        <div style={{ padding: '18px 22px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontWeight: 700, fontSize: 15, color: TEXT }}>Previous plans</h3>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${BORDER}`, background: 'var(--bg-soft)', color: MUTED, fontSize: 14, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ padding: '14px 22px', minHeight: 80 }}>
          {err && <p style={{ color: '#f87171', fontSize: 13 }}>{err}</p>}
          {loading && <p style={{ color: MUTED, fontSize: 14 }}>Loading…</p>}
          {!loading && snaps.length === 0 && <p style={{ color: MUTED, fontSize: 14 }}>No snapshots yet.</p>}
          {snaps.map((s, i) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--bg-soft)', borderRadius: 10, border: `1px solid ${BORDER}`, marginBottom: 8 }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>Snapshot {i + 1}</p>
                <p style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{formatTs(s.created_at)}</p>
              </div>
              <button onClick={() => handleRestore(s.id)} disabled={restoring !== null} style={{ fontSize: 12, fontWeight: 700, padding: '6px 14px', borderRadius: 8, background: BLUE, color: '#fff', border: 'none', cursor: 'pointer', opacity: restoring !== null ? 0.5 : 1 }}>
                {restoring === s.id ? '…' : 'Restore'}
              </button>
            </div>
          ))}
        </div>
        <div style={{ padding: '0 22px 18px' }}>
          <button onClick={onClose} style={{ width: '100%', height: 44, borderRadius: 10, border: `1px solid ${BORDER}`, color: MUTED, background: 'transparent', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── main dashboard ─────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [monday, setMonday] = useState<Date>(() => isoWeekMonday(new Date()));
  const [plan, setPlan] = useState<Record<string, MealPlanEntry[]>>({});
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [workouts, setWorkouts] = useState<Record<string, WorkoutPlan>>({});
  const [subStatus, setSubStatus] = useState<SubscriptionStatus | null>(null);

  const [selectedMeal, setSelectedMeal] = useState<MealPlanEntry | null>(null);
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutPlan | null>(null);
  const [workoutDate, setWorkoutDate] = useState<string | null>(null);
  const [showRestore, setShowRestore] = useState(false);
  const [adding, setAdding] = useState<{ date: string; slot: string } | null>(null);
  const [selectedRecipeId, setSelectedRecipeId] = useState('');
  const [saving, setSaving] = useState(false);
  const [addError, setAddError] = useState('');
  const [completedIds, setCompletedIds] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set<string>();
    try { return new Set<string>(JSON.parse(localStorage.getItem('meal_completions') || '[]')); }
    catch { return new Set<string>(); }
  });
  const [workoutCompletions, setWorkoutCompletions] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return {};
    try { return JSON.parse(localStorage.getItem('workout_completions') || '{}'); }
    catch { return {}; }
  });

  const weekDays = Array.from({ length: 7 }, (_, i) => toIso(addDays(monday, i)));
  const today = toIso(new Date());
  const monthLabel = new Date(weekDays[0] + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const fetchPlan = useCallback(async () => {
    setLoading(true);
    try { setPlan((await getWeeklyPlan(toIso(monday)))?.days || {}); }
    catch { if (!isLoggedIn()) router.push('/login'); }
    finally { setLoading(false); }
  }, [monday, router]);

  const fetchWorkouts = useCallback(async () => {
    if (isLoggedIn()) getWeeklyWorkouts(toIso(monday)).then(d => setWorkouts(d?.workouts || {})).catch(() => {});
  }, [monday]);

  useEffect(() => { if (!isLoggedIn()) { router.push('/login'); return; } fetchPlan(); }, [fetchPlan, router]);
  useEffect(() => { if (isLoggedIn()) getRecipes({ page_size: 100 }).then(d => setRecipes(d?.recipes || [])).catch(() => {}); }, []);
  useEffect(() => { fetchWorkouts(); }, [fetchWorkouts]);
  useEffect(() => { if (isLoggedIn()) getSubscriptionStatus().then(setSubStatus).catch(() => {}); }, []);

  const todayEntries  = plan[today] || [];
  const completedTodayEntries = todayEntries.filter(e => completedIds.has(e.id));
  const todayCal      = Math.round(completedTodayEntries.reduce((s, e) => s + (e.recipe?.nutrition?.calories ?? 0), 0));
  const todayProt     = Math.round(completedTodayEntries.reduce((s, e) => s + (e.recipe?.nutrition?.protein_g ?? 0), 0));
  const todayMeals    = completedTodayEntries.length;
  const weekWorkouts  = weekDays.filter(d => workouts[d] && !workouts[d].is_rest_day).length;
  const totalMealsWeek = Object.values(plan).flat().length;
  const upgraded = searchParams?.get('upgraded') === '1';

  async function handleAdd() {
    if (!selectedRecipeId || !adding) return;
    setSaving(true); setAddError('');
    try { await addMealPlan({ recipe_id: selectedRecipeId, planned_date: adding.date, meal_slot: adding.slot }); setAdding(null); setSelectedRecipeId(''); fetchPlan(); }
    catch (e) { setAddError((e as Error).message); }
    finally { setSaving(false); }
  }

  function toggleComplete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setCompletedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try { localStorage.setItem('meal_completions', JSON.stringify([...next])); } catch {}
      return next;
    });
  }

  function toggleWorkoutCompletion(date: string, e: React.MouseEvent) {
    e.stopPropagation();
    setWorkoutCompletions(prev => {
      const next = { ...prev, [date]: !prev[date] };
      try { localStorage.setItem('workout_completions', JSON.stringify(next)); } catch {}
      return next;
    });
  }

  async function handleDeleteMeal(id: string) {
    setPlan(prev => { const next: Record<string, MealPlanEntry[]> = {}; for (const [d, es] of Object.entries(prev)) next[d] = es.filter(e => e.id !== id); return next; });
    try { await deleteMealPlan(id); } catch { fetchPlan(); }
  }

  return (
    <>
      <style>{`
        @keyframes dashFadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        @keyframes modalIn    { from { opacity:0; transform:scale(0.96) translateY(8px); } to { opacity:1; transform:scale(1) translateY(0); } }
        .add-row { opacity: 0; transition: opacity 0.15s; }
        .slot-cell:hover .add-row { opacity: 1; }
        .del-btn { pointer-events: none; }
        .meal-entry:hover .del-btn { opacity: 1 !important; pointer-events: auto; }
      `}</style>

      <div style={{ minHeight: '100%', padding: '28px 28px 60px' }}>

        {upgraded && (
          <div style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 12, padding: '12px 18px', marginBottom: 20, color: '#4ade80', fontSize: 14, fontWeight: 600 }}>
            ✓ Plan upgraded successfully — enjoy your AI generations!
          </div>
        )}

        {/* ── Greeting header ── */}
        <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ animation: 'dashFadeUp 0.4s ease' }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: MUTED, textTransform: 'uppercase', marginBottom: 6 }}>{timeGreeting()}</p>
            <h1 style={{ fontSize: 36, fontWeight: 800, color: TEXT, letterSpacing: '-0.8px', lineHeight: 1.1, marginBottom: 12 }}>{todayLabel()}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 14, color: MUTED }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: BLUE, flexShrink: 0 }} />
                {totalMealsWeek} meals this week
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 14, color: MUTED }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: MUTED, flexShrink: 0 }} />
                {weekWorkouts} active day{weekWorkouts !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0, animation: 'dashFadeUp 0.4s ease' }}>
            {subStatus && (
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Current Streak</p>
                <p style={{ fontSize: 32, fontWeight: 800, color: TEXT, lineHeight: 1 }}>
                  {weekWorkouts} <span style={{ fontSize: 16, fontWeight: 500, color: MUTED }}>day{weekWorkouts !== 1 ? 's' : ''}</span>
                </p>
              </div>
            )}
            <a href="/pricing" style={{ display: 'inline-flex', alignItems: 'center', height: 38, padding: '0 18px', borderRadius: 10, border: `1.5px solid ${BLUE}`, color: BLUE, fontSize: 13, fontWeight: 700, textDecoration: 'none', letterSpacing: '0.02em', flexShrink: 0 }}>
              Upgrade
            </a>
          </div>
        </div>

        {/* ── Stat cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 28 }}>
          <StatCard label="Today's Calories" value={todayCal}    max={2000} color={BLUE}    unit=" cal" delay={0}
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={BLUE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>} />
          <StatCard label="Today's Protein"  value={todayProt}   max={150}  color="#a78bfa" unit="g"    delay={60}
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>} />
          <StatCard label="Meals Today"      value={todayMeals}  max={4}    color="#34d399" unit=""     delay={120}
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/></svg>} />
          <StatCard label="Active Days"      value={weekWorkouts} max={7}   color="#fb923c" unit=""     delay={180}
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fb923c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>} />
        </div>

        {/* ── Week nav header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: TEXT, letterSpacing: '-0.4px' }}>Weekly Plan</h2>
            <p style={{ fontSize: 13, color: MUTED, marginTop: 3 }}>{monthLabel}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => setShowRestore(true)} style={{ height: 38, padding: '0 14px', borderRadius: 9, border: `1px solid ${BORDER}`, background: 'transparent', color: MUTED, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg>
              Restore
            </button>
            <button onClick={() => setMonday(d => addDays(d, -7))} style={{ width: 38, height: 38, borderRadius: 9, border: `1px solid ${BORDER}`, background: 'transparent', color: TEXT, fontSize: 16, cursor: 'pointer' }}>←</button>
            <button onClick={() => setMonday(isoWeekMonday(new Date()))} style={{ height: 38, padding: '0 14px', borderRadius: 9, border: `1px solid ${BORDER}`, background: 'transparent', color: TEXT, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Today</button>
            <button onClick={() => setMonday(d => addDays(d, 7))} style={{ width: 38, height: 38, borderRadius: 9, border: `1px solid ${BORDER}`, background: 'transparent', color: TEXT, fontSize: 16, cursor: 'pointer' }}>→</button>
          </div>
        </div>

        {/* ── Weekly grid ── */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 10 }}>
            {weekDays.map(d => <div key={d} style={{ background: CARD, borderRadius: 14, height: 420, opacity: 0.5 }} />)}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 10 }}>
            {weekDays.map((day, di) => {
              const { weekday, date } = formatDay(day);
              const isToday = day === today;
              const w = workouts[day];
              const dayEntries = plan[day] || [];

              return (
                <div key={day} style={{
                  background: CARD, borderRadius: 14, overflow: 'hidden',
                  border: isToday ? `1px solid rgba(59,130,246,0.4)` : `1px solid ${BORDER}`,
                  animation: `dashFadeUp 0.45s ease ${di * 40}ms both`,
                  display: 'flex', flexDirection: 'column',
                }}>
                  {/* Day header */}
                  <div style={{ padding: '12px 10px 10px', borderBottom: `1px solid ${BORDER}`, textAlign: 'center', background: isToday ? 'rgba(59,130,246,0.06)' : 'transparent' }}>
                    <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: isToday ? BLUE : MUTED, marginBottom: 6 }}>{weekday}</p>
                    <div style={{ width: 30, height: 30, borderRadius: '50%', margin: '0 auto', background: isToday ? BLUE : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: isToday ? '#fff' : TEXT }}>{date}</span>
                    </div>
                  </div>

                  {/* Workout slot */}
                  {(() => {
                    const wDone = !!workoutCompletions[day];
                    return (
                      <div className="slot-cell" style={{ padding: '9px 10px', borderBottom: `1px solid ${BORDER}`, minHeight: 62, position: 'relative' }}>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}>
                          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', color: wDone ? '#22c55e' : BLUE, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={wDone ? '#22c55e' : BLUE} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.4 14.4 9.6 9.6"/><path d="M18 3v4"/><path d="M6 3v4"/><path d="M3 6h4"/><path d="M17 20h4"/><path d="M3 18h4"/><path d="M6 21v-4"/><path d="M18 21v-4"/><path d="M20.4 9.6l-7.7 7.7a2 2 0 0 1-2.8 0L5.5 12.9a2 2 0 0 1 0-2.8l7.7-7.7a2 2 0 0 1 2.8 0l4.4 4.4a2 2 0 0 1 0 2.8z"/></svg>
                            Workout
                          </span>
                        </div>
                        {w ? (
                          w.is_rest_day ? (
                            <p style={{ fontSize: 11, color: MUTED, fontStyle: 'italic' }}>Rest day</p>
                          ) : (
                            <div className="meal-entry" style={{
                              position: 'relative', background: wDone ? 'rgba(34,197,94,0.04)' : 'rgba(59,130,246,0.04)',
                              border: `1px solid ${BORDER}`, borderLeft: `2.5px solid ${wDone ? '#22c55e' : 'rgba(59,130,246,0.5)'}`,
                              borderRadius: 7, padding: '5px 7px 5px 8px',
                              cursor: 'pointer', transition: 'opacity 0.2s',
                            }} onClick={() => setSelectedWorkout(w)}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                                <p style={{ fontSize: 11, fontWeight: 600, color: wDone ? MUTED : TEXT, lineHeight: 1.3, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.title}</p>
                                <button onClick={e => toggleWorkoutCompletion(day, e)}
                                  style={{ width: 15, height: 15, borderRadius: '50%', border: `1.5px solid ${wDone ? '#22c55e' : 'rgba(59,130,246,0.6)'}`, background: wDone ? '#22c55e' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer', padding: 0 }}>
                                  {wDone && <svg width="7" height="7" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1.5,6 4.5,9.5 10.5,2.5"/></svg>}
                                </button>
                              </div>
                              {wDone && w.duration_minutes && (
                                <p style={{ fontSize: 10, color: DIM, marginTop: 1 }}>{w.duration_minutes} min</p>
                              )}
                              <button onClick={e => { e.stopPropagation(); deleteWorkoutEntry(w.id).then(() => fetchWorkouts()).catch(() => {}); }}
                                className="del-btn"
                                style={{ position: 'absolute', top: -4, left: -4, width: 14, height: 14, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-soft)', border: `1px solid ${BORDER}`, cursor: 'pointer', opacity: 0, transition: 'opacity 0.15s' }}>
                                <svg width="6" height="6" viewBox="0 0 12 12" fill="none" stroke={MUTED} strokeWidth="2.5" strokeLinecap="round"><line x1="1" y1="1" x2="11" y2="11"/><line x1="11" y1="1" x2="1" y2="11"/></svg>
                              </button>
                            </div>
                          )
                        ) : (
                          <button className="add-row" onClick={() => setWorkoutDate(day)} style={{ width: '100%', textAlign: 'left', fontSize: 11, color: MUTED, background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontSize: 13 }}>+</span> Add workout
                          </button>
                        )}
                      </div>
                    );
                  })()}

                  {/* Meal slots */}
                  {SLOTS.map((slot) => {
                    const entries = dayEntries.filter(e => e.meal_slot === slot);
                    const meta = SLOT_META[slot];
                    const slotFull = slot !== 'snack' && entries.length >= 1;
                    return (
                      <div key={slot} className="slot-cell" style={{ padding: '9px 10px', borderBottom: slot !== 'snack' ? `1px solid ${BORDER}` : 'none', minHeight: 62, position: 'relative' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', color: BLUE, textTransform: 'uppercase' }}>
                            {meta.label}
                          </span>
                          <span style={{ fontSize: 10, color: DIM, fontWeight: 600 }}>
                            {slot === 'snack' ? (entries.length > 0 ? entries.length : '') : `${entries.length}/1`}
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {entries.map(entry => {
                            const done = completedIds.has(entry.id);
                            const isPast = day < today;
                            const missed = isPast && !done;
                            const leftBar = done ? '#22c55e' : missed ? 'rgba(248,113,113,0.45)' : 'rgba(59,130,246,0.5)';
                            const cardBg  = done ? 'rgba(34,197,94,0.04)' : missed ? 'rgba(248,113,113,0.03)' : 'rgba(59,130,246,0.04)';
                            const dotC    = done ? '#22c55e' : missed ? 'rgba(248,113,113,0.6)' : 'rgba(59,130,246,0.6)';
                            return (
                              <div key={entry.id} className="meal-entry" style={{
                                position: 'relative', background: cardBg,
                                border: `1px solid ${BORDER}`, borderLeft: `2.5px solid ${leftBar}`,
                                borderRadius: 7, padding: '5px 7px 5px 8px',
                                cursor: 'pointer', opacity: missed ? 0.55 : 1,
                                transition: 'opacity 0.2s',
                              }} onClick={() => setSelectedMeal(entry)}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                                  <p style={{ fontSize: 11, fontWeight: 600, color: done ? MUTED : TEXT, lineHeight: 1.3, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: missed ? 'line-through' : 'none' }}>{entry.recipe?.title}</p>
                                  <button onClick={e => toggleComplete(entry.id, e)}
                                    style={{ width: 15, height: 15, borderRadius: '50%', border: `1.5px solid ${dotC}`, background: done ? '#22c55e' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer', padding: 0 }}>
                                    {done   && <svg width="7" height="7" viewBox="0 0 12 12" fill="none" stroke="#fff"    strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1.5,6 4.5,9.5 10.5,2.5"/></svg>}
                                    {missed && <svg width="5" height="5" viewBox="0 0 12 12" fill="none" stroke="#f87171" strokeWidth="2.5" strokeLinecap="round"><line x1="2" y1="2" x2="10" y2="10"/><line x1="10" y1="2" x2="2" y2="10"/></svg>}
                                  </button>
                                </div>
                                {done && entry.recipe?.nutrition?.calories != null && (
                                  <p style={{ fontSize: 10, color: DIM, marginTop: 1 }}>
                                    {Math.round(entry.recipe.nutrition.calories / 10) * 10} cal
                                  </p>
                                )}
                                <button onClick={e => { e.stopPropagation(); handleDeleteMeal(entry.id); }}
                                  className="del-btn"
                                  style={{ position: 'absolute', top: -4, left: -4, width: 14, height: 14, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-soft)', border: `1px solid ${BORDER}`, cursor: 'pointer', opacity: 0, transition: 'opacity 0.15s' }}>
                                  <svg width="6" height="6" viewBox="0 0 12 12" fill="none" stroke={MUTED} strokeWidth="2.5" strokeLinecap="round"><line x1="1" y1="1" x2="11" y2="11"/><line x1="11" y1="1" x2="1" y2="11"/></svg>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                        {!slotFull && (
                          <button className="add-row" onClick={() => { setAdding({ date: day, slot }); setSelectedRecipeId(''); setAddError(''); }}
                            style={{ marginTop: entries.length > 0 ? 4 : 0, width: '100%', textAlign: 'left', fontSize: 11, color: MUTED, background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontSize: 13 }}>+</span> Add {slot}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Legend ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, marginTop: 20 }}>
          {[
            { bar: 'rgba(59,130,246,0.5)', label: 'Planned' },
            { bar: '#22c55e', label: 'Completed' },
            { bar: 'rgba(248,113,113,0.45)', label: 'Missed' },
          ].map(({ bar, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{ width: 3, height: 14, borderRadius: 2, background: bar }} />
              <span style={{ fontSize: 11, color: MUTED }}>{label}</span>
            </div>
          ))}
        </div>

        {/* ── Meal detail modal ── */}
        {selectedMeal && (
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)' }} onClick={() => setSelectedMeal(null)}>
            <div style={{ background: CARD, borderRadius: 20, width: '100%', maxWidth: 480, maxHeight: '88vh', display: 'flex', flexDirection: 'column', border: `1px solid ${BORDER}`, animation: 'modalIn 0.25s ease' }} onClick={e => e.stopPropagation()}>
              <div style={{ height: 3, borderRadius: '20px 20px 0 0', background: BLUE }} />
              <div style={{ padding: '18px 22px', borderBottom: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: TEXT }}>{selectedMeal.recipe?.title}</h3>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '3px 10px', borderRadius: 20, color: BLUE, background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.2)' }}>{SLOT_META[selectedMeal.meal_slot]?.label}</span>
                    {selectedMeal.recipe?.cuisine && <span style={{ fontSize: 12, color: MUTED }}>{selectedMeal.recipe.cuisine}</span>}
                    {(selectedMeal.recipe?.prep_time || selectedMeal.recipe?.cook_time) && <span style={{ fontSize: 12, color: MUTED }}>{(selectedMeal.recipe!.prep_time || 0) + (selectedMeal.recipe!.cook_time || 0)} min</span>}
                  </div>
                </div>
                <button onClick={() => setSelectedMeal(null)} style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${BORDER}`, background: 'var(--bg-soft)', color: MUTED, fontSize: 14, cursor: 'pointer', flexShrink: 0 }}>✕</button>
              </div>
              <div style={{ overflowY: 'auto', padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 18 }}>
                {selectedMeal.recipe?.nutrition?.calories != null && <NutritionLabel n={selectedMeal.recipe.nutrition} />}
                {selectedMeal.recipe?.description && <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.6 }}>{selectedMeal.recipe.description}</p>}
                {selectedMeal.recipe?.ingredients?.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: MUTED, textTransform: 'uppercase', marginBottom: 12 }}>Ingredients</h4>
                    <ul style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {selectedMeal.recipe.ingredients.map((ing, i) => (
                        <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, color: TEXT }}>
                          <span style={{ marginTop: 5, width: 5, height: 5, borderRadius: '50%', background: BLUE, flexShrink: 0 }} />
                          <span><strong>{ing.quantity} {ing.unit}</strong> {ing.name}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {selectedMeal.recipe?.steps?.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: MUTED, textTransform: 'uppercase', marginBottom: 12 }}>Steps</h4>
                    <ol style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {selectedMeal.recipe.steps.map((step, i) => (
                        <li key={i} style={{ display: 'flex', gap: 12, fontSize: 14, color: TEXT }}>
                          <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: '50%', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.25)', color: BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{i + 1}</span>
                          <span style={{ paddingTop: 2, lineHeight: 1.5 }}>{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
              <div style={{ padding: '14px 22px', borderTop: `1px solid ${BORDER}` }}>
                <button onClick={() => { handleDeleteMeal(selectedMeal.id); setSelectedMeal(null); }} style={{ width: '100%', height: 42, borderRadius: 10, border: '1px solid rgba(248,113,113,0.3)', background: 'transparent', color: '#f87171', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  Remove from plan
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Workout detail modal ── */}
        {selectedWorkout && !workoutDate && (
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)' }} onClick={() => setSelectedWorkout(null)}>
            <div style={{ background: CARD, borderRadius: 20, width: '100%', maxWidth: 420, maxHeight: '88vh', display: 'flex', flexDirection: 'column', border: `1px solid ${BORDER}`, animation: 'modalIn 0.25s ease' }} onClick={e => e.stopPropagation()}>
              <div style={{ height: 3, borderRadius: '20px 20px 0 0', background: BLUE }} />
              <div style={{ padding: '18px 22px', borderBottom: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: TEXT }}>{selectedWorkout.title}</h3>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    {selectedWorkout.workout_type && <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', padding: '3px 10px', borderRadius: 20, color: BLUE, background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.2)' }}>{selectedWorkout.workout_type}</span>}
                    {selectedWorkout.duration_minutes && <span style={{ fontSize: 12, color: MUTED }}>{selectedWorkout.duration_minutes} min</span>}
                  </div>
                </div>
                <button onClick={() => setSelectedWorkout(null)} style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${BORDER}`, background: 'var(--bg-soft)', color: MUTED, fontSize: 14, cursor: 'pointer' }}>✕</button>
              </div>
              <div style={{ overflowY: 'auto', padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(selectedWorkout.exercises as unknown as ExerciseEntry[])?.map((ex, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-soft)', borderRadius: 12, padding: '12px 16px', border: `1px solid ${BORDER}` }}>
                    <span style={{ width: 24, height: 24, borderRadius: '50%', background: BLUE, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>{ex.name}</p>
                      {(ex.sets || ex.reps) && <p style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{ex.sets && `${ex.sets} sets`}{ex.sets && ex.reps && ' × '}{ex.reps && `${ex.reps}`}</p>}
                    </div>
                  </div>
                ))}
                {selectedWorkout.notes && <p style={{ fontSize: 14, color: MUTED }}>{selectedWorkout.notes}</p>}
              </div>
              <div style={{ padding: '14px 22px', borderTop: `1px solid ${BORDER}` }}>
                <button onClick={() => { setSelectedWorkout(null); setWorkoutDate(selectedWorkout.planned_date); }} style={{ width: '100%', height: 42, borderRadius: 10, background: 'rgba(59,130,246,0.12)', border: `1px solid rgba(59,130,246,0.25)`, color: BLUE, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  Edit workout
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Workout entry modal ── */}
        {workoutDate && (
          <WorkoutModal date={workoutDate} existing={workouts[workoutDate] ?? null}
            onClose={() => { setWorkoutDate(null); setSelectedWorkout(null); }}
            onSaved={() => { setWorkoutDate(null); setSelectedWorkout(null); fetchWorkouts(); }} />
        )}

        {/* ── Restore modal ── */}
        {showRestore && (
          <RestoreModal weekStart={toIso(monday)} onClose={() => setShowRestore(false)}
            onRestored={() => { setShowRestore(false); fetchPlan(); }} />
        )}

        {/* ── Add meal modal ── */}
        {adding && (
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)' }} onClick={() => setAdding(null)}>
            <div style={{ background: CARD, borderRadius: 20, width: '100%', maxWidth: 360, border: `1px solid ${BORDER}`, animation: 'modalIn 0.25s ease', padding: 22 }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '3px 10px', borderRadius: 20, color: BLUE, background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.2)' }}>{SLOT_META[adding.slot]?.label}</span>
                  <p style={{ fontSize: 14, fontWeight: 700, color: TEXT, marginTop: 8 }}>
                    {new Date(adding.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </p>
                </div>
                <button onClick={() => setAdding(null)} style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${BORDER}`, background: 'var(--bg-soft)', color: MUTED, fontSize: 14, cursor: 'pointer' }}>✕</button>
              </div>
              {addError && <p style={{ fontSize: 12, color: '#f87171', marginBottom: 10 }}>{addError}</p>}
              {(() => {
                const slotMatches = recipes.filter(r => r.category?.toLowerCase() === adding.slot);
                return (
                  <div style={{ marginBottom: 16 }}>
                    {slotMatches.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '14px 0' }}>
                        <p style={{ fontSize: 13, color: MUTED, marginBottom: 4 }}>No {SLOT_META[adding.slot]?.label.toLowerCase()} recipes yet.</p>
                        <p style={{ fontSize: 12, color: DIM }}>Go to Recipes and set a recipe's category to &quot;{adding.slot}&quot;.</p>
                      </div>
                    ) : (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <p style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                            {SLOT_META[adding.slot]?.label} recipes
                          </p>
                          <p style={{ fontSize: 11, color: DIM }}>{slotMatches.length} available</p>
                        </div>
                        <Select value={selectedRecipeId || undefined} onValueChange={setSelectedRecipeId}>
                          <SelectTrigger size="lg" className="w-full"><SelectValue placeholder="Choose a recipe…" /></SelectTrigger>
                          <SelectContent>
                            {slotMatches.map(r => <SelectItem key={r.id} value={r.id}>{r.title}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </>
                    )}
                  </div>
                );
              })()}
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setAdding(null)} style={{ flex: 1, height: 44, borderRadius: 10, border: `1px solid ${BORDER}`, color: MUTED, background: 'transparent', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleAdd} disabled={!selectedRecipeId || saving}
                  style={{ flex: 1, height: 44, borderRadius: 10, background: BLUE, color: '#fff', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', opacity: (!selectedRecipeId || saving) ? 0.4 : 1 }}>
                  {saving ? 'Adding…' : 'Add meal'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
