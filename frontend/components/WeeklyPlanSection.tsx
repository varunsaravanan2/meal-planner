'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  getWeeklyPlan, addMealPlan, deleteMealPlan, getRecipes, isLoggedIn, getWeeklyWorkouts,
  listPlanSnapshots, restorePlanSnapshot, getProfile,
  saveWorkout, deleteWorkoutEntry, getWorkoutTemplates, swapMeal, getFoodLog,
  addFoodLog, deleteFoodLog,
  type PlanSnapshot, type ExerciseEntry, type WorkoutTemplate,
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
const WORKOUT_TYPES = [
  // Muscle focus
  'Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core',
  // Splits
  'Push', 'Pull', 'Upper Body', 'Lower Body', 'Full Body',
  // Cardio / other
  'Strength', 'Cardio', 'HIIT', 'Running', 'Cycling', 'Yoga', 'Other',
];
const CHEAT_SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

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
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
function todayLabel() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

// ── animated ring ──────────────────────────────────────────────────────────────

function Ring({ pct, color, size = 30, strokeWidth = 4, track = 'var(--bg-soft)', children }: {
  pct: number; color: string; size?: number; strokeWidth?: number; track?: string; children?: React.ReactNode;
}) {
  const [cur, setCur] = useState(0);
  useEffect(() => { const t = setTimeout(() => setCur(pct), 150); return () => clearTimeout(t); }, [pct]);
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * Math.min(cur, 1);
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeLinecap="round" strokeDasharray={`${dash} ${circ - dash}`}
          style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(0.4,0,0.2,1)' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{children}</div>
    </div>
  );
}

// ── stat card ──────────────────────────────────────────────────────────────────

function StatCard({ label, value, max, color, unit = '', icon, delay = 0 }: {
  label: string; value: number; max: number; color: string; unit?: string; icon: React.ReactNode; delay?: number;
}) {
  const pct = max > 0 ? value / max : 0;
  return (
    <div style={{
      background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16,
      padding: '20px 22px 18px', flex: 1,
      animation: `dashFadeUp 0.55s ease ${delay}ms both`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 12, fontWeight: 500, color: MUTED, marginBottom: 10 }}>{label}</p>
          <p style={{ fontFamily: 'var(--font-nunito), sans-serif', fontSize: 32, fontWeight: 800, color: TEXT, letterSpacing: '-0.5px', lineHeight: 1 }}>
            {value.toLocaleString()}{unit}
          </p>
          <p style={{ fontSize: 12, color: DIM, marginTop: 6 }}>{Math.round(pct * 100)}% · of {max.toLocaleString()}{unit}</p>
        </div>
        <Ring pct={pct} color={color} size={68} strokeWidth={6}>{icon}</Ring>
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

export function WorkoutModal({ date, existing, onClose, onSaved }: {
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
                      {WORKOUT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
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

// ── mini calendar ──────────────────────────────────────────────────────────────

function MiniCalendar({
  monday, setMonday, plan, today,
}: {
  monday: Date;
  setMonday: React.Dispatch<React.SetStateAction<Date>>;
  plan: Record<string, MealPlanEntry[]>;
  today: string;
}) {
  const [calMonth, setCalMonth] = useState(() => {
    const m = new Date(monday);
    m.setDate(1);
    return m;
  });

  // keep calMonth in sync when user navigates weeks
  useEffect(() => {
    setCalMonth(prev => {
      const mondayMonth = monday.getMonth();
      const mondayYear  = monday.getFullYear();
      if (prev.getMonth() !== mondayMonth || prev.getFullYear() !== mondayYear) {
        const m = new Date(monday);
        m.setDate(1);
        return m;
      }
      return prev;
    });
  }, [monday]);

  const year  = calMonth.getFullYear();
  const month = calMonth.getMonth();
  const monthName = calMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // day grid: starts on Monday
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7; // 0=Mon … 6=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells  = Math.ceil((startOffset + daysInMonth) / 7) * 7;

  function toIsoLocal(y: number, m: number, d: number) {
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  function jumpToWeek(iso: string) {
    const d = new Date(iso + 'T00:00:00');
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const mon = new Date(d);
    mon.setDate(d.getDate() + diff);
    setMonday(mon);
  }

  // which week is active
  const activeWeekDays = new Set(
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      return toIso(d);
    }),
  );

  const hasMeal = (iso: string) => (plan[iso] || []).length > 0;

  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ...Array(totalCells - startOffset - daysInMonth).fill(null),
  ];

  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '16px 20px', marginBottom: 20, animation: 'dashFadeUp 0.5s ease 200ms both' }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <p style={{ fontSize: 13, fontWeight: 800, color: TEXT, letterSpacing: '-0.2px' }}>{monthName}</p>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => setCalMonth(new Date(year, month - 1, 1))}
            style={{ width: 28, height: 28, borderRadius: 7, border: `1px solid ${BORDER}`, background: 'transparent', color: MUTED, cursor: 'pointer', fontSize: 13 }}
          >‹</button>
          <button
            onClick={() => { const m = new Date(); m.setDate(1); setCalMonth(m); jumpToWeek(today); }}
            style={{ height: 28, padding: '0 10px', borderRadius: 7, border: `1px solid ${BORDER}`, background: 'transparent', color: MUTED, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}
          >Today</button>
          <button
            onClick={() => setCalMonth(new Date(year, month + 1, 1))}
            style={{ width: 28, height: 28, borderRadius: 7, border: `1px solid ${BORDER}`, background: 'transparent', color: MUTED, cursor: 'pointer', fontSize: 13 }}
          >›</button>
        </div>
      </div>

      {/* weekday labels */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 4 }}>
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => (
          <p key={d} style={{ fontSize: 10, fontWeight: 700, color: DIM, textAlign: 'center', margin: 0, letterSpacing: '0.04em' }}>{d}</p>
        ))}
      </div>

      {/* day cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
        {cells.map((day, idx) => {
          if (day === null) return <div key={idx} />;
          const iso = toIsoLocal(year, month, day);
          const isToday  = iso === today;
          const isActive = activeWeekDays.has(iso);
          const hasMeals = hasMeal(iso);
          const thisMonth = month === calMonth.getMonth();

          return (
            <button
              key={iso}
              onClick={() => jumpToWeek(iso)}
              style={{
                position: 'relative',
                width: '100%', aspectRatio: '1',
                borderRadius: 8,
                border: isToday ? `1.5px solid ${BLUE}` : isActive ? `1.5px solid rgba(59,130,246,0.35)` : '1.5px solid transparent',
                background: isActive ? 'rgba(59,130,246,0.08)' : 'transparent',
                color: isToday ? BLUE : thisMonth ? TEXT : DIM,
                fontSize: 12, fontWeight: isToday ? 800 : isActive ? 700 : 500,
                cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
              }}
            >
              {day}
              {hasMeals && (
                <div style={{ width: 4, height: 4, borderRadius: '50%', background: isActive ? BLUE : '#a78bfa', flexShrink: 0 }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── weekly plan section ────────────────────────────────────────────────────────

export default function WeeklyPlanSection({ children }: { children?: React.ReactNode }) {
  const router = useRouter();

  const [monday, setMonday] = useState<Date>(() => isoWeekMonday(new Date()));
  const [plan, setPlan] = useState<Record<string, MealPlanEntry[]>>({});
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [workouts, setWorkouts] = useState<Record<string, WorkoutPlan>>({});
  const [calorieGoal, setCalorieGoal] = useState(2000);
  const [proteinGoal, setProteinGoal] = useState(150);
  const [carbsGoal, setCarbsGoal] = useState(250);
  const [fatGoal, setFatGoal] = useState(65);

  const [selectedMeal, setSelectedMeal] = useState<MealPlanEntry | null>(null);
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutPlan | null>(null);
  const [workoutDate, setWorkoutDate] = useState<string | null>(null);
  const [showRestore, setShowRestore] = useState(false);
  const [adding, setAdding] = useState<{ date: string; slot: string } | null>(null);
  const [selectedRecipeId, setSelectedRecipeId] = useState('');
  const [addQuery, setAddQuery] = useState('');
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
  const [todayFoodLog, setTodayFoodLog] = useState<{ calories: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number } | null>(null);
  const [waterGoal, setWaterGoal] = useState(8);
  const [water, setWater] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    try { const logs: Record<string, number> = JSON.parse(localStorage.getItem('water_logs') || '{}'); return logs[new Date().toISOString().slice(0, 10)] ?? 0; } catch { return 0; }
  });
  const [checkFoodLogIds, setCheckFoodLogIds] = useState<Record<string, string>>({});
  const [cheatMeals, setCheatMeals] = useState<Record<string, string>>(() => {
    if (typeof window === 'undefined') return {};
    try { return JSON.parse(localStorage.getItem('cheat_meals') || '{}'); } catch { return {}; }
  }); // { "2026-08-03": "lunch", ... }
  const [cheatModal, setCheatModal] = useState(false);
  const [cheatDay, setCheatDay] = useState('1'); // day-of-week: 0=Sun … 6=Sat
  const [cheatSlot, setCheatSlot] = useState('lunch');

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
  useEffect(() => {
    if (isLoggedIn()) getProfile().then(p => {
      if (!p) return;
      const pr = p as unknown as Record<string, number>;
      if (pr.calorie_goal) setCalorieGoal(pr.calorie_goal);
      if (pr.protein_goal_g) setProteinGoal(pr.protein_goal_g);
      if (pr.carbs_goal_g) setCarbsGoal(pr.carbs_goal_g);
      if (pr.fat_goal_g) setFatGoal(pr.fat_goal_g);
      if (pr.water_goal) setWaterGoal(pr.water_goal);
    }).catch(() => {});
  }, []);
  useEffect(() => {
    if (!isLoggedIn()) return;
    const weekStart = toIso(monday);
    getFoodLog(today).then(entries => {
      setTodayFoodLog({
        calories: Math.round(entries.reduce((s, e) => s + (e.calories ?? 0), 0)),
        protein_g: Math.round(entries.reduce((s, e) => s + (e.protein_g ?? 0), 0)),
        carbs_g: Math.round(entries.reduce((s, e) => s + (e.carbs_g ?? 0), 0)),
        fat_g: Math.round(entries.reduce((s, e) => s + (e.fat_g ?? 0), 0)),
        fiber_g: Math.round(entries.reduce((s, e) => s + (e.fiber_g ?? 0), 0)),
      });
    }).catch(() => {});
  }, [monday, today]);

  const todayEntries  = plan[today] || [];
  const completedTodayEntries = todayEntries.filter(e => completedIds.has(e.id));
  const todayCal      = todayFoodLog?.calories ?? Math.round(completedTodayEntries.reduce((s, e) => s + (e.recipe?.nutrition?.calories ?? 0), 0));
  const todayProt     = todayFoodLog?.protein_g ?? Math.round(completedTodayEntries.reduce((s, e) => s + (e.recipe?.nutrition?.protein_g ?? 0), 0));
  const todayCarbs    = todayFoodLog?.carbs_g ?? Math.round(completedTodayEntries.reduce((s, e) => s + (e.recipe?.nutrition?.carbs_g ?? 0), 0));
  const todayFat      = todayFoodLog?.fat_g ?? Math.round(completedTodayEntries.reduce((s, e) => s + (e.recipe?.nutrition?.fat_g ?? 0), 0));
  const todayFiber    = todayFoodLog?.fiber_g ?? Math.round(completedTodayEntries.reduce((s, e) => s + (e.recipe?.nutrition?.fiber_g ?? 0), 0));
  const todayMeals    = completedTodayEntries.length;
  const weekWorkouts  = weekDays.filter(d => workouts[d] && !workouts[d].is_rest_day).length;

  async function handleAdd() {
    if (!selectedRecipeId || !adding) return;
    setSaving(true); setAddError('');
    try { await addMealPlan({ recipe_id: selectedRecipeId, planned_date: adding.date, meal_slot: adding.slot }); setAdding(null); setSelectedRecipeId(''); fetchPlan(); }
    catch (e) { setAddError((e as Error).message); }
    finally { setSaving(false); }
  }

  async function toggleComplete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    const isNowDone = !completedIds.has(id);
    setCompletedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try { localStorage.setItem('meal_completions', JSON.stringify([...next])); } catch {}
      return next;
    });
    if (isNowDone) {
      const entry = Object.values(plan).flat().find(en => en.id === id);
      if (entry?.recipe) {
        try {
          const logged = await addFoodLog({
            recipe_id: entry.recipe.id,
            log_date: entry.planned_date,
            meal_slot: entry.meal_slot,
            name: entry.recipe.title,
            calories: entry.recipe.nutrition?.calories ?? null,
            protein_g: entry.recipe.nutrition?.protein_g ?? null,
            carbs_g: entry.recipe.nutrition?.carbs_g ?? null,
            fat_g: entry.recipe.nutrition?.fat_g ?? null,
            fiber_g: entry.recipe.nutrition?.fiber_g ?? null,
            servings: 1,
          });
          setCheckFoodLogIds(prev => ({ ...prev, [id]: logged.id }));
        } catch { /* silent */ }
      }
    } else if (checkFoodLogIds[id]) {
      try {
        await deleteFoodLog(checkFoodLogIds[id]);
        setCheckFoodLogIds(prev => { const n = { ...prev }; delete n[id]; return n; });
      } catch { /* silent */ }
    }
  }

  function adjustWater(delta: number) {
    setWater(prev => {
      const next = Math.max(0, Math.min(prev + delta, 20));
      try {
        const logs: Record<string, number> = JSON.parse(localStorage.getItem('water_logs') || '{}');
        logs[today] = next;
        localStorage.setItem('water_logs', JSON.stringify(logs));
      } catch {}
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

  function saveCheatMeal() {
    setCheatMeals(prev => {
      const next = { ...prev, [cheatDay]: cheatSlot };
      try { localStorage.setItem('cheat_meals', JSON.stringify(next)); } catch {}
      return next;
    });
    setCheatModal(false);
  }
  function removeCheatMeal(dow: string) {
    setCheatMeals(prev => {
      const next = { ...prev }; delete next[dow];
      try { localStorage.setItem('cheat_meals', JSON.stringify(next)); } catch {}
      return next;
    });
  }

  const [swapping, setSwapping] = useState<Set<string>>(new Set());
  async function handleSwapMeal(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (swapping.has(id)) return;
    setSwapping(s => new Set(s).add(id));
    try {
      const updated = await swapMeal(id);
      setPlan(prev => { const next: Record<string, MealPlanEntry[]> = {}; for (const [d, es] of Object.entries(prev)) next[d] = es.map(en => en.id === id ? updated : en); return next; });
    } catch { fetchPlan(); }
    finally { setSwapping(s => { const n = new Set(s); n.delete(id); return n; }); }
  }

  return (
    <>
      <style>{`
        @keyframes dashFadeUp { from { opacity:0; transform:translateY(8px); animation-timing-function:cubic-bezier(0.23,1,0.32,1); } to { opacity:1; transform:translateY(0); } }
        @keyframes modalIn    { from { opacity:0; transform:scale(0.95) translateY(8px); animation-timing-function:cubic-bezier(0.23,1,0.32,1); } to { opacity:1; transform:scale(1) translateY(0); } }
        @keyframes slideUp    { from { transform:translateY(100%); animation-timing-function:cubic-bezier(0.32,0.72,0,1); } to { transform:translateY(0); } }
        .add-row { opacity: 0; transition: opacity 0.12s ease-out; }
        @media (hover: hover) and (pointer: fine) { .slot-cell:hover .add-row { opacity: 1; } }
        .del-btn { pointer-events: none; }
        .swap-btn { pointer-events: none; }
        @media (hover: hover) and (pointer: fine) {
          .meal-entry:hover .del-btn { opacity: 1 !important; pointer-events: auto; }
          .meal-entry:hover .swap-btn { opacity: 1 !important; pointer-events: auto; }
        }
        @media (max-width: 640px) {
          .dash-wrap { padding: 16px 14px 24px !important; }
          .greeting-row { flex-wrap: wrap; row-gap: 12px; }
          .greeting-title { font-size: 26px !important; }
          .stat-grid { grid-template-columns: repeat(2,1fr) !important; }
          .nutrition-grid { grid-template-columns: repeat(2,1fr) !important; gap: 14px !important; }
          .week-header-row { flex-wrap: wrap; row-gap: 10px; }
          .week-actions { flex-wrap: wrap; row-gap: 8px; }
          .week-grid { display: flex !important; overflow-x: auto !important; padding-bottom: 8px; -webkit-overflow-scrolling: touch; scroll-snap-type: x proximity; }
          .week-grid > div { flex: 0 0 150px !important; min-width: 150px; scroll-snap-align: start; }
        }
      `}</style>

      <div className="dash-wrap" style={{ minHeight: '100%', padding: '28px 28px 60px' }}>

        {/* ── Greeting header ── */}
        <div className="greeting-row" style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ animation: 'dashFadeUp 0.4s ease' }}>
            <p style={{ fontSize: 14, fontWeight: 500, color: MUTED, marginBottom: 4 }}>{timeGreeting()} —</p>
            <h1 className="greeting-title" style={{ fontSize: 32, fontWeight: 700, color: TEXT, letterSpacing: '-0.5px', lineHeight: 1.15 }}>{todayLabel()}</h1>
          </div>
          <a href="/pricing" style={{ display: 'inline-flex', alignItems: 'center', height: 38, padding: '0 18px', borderRadius: 10, border: `1.5px solid ${BLUE}`, color: BLUE, fontSize: 13, fontWeight: 700, textDecoration: 'none', letterSpacing: '0.02em', flexShrink: 0, animation: 'dashFadeUp 0.4s ease' }}>
            Upgrade
          </a>
        </div>

        {/* ── Stat cards ── */}
        <div className="stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 28 }}>
          <StatCard label="Today's calories" value={todayCal}    max={calorieGoal} color={BLUE}    unit=" cal" delay={0}
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={BLUE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>} />
          <StatCard label="Today's protein"  value={todayProt}   max={proteinGoal} color="#a78bfa" unit="g"    delay={60}
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>} />
          <StatCard label="Meals today"      value={todayMeals}  max={4}           color="#34d399" unit=""     delay={120}
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/></svg>} />
          <StatCard label="Active days"      value={weekWorkouts} max={7}          color="#fb923c" unit=""     delay={180}
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fb923c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>} />
        </div>

        {/* ── Daily nutrition widget ── */}
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '16px 22px', marginBottom: 20, animation: 'dashFadeUp 0.5s ease 200ms both' }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: MUTED, textTransform: 'uppercase', marginBottom: 14 }}>Today&apos;s Nutrition</p>
          <div className="nutrition-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
            {[
              { label: 'Carbs', value: todayCarbs, goal: carbsGoal, unit: 'g',   color: '#34d399' },
              { label: 'Fat',   value: todayFat,   goal: fatGoal,   unit: 'g',   color: '#fb923c' },
              { label: 'Fiber', value: todayFiber, goal: 25,        unit: 'g',   color: '#a3e635' },
              { label: 'Water', value: water,      goal: waterGoal, unit: ' gl', color: '#38bdf8', interactive: true },
            ].map(({ label, value, goal, unit, color, interactive }) => {
              const pct = Math.min(value / Math.max(goal, 1), 1);
              return (
                <div key={label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                    <p style={{ fontSize: 12, fontWeight: 500, color: MUTED }}>{label}</p>
                    {interactive ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button onClick={() => adjustWater(-1)} style={{ width: 18, height: 18, borderRadius: 5, border: `1px solid ${BORDER}`, background: 'var(--bg-soft)', color: MUTED, fontSize: 13, lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>−</button>
                        <p style={{ fontSize: 12, fontWeight: 800, color: TEXT, minWidth: 24, textAlign: 'center' }}>{value}{unit}</p>
                        <button onClick={() => adjustWater(1)} style={{ width: 18, height: 18, borderRadius: 5, border: `1px solid ${BORDER}`, background: 'var(--bg-soft)', color: MUTED, fontSize: 13, lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>+</button>
                      </div>
                    ) : (
                      <p style={{ fontSize: 12, fontWeight: 800, color: TEXT }}>{value}{unit}</p>
                    )}
                  </div>
                  <div style={{ height: 5, borderRadius: 3, background: 'var(--bg-soft)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct * 100}%`, background: color, borderRadius: 3, transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)' }} />
                  </div>
                  <p style={{ fontSize: 10, color: DIM, marginTop: 4 }}>of {goal}{unit}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Slot for content between stats and calendar (e.g. tasks) ── */}
        {children}

        {/* ── Workout week widget ── */}
        {weekDays.some(d => workouts[d]) && (
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '14px 22px', marginBottom: 20, animation: 'dashFadeUp 0.55s ease 260ms both' }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: MUTED, textTransform: 'uppercase', marginBottom: 12 }}>This Week&apos;s Workouts</p>
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 2 }}>
              {weekDays.map(d => {
                const w = workouts[d];
                if (!w) return null;
                const { weekday, date } = formatDay(d);
                const done = !!workoutCompletions[d];
                const isToday = d === today;
                const color = w.is_rest_day ? MUTED : done ? '#22c55e' : BLUE;
                return (
                  <div key={d} onClick={() => { if (!w.is_rest_day) setSelectedWorkout(w); }}
                    style={{ flexShrink: 0, minWidth: 100, background: 'var(--bg-soft)', border: `1px solid ${isToday ? BLUE : BORDER}`, borderRadius: 12, padding: '10px 12px', cursor: w.is_rest_day ? 'default' : 'pointer', opacity: w.is_rest_day ? 0.5 : 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.09em', color: isToday ? BLUE : MUTED }}>{weekday} {date}</span>
                      {done && <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1.5,6 4.5,9.5 10.5,2.5"/></svg>}
                    </div>
                    <p style={{ fontSize: 12, fontWeight: 700, color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {w.is_rest_day ? 'Rest' : (w.title ?? w.workout_type ?? 'Workout')}
                    </p>
                    {!w.is_rest_day && w.workout_type && (
                      <p style={{ fontSize: 10, color: DIM, marginTop: 2 }}>{w.workout_type}{w.duration_minutes ? ` · ${w.duration_minutes}m` : ''}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Week nav header ── */}
        <div className="week-header-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: TEXT, letterSpacing: '-0.4px' }}>Weekly Plan</h2>
            <p style={{ fontSize: 13, color: MUTED, marginTop: 3 }}>{monthLabel}</p>
          </div>
          <div className="week-actions" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => { setCheatDay(String(new Date().getDay())); setCheatSlot('lunch'); setCheatModal(true); }} style={{ height: 38, padding: '0 14px', borderRadius: 9, border: `1px solid rgba(251,146,60,0.4)`, background: 'transparent', color: '#fb923c', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2v-4M9 21H5a2 2 0 0 1-2-2v-4m0 0h18"/></svg>
              Cheat Meal
            </button>
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
          <div className="week-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 10 }}>
            {weekDays.map(d => <div key={d} style={{ background: CARD, borderRadius: 14, height: 420, opacity: 0.5 }} />)}
          </div>
        ) : (
          <div className="week-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 10 }}>
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
                    <p style={{ fontSize: 11, fontWeight: 500, color: isToday ? BLUE : MUTED, marginBottom: 6 }}>{weekday}</p>
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
                          <span style={{ fontSize: 10, fontWeight: 500, color: wDone ? '#22c55e' : MUTED, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={wDone ? '#22c55e' : MUTED} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.4 14.4 9.6 9.6"/><path d="M18 3v4"/><path d="M6 3v4"/><path d="M3 6h4"/><path d="M17 20h4"/><path d="M3 18h4"/><path d="M6 21v-4"/><path d="M18 21v-4"/><path d="M20.4 9.6l-7.7 7.7a2 2 0 0 1-2.8 0L5.5 12.9a2 2 0 0 1 0-2.8l7.7-7.7a2 2 0 0 1 2.8 0l4.4 4.4a2 2 0 0 1 0 2.8z"/></svg>
                            Workout
                          </span>
                        </div>
                        {w ? (
                          w.is_rest_day ? (
                            <p style={{ fontSize: 11, color: MUTED, fontStyle: 'italic' }}>Rest day</p>
                          ) : (
                            <div className="meal-entry" style={{
                              position: 'relative', background: 'transparent',
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
                        {(() => {
                          const dow = String(new Date(day + 'T00:00:00').getDay());
                          const isCheat = cheatMeals[dow] === slot;
                          return (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0, marginBottom: 5 }}>
                              <span style={{ fontSize: 10, fontWeight: 500, color: MUTED, flexShrink: 0 }}>
                                {meta.label}
                              </span>
                              {isCheat && (
                                <>
                                  <span style={{ fontSize: 9, fontWeight: 700, color: '#fb923c' }}>(Cheat Meal)</span>
                                  <button onClick={() => removeCheatMeal(dow)} style={{ width: 13, height: 13, borderRadius: 3, border: `1px solid ${BORDER}`, background: 'var(--bg-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, flexShrink: 0 }}>
                                    <svg width="6" height="6" viewBox="0 0 12 12" fill="none" stroke={MUTED} strokeWidth="2.5" strokeLinecap="round"><line x1="1" y1="1" x2="11" y2="11"/><line x1="11" y1="1" x2="1" y2="11"/></svg>
                                  </button>
                                </>
                              )}
                            </div>
                          );
                        })()}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {entries.map(entry => {
                            const done = completedIds.has(entry.id);
                            const isPast = day < today;
                            const missed = isPast && !done;
                            const leftBar = done ? '#22c55e' : missed ? 'rgba(248,113,113,0.45)' : 'rgba(59,130,246,0.5)';
                            const dotC    = done ? '#22c55e' : missed ? 'rgba(248,113,113,0.6)' : 'rgba(59,130,246,0.6)';
                            return (
                              <div key={entry.id} className="meal-entry" style={{
                                position: 'relative', background: 'transparent',
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
                                <button onClick={e => handleSwapMeal(e, entry.id)}
                                  className="swap-btn"
                                  title="Swap for another recipe"
                                  style={{ position: 'absolute', top: -4, right: -4, width: 14, height: 14, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', background: swapping.has(entry.id) ? 'rgba(59,130,246,0.12)' : 'var(--bg-soft)', border: `1px solid ${BORDER}`, cursor: swapping.has(entry.id) ? 'default' : 'pointer', opacity: 0, transition: 'opacity 0.15s' }}>
                                  <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke={BLUE} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: swapping.has(entry.id) ? 'spin 0.7s linear infinite' : 'none' }}>
                                    <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
                                  </svg>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                        {!slotFull && (
                          <button className="add-row" onClick={() => { setAdding({ date: day, slot }); setSelectedRecipeId(''); setAddQuery(''); setAddError(''); }}
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

        {/* ── Cheat meal modal ── */}
        {cheatModal && (
          <div className="fixed inset-0 flex items-end justify-center z-50 px-4" style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)', paddingBottom: 256 }} onClick={() => setCheatModal(false)}>
            <div style={{ background: CARD, borderRadius: 20, width: '100%', maxWidth: 380, border: `1px solid ${BORDER}`, animation: 'modalIn 0.25s ease', padding: 24 }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#fb923c', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 4 }}>Cheat Meal</p>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: TEXT }}>Plan your cheat</h3>
                </div>
                <button onClick={() => setCheatModal(false)} style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${BORDER}`, background: 'var(--bg-soft)', color: MUTED, fontSize: 14, cursor: 'pointer' }}>✕</button>
              </div>

              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Day</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                  {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((label, i) => {
                    const dow = String(i === 6 ? 0 : i + 1); // Mon=1…Sat=6,Sun=0
                    const sel = cheatDay === dow;
                    return (
                      <button key={dow} onClick={() => setCheatDay(dow)} style={{ padding: '10px 4px', borderRadius: 9, border: `1.5px solid ${sel ? '#fb923c' : BORDER}`, background: sel ? 'rgba(251,146,60,0.1)' : 'transparent', cursor: 'pointer', textAlign: 'center' }}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: sel ? '#fb923c' : MUTED, letterSpacing: '0.07em' }}>{label}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ marginBottom: 24 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Time of day</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                  {CHEAT_SLOTS.map(s => {
                    const sel = cheatSlot === s;
                    const label = s.charAt(0).toUpperCase() + s.slice(1);
                    return (
                      <button key={s} onClick={() => setCheatSlot(s)} style={{ padding: '10px 6px', borderRadius: 10, border: `1.5px solid ${sel ? '#fb923c' : BORDER}`, background: sel ? 'rgba(251,146,60,0.1)' : 'transparent', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: sel ? '#fb923c' : MUTED }}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setCheatModal(false)} style={{ flex: 1, height: 44, borderRadius: 10, border: `1px solid ${BORDER}`, color: MUTED, background: 'transparent', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button onClick={saveCheatMeal} style={{ flex: 2, height: 44, borderRadius: 10, background: '#fb923c', color: '#fff', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                  Save cheat meal
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Restore modal ── */}
        {showRestore && (
          <RestoreModal weekStart={toIso(monday)} onClose={() => setShowRestore(false)}
            onRestored={() => { setShowRestore(false); fetchPlan(); }} />
        )}

        {/* ── Add meal modal ── */}
        {adding && (() => {
          const q = addQuery.toLowerCase();
          const slotFirst = recipes.filter(r => r.category?.toLowerCase() === adding.slot);
          const others = recipes.filter(r => r.category?.toLowerCase() !== adding.slot);
          const sorted = [...slotFirst, ...others];
          const filtered = q ? sorted.filter(r => r.title.toLowerCase().includes(q) || r.category?.toLowerCase().includes(q) || r.cuisine?.toLowerCase().includes(q)) : sorted;
          return (
            <div className="fixed inset-0 flex items-end justify-center z-50" style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' }} onClick={() => setAdding(null)}>
              <div style={{ background: CARD, borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 520, maxHeight: '80vh', display: 'flex', flexDirection: 'column', border: `1px solid ${BORDER}`, borderBottom: 'none', animation: 'slideUp 0.25s ease' }} onClick={e => e.stopPropagation()}>
                {/* Handle */}
                <div style={{ width: 36, height: 4, borderRadius: 2, background: BORDER, margin: '12px auto 0' }} />
                {/* Header */}
                <div style={{ padding: '14px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '3px 10px', borderRadius: 20, color: BLUE, background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.2)' }}>{SLOT_META[adding.slot]?.label}</span>
                    <p style={{ fontSize: 13, color: MUTED, marginTop: 5 }}>
                      {new Date(adding.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </p>
                  </div>
                  <button onClick={() => setAdding(null)} style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${BORDER}`, background: 'var(--bg-soft)', color: MUTED, fontSize: 14, cursor: 'pointer', flexShrink: 0 }}>✕</button>
                </div>
                {/* Search */}
                <div style={{ padding: '0 20px 12px', flexShrink: 0 }}>
                  <div style={{ position: 'relative' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <input
                      autoFocus
                      value={addQuery}
                      onChange={e => setAddQuery(e.target.value)}
                      placeholder="Search recipes…"
                      style={{ width: '100%', height: 40, paddingLeft: 34, paddingRight: 14, borderRadius: 10, border: `1px solid ${BORDER}`, background: 'var(--bg-soft)', color: TEXT, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                    />
                    {addQuery && (
                      <button onClick={() => setAddQuery('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: MUTED, fontSize: 14, lineHeight: 1 }}>✕</button>
                    )}
                  </div>
                </div>
                {addError && <p style={{ fontSize: 12, color: '#f87171', padding: '0 20px 8px', flexShrink: 0 }}>{addError}</p>}
                {/* Recipe list */}
                <div style={{ overflowY: 'auto', flex: 1, padding: '0 20px 24px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {filtered.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '32px 0', color: MUTED }}>
                      <p style={{ fontSize: 14, fontWeight: 600 }}>No recipes found</p>
                      <p style={{ fontSize: 12, color: DIM, marginTop: 4 }}>Try a different search, or add recipes in the Recipes tab.</p>
                    </div>
                  ) : (
                    <>
                      {!q && slotFirst.length > 0 && (
                        <p style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 2 }}>
                          {SLOT_META[adding.slot]?.label} recipes
                        </p>
                      )}
                      {filtered.map((r, idx) => {
                        const isSlotMatch = r.category?.toLowerCase() === adding.slot;
                        const isSelected = selectedRecipeId === r.id;
                        const showDivider = !q && idx === slotFirst.length && others.length > 0 && slotFirst.length > 0;
                        const cal = r.nutrition?.calories != null ? Math.round(r.nutrition.calories / 10) * 10 : null;
                        return (
                          <React.Fragment key={r.id}>
                            {showDivider && (
                              <p style={{ fontSize: 10, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.09em', marginTop: 8, marginBottom: 2 }}>All recipes</p>
                            )}
                            <button
                              onClick={() => { setSelectedRecipeId(r.id); setAddError(''); }}
                              style={{
                                width: '100%', textAlign: 'left', background: isSelected ? 'rgba(59,130,246,0.08)' : 'var(--bg-soft)',
                                border: isSelected ? `1.5px solid ${BLUE}` : `1px solid ${BORDER}`,
                                borderRadius: 12, padding: '10px 14px', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: 12,
                                transition: 'background 0.12s ease-out, border-color 0.12s ease-out',
                              }}
                            >
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontSize: 13, fontWeight: 600, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3, flexWrap: 'wrap' }}>
                                  {isSlotMatch && (
                                    <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: BLUE, background: 'rgba(59,130,246,0.1)', padding: '1px 6px', borderRadius: 4 }}>
                                      {r.category}
                                    </span>
                                  )}
                                  {r.cuisine && <span style={{ fontSize: 11, color: DIM }}>{r.cuisine}</span>}
                                  {cal != null && <span style={{ fontSize: 11, color: DIM }}>{cal} cal</span>}
                                  {(r.prep_time || r.cook_time) && <span style={{ fontSize: 11, color: DIM }}>{(r.prep_time ?? 0) + (r.cook_time ?? 0)} min</span>}
                                </div>
                              </div>
                              {isSelected && (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={BLUE} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                  <polyline points="20 6 9 17 4 12"/>
                                </svg>
                              )}
                            </button>
                          </React.Fragment>
                        );
                      })}
                    </>
                  )}
                </div>
                {/* Footer */}
                <div style={{ padding: '12px 20px 28px', borderTop: `1px solid ${BORDER}`, flexShrink: 0, display: 'flex', gap: 10 }}>
                  <button onClick={() => setAdding(null)} style={{ flex: 1, height: 44, borderRadius: 10, border: `1px solid ${BORDER}`, color: MUTED, background: 'transparent', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                  <button onClick={handleAdd} disabled={!selectedRecipeId || saving}
                    style={{ flex: 2, height: 44, borderRadius: 10, background: BLUE, color: '#fff', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', opacity: (!selectedRecipeId || saving) ? 0.4 : 1 }}>
                    {saving ? 'Adding…' : 'Add to plan'}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── Trainer card ── */}
        <a
          href="https://www.instagram.com/jcbme.coach/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 28, padding: '14px 18px', borderRadius: 16, border: `1px solid ${BORDER}`, background: CARD, textDecoration: 'none', transition: 'border-color 0.2s' }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(225,48,108,0.5)')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = BORDER)}
        >
          {/* Instagram gradient avatar placeholder */}
          <div style={{ width: 46, height: 46, borderRadius: '50%', flexShrink: 0, padding: 2, background: 'linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)' }}>
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: CARD, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="url(#igGrad)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <defs>
                  <linearGradient id="igGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#f09433"/>
                    <stop offset="50%" stopColor="#dc2743"/>
                    <stop offset="100%" stopColor="#bc1888"/>
                  </linearGradient>
                </defs>
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                <circle cx="12" cy="12" r="4"/>
                <circle cx="17.5" cy="6.5" r="1" fill="url(#igGrad)" stroke="none"/>
              </svg>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: TEXT, marginBottom: 2 }}>Joshua Cunningham</p>
            <p style={{ fontSize: 12, color: MUTED }}>@jcbme.coach</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, height: 32, padding: '0 14px', borderRadius: 8, background: 'linear-gradient(135deg,#f09433,#dc2743,#bc1888)', color: '#fff', fontSize: 12, fontWeight: 700 }}>
            Follow
          </div>
        </a>

      </div>
    </>
  );
}
