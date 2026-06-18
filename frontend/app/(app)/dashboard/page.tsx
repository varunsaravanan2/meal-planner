'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  getWeeklyPlan, addMealPlan, deleteMealPlan, getRecipes, isLoggedIn, getWeeklyWorkouts,
  getSubscriptionStatus, listPlanSnapshots, restorePlanSnapshot,
  saveWorkout, deleteWorkoutEntry,
  type SubscriptionStatus, type PlanSnapshot, type ExerciseEntry,
} from '@/lib/api';
import type { MealPlanEntry, Recipe, WorkoutPlan, NutritionInfo } from '@/types';

// ── constants ──────────────────────────────────────────────────────────────────

const SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
const SLOT_META: Record<string, { label: string; color: string; bg: string; glow: string }> = {
  breakfast: { label: 'Breakfast', color: '#f59e0b', bg: '#fffbeb', glow: 'rgba(245,158,11,0.15)' },
  lunch:     { label: 'Lunch',     color: '#10b981', bg: '#f0fdf4', glow: 'rgba(16,185,129,0.15)' },
  dinner:    { label: 'Dinner',    color: '#6366f1', bg: '#eef2ff', glow: 'rgba(99,102,241,0.15)' },
  snack:     { label: 'Snack',     color: '#f43f5e', bg: '#fff1f2', glow: 'rgba(244,63,94,0.15)'  },
};
const WORKOUT_TYPES = ['strength', 'cardio', 'hiit', 'yoga', 'running', 'cycling', 'other'];

// ── date helpers ───────────────────────────────────────────────────────────────

function isoWeekMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
}
function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function toIso(d: Date): string { return d.toISOString().split('T')[0]; }
function formatDay(s: string) {
  const d = new Date(s + 'T00:00:00');
  return { weekday: d.toLocaleDateString('en-US', { weekday: 'short' }), date: d.getDate() };
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

function Ring({ pct, color, size = 72, track = '#e2e8f0' }: {
  pct: number; color: string; size?: number; track?: string;
}) {
  const [cur, setCur] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setCur(pct), 150);
    return () => clearTimeout(t);
  }, [pct]);
  const r = (size - 9) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * Math.min(cur, 1);
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={7} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={7}
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
    let frame = 0;
    const total = 70;
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

function StatCard({ label, value, max, color, unit = '', delay = 0 }: {
  label: string; value: number; max: number; color: string; unit?: string; delay?: number;
}) {
  const pct = max > 0 ? value / max : 0;
  const pctLabel = max > 0 ? Math.round(pct * 100) : 0;
  return (
    <div style={{
      background: '#fff',
      borderRadius: 20,
      padding: '20px 22px',
      display: 'flex',
      alignItems: 'center',
      gap: 18,
      boxShadow: '0 2px 16px rgba(15,23,42,0.06)',
      border: '1px solid #e8edf5',
      animation: 'dashFadeUp 0.55s ease both',
      animationDelay: `${delay}ms`,
      flex: 1,
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(15,23,42,0.11)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 2px 16px rgba(15,23,42,0.06)'; }}>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <Ring pct={pct} color={color} size={76} />
        <span style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 700, color, transform: 'rotate(0deg)',
        }}>{pctLabel}%</span>
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.07em', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 }}>{label}</p>
        <p style={{ fontSize: 36, fontWeight: 800, color: '#0f172a', lineHeight: 1, letterSpacing: '-1px' }}>
          <CountUp to={value} />{unit}
        </p>
        <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 5 }}>of {max.toLocaleString()}{unit}</p>
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
    <div style={{ border: '2px solid #0f172a', borderRadius: 10, padding: '12px 14px' }}>
      <p style={{ fontWeight: 900, fontSize: 20, color: '#0f172a', borderBottom: '8px solid #0f172a', paddingBottom: 4, marginBottom: 4 }}>Nutrition Facts</p>
      <p style={{ fontSize: 12, color: '#0f172a', borderBottom: '1px solid #cbd5e1', paddingBottom: 4, marginBottom: 4 }}>Per serving</p>
      {cal != null && (
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', borderBottom: '4px solid #0f172a', paddingBottom: 4, marginBottom: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>Calories</span>
          <span style={{ fontWeight: 900, fontSize: 32, color: '#0f172a' }}>{cal}</span>
        </div>
      )}
      {rows.map(([label, val, unit]) => val != null && (
        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, borderBottom: '1px solid #e2e8f0', paddingBottom: 3, marginBottom: 2 }}>
          <span style={{ color: '#0f172a', paddingLeft: label.startsWith('  ') ? 12 : 0, fontWeight: label.startsWith('  ') ? 400 : 600 }}>{label.trim()}</span>
          <span style={{ color: '#0f172a' }}><strong>{Math.round(val * 10) / 10}</strong>{unit}</span>
        </div>
      ))}
    </div>
  );
}

// ── workout entry modal ────────────────────────────────────────────────────────

interface WorkoutFormState {
  planned_date: string; is_rest_day: boolean; workout_type: string;
  title: string; duration_minutes: string; notes: string; exercises: ExerciseEntry[];
}

function WorkoutModal({ date, existing, onClose, onSaved }: {
  date: string; existing: WorkoutPlan | null; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState<WorkoutFormState>({
    planned_date: date,
    is_rest_day: existing?.is_rest_day ?? false,
    workout_type: existing?.workout_type ?? '',
    title: existing?.title ?? '',
    duration_minutes: existing?.duration_minutes ? String(existing.duration_minutes) : '',
    notes: existing?.notes ?? '',
    exercises: (existing?.exercises as unknown as ExerciseEntry[]) ?? [],
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  function setField<K extends keyof WorkoutFormState>(k: K, v: WorkoutFormState[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }
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
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Save failed.'); }
    finally { setSaving(false); }
  }
  async function handleDelete() {
    if (!existing?.id) return;
    setSaving(true);
    try { await deleteWorkoutEntry(existing.id); onSaved(); }
    catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Delete failed.'); setSaving(false); }
  }

  const inp: React.CSSProperties = { height: 44, padding: '0 14px', border: '1.5px solid #e2e8f0', borderRadius: 10, color: '#0f172a', background: '#fff', width: '100%', fontSize: 14, outline: 'none' };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-lg flex flex-col" style={{ background: '#fff', borderRadius: 24, maxHeight: '90vh', boxShadow: '0 32px 80px rgba(15,23,42,0.2)', animation: 'modalIn 0.25s ease' }}>
        <div className="h-1.5 rounded-t-[24px]" style={{ background: 'linear-gradient(90deg,#14b8a6,#0d9488)' }} />
        <div className="px-6 pt-4 pb-3 flex items-center justify-between" style={{ borderBottom: '1px solid #f1f5f9' }}>
          <h3 className="font-bold text-base" style={{ color: '#0f172a' }}>
            {existing ? 'Edit workout' : 'Log workout'} — {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full" style={{ color: '#94a3b8', background: '#f8fafc' }}>✕</button>
        </div>
        <div className="overflow-y-auto px-6 py-5 space-y-4">
          {err && <p className="text-sm" style={{ color: '#ef4444' }}>{err}</p>}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_rest_day} onChange={e => setField('is_rest_day', e.target.checked)} className="w-4 h-4 rounded" />
            <span className="text-sm font-medium" style={{ color: '#0f172a' }}>Rest day</span>
          </label>
          {!form.is_rest_day && (
            <>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#94a3b8' }}>Title *</label>
                <input value={form.title} onChange={e => setField('title', e.target.value)} placeholder="e.g. Upper body push" style={inp} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: '#94a3b8' }}>Type</label>
                  <select value={form.workout_type} onChange={e => setField('workout_type', e.target.value)} style={inp}>
                    <option value="">Select…</option>
                    {WORKOUT_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: '#94a3b8' }}>Duration (min)</label>
                  <input type="number" value={form.duration_minutes} onChange={e => setField('duration_minutes', e.target.value)} placeholder="45" style={inp} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold" style={{ color: '#94a3b8' }}>Exercises</label>
                  <button onClick={addExercise} className="text-xs font-semibold" style={{ color: '#14b8a6' }}>+ Add</button>
                </div>
                <div className="space-y-2">
                  {form.exercises.map((ex, i) => (
                    <div key={i} className="rounded-xl p-3" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                      <div className="flex items-center gap-2 mb-2">
                        <input value={ex.name} onChange={e => setEx(i, 'name', e.target.value)} placeholder="Exercise name" className="flex-1 text-sm focus:outline-none bg-transparent" style={{ color: '#0f172a', borderBottom: '1px solid #e2e8f0', paddingBottom: 2 }} />
                        <button onClick={() => removeEx(i)} className="text-xs" style={{ color: '#94a3b8' }}>✕</button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input type="number" value={ex.sets ?? ''} onChange={e => setEx(i, 'sets', e.target.value)} placeholder="Sets" className="text-sm focus:outline-none bg-white rounded-lg px-3" style={{ height: 34, border: '1px solid #e2e8f0', color: '#0f172a' }} />
                        <input value={(ex.reps as string) ?? ''} onChange={e => setEx(i, 'reps', e.target.value)} placeholder="Reps / duration" className="text-sm focus:outline-none bg-white rounded-lg px-3" style={{ height: 34, border: '1px solid #e2e8f0', color: '#0f172a' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#94a3b8' }}>Notes</label>
                <textarea value={form.notes} onChange={e => setField('notes', e.target.value)} placeholder="Any notes…" rows={2} className="w-full text-sm focus:outline-none resize-none" style={{ padding: '10px 14px', border: '1.5px solid #e2e8f0', borderRadius: 10, color: '#0f172a' }} />
              </div>
            </>
          )}
        </div>
        <div className="px-6 pb-5 flex gap-2">
          {existing && <button onClick={handleDelete} disabled={saving} className="text-sm font-medium px-4" style={{ height: 44, borderRadius: 12, border: '1px solid #fca5a5', color: '#ef4444', background: '#fff' }}>Delete</button>}
          <button onClick={onClose} className="flex-1 text-sm font-medium" style={{ height: 44, borderRadius: 12, border: '1px solid #e2e8f0', color: '#64748b', background: '#fff' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 text-sm font-semibold text-white disabled:opacity-40" style={{ height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#14b8a6,#0d9488)' }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
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
    try {
      const r = await restorePlanSnapshot(id);
      alert(`Restored ${r.meals_restored} meals.`);
      onRestored();
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Restore failed.'); setRestoring(null); }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-sm" style={{ background: '#fff', borderRadius: 24, boxShadow: '0 32px 80px rgba(15,23,42,0.2)', animation: 'modalIn 0.25s ease' }}>
        <div className="px-6 pt-5 pb-4 flex items-center justify-between" style={{ borderBottom: '1px solid #f1f5f9' }}>
          <h3 className="font-bold text-base" style={{ color: '#0f172a' }}>Previous plans</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full" style={{ color: '#94a3b8', background: '#f8fafc' }}>✕</button>
        </div>
        <div className="px-6 py-4 space-y-2 min-h-[80px]">
          {err && <p className="text-sm" style={{ color: '#ef4444' }}>{err}</p>}
          {loading && <p className="text-sm" style={{ color: '#94a3b8' }}>Loading…</p>}
          {!loading && snaps.length === 0 && <p className="text-sm" style={{ color: '#94a3b8' }}>No snapshots yet — regenerate once to save a version.</p>}
          {snaps.map((s, i) => (
            <div key={s.id} className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div>
                <p className="text-sm font-semibold" style={{ color: '#0f172a' }}>Snapshot {i + 1}</p>
                <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>{formatTs(s.created_at)}</p>
              </div>
              <button onClick={() => handleRestore(s.id)} disabled={restoring !== null} className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-40" style={{ background: '#0f172a' }}>
                {restoring === s.id ? 'Restoring…' : 'Restore'}
              </button>
            </div>
          ))}
        </div>
        <div className="px-6 pb-5">
          <button onClick={onClose} className="w-full text-sm font-medium" style={{ height: 44, borderRadius: 12, border: '1px solid #e2e8f0', color: '#64748b' }}>Close</button>
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

  // today's stats
  const todayEntries = plan[today] || [];
  const todayCal  = Math.round(todayEntries.reduce((s, e) => s + (e.recipe?.nutrition?.calories ?? 0), 0));
  const todayProt = Math.round(todayEntries.reduce((s, e) => s + (e.recipe?.nutrition?.protein_g ?? 0), 0));
  const todayMeals = todayEntries.length;
  const weekWorkouts = weekDays.filter(d => workouts[d] && !workouts[d].is_rest_day).length;
  const todayWorkout = workouts[today];

  const totalMealsWeek = Object.values(plan).flat().length;
  const upgraded = searchParams?.get('upgraded') === '1';

  async function handleAdd() {
    if (!selectedRecipeId || !adding) return;
    setSaving(true); setAddError('');
    try {
      await addMealPlan({ recipe_id: selectedRecipeId, planned_date: adding.date, meal_slot: adding.slot });
      setAdding(null); setSelectedRecipeId(''); fetchPlan();
    } catch (e) { setAddError((e as Error).message); }
    finally { setSaving(false); }
  }

  async function handleDeleteMeal(id: string) {
    try { await deleteMealPlan(id); fetchPlan(); } catch {}
  }

  return (
    <>
      {/* CSS keyframe animations */}
      <style>{`
        @keyframes dashFadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes greetingSlide {
          from { opacity: 0; transform: translateY(-10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0%   { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
        .plan-cell { transition: background 0.15s ease, box-shadow 0.15s ease; }
        .plan-cell:hover { background: rgba(255,255,255,0.9) !important; }
        .meal-chip { transition: transform 0.15s ease, box-shadow 0.15s ease; }
        .meal-chip:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.1) !important; }
        .add-btn { opacity: 0; transition: opacity 0.15s ease; }
        .plan-cell:hover .add-btn { opacity: 1; }
      `}</style>

      <div style={{ minHeight: '100%', background: '#edf1f7', padding: '28px 28px 48px' }}>

        {/* ── upgrade success ── */}
        {upgraded && (
          <div style={{ background: 'linear-gradient(135deg,#d1fae5,#a7f3d0)', border: '1px solid #6ee7b7', borderRadius: 16, padding: '12px 18px', marginBottom: 20, color: '#065f46', fontSize: 14, fontWeight: 600, animation: 'dashFadeUp 0.4s ease' }}>
            ✓ Plan upgraded successfully — enjoy your AI generations!
          </div>
        )}

        {/* ── greeting card ── */}
        <div style={{
          background: 'linear-gradient(135deg, #0c0c18 0%, #1a1a2e 50%, #0f0f1e 100%)',
          borderRadius: 24,
          padding: '32px 36px',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 8px 32px rgba(12,12,24,0.35)',
          animation: 'greetingSlide 0.5s ease',
          overflow: 'hidden',
          position: 'relative',
        }}>
          {/* decorative orbs */}
          <div style={{ position: 'absolute', top: -40, right: 120, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle,rgba(99,102,241,0.18) 0%,transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: -30, right: 40, width: 140, height: 140, borderRadius: '50%', background: 'radial-gradient(circle,rgba(20,184,166,0.15) 0%,transparent 70%)', pointerEvents: 'none' }} />

          <div style={{ position: 'relative' }}>
            <p style={{ fontSize: 15, fontWeight: 600, letterSpacing: '0.06em', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: 10 }}>{timeGreeting()}</p>
            <h1 style={{ fontSize: 38, fontWeight: 800, color: '#fff', letterSpacing: '-1px', lineHeight: 1.1, marginBottom: 14 }}>
              {todayLabel()}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 16, color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#6366f1', display: 'inline-block' }} />
                {totalMealsWeek} meals this week
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 16, color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#14b8a6', display: 'inline-block' }} />
                {weekWorkouts} active day{weekWorkouts !== 1 ? 's' : ''}
              </span>
              {todayWorkout && !todayWorkout.is_rest_day && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 16, color: '#5eead4', fontWeight: 600 }}>
                  <span>↑</span> {todayWorkout.title} today
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative', flexShrink: 0 }}>
            {subStatus && (
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>AI plan</p>
                <p style={{ fontSize: 28, fontWeight: 800, color: '#fff' }}>{subStatus.generations_remaining}</p>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>generation{subStatus.generations_remaining !== 1 ? 's' : ''} left</p>
                <a href="/pricing" style={{ display: 'inline-block', marginTop: 8, fontSize: 13, fontWeight: 700, color: '#fff', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '5px 14px', textDecoration: 'none' }}>
                  {subStatus.plan_type === 'free' ? 'Upgrade ↗' : 'Manage'}
                </a>
              </div>
            )}
          </div>
        </div>

        {/* ── stat cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
          <StatCard label="Today's Calories" value={todayCal}  max={2000} color="#3b82f6" unit=" cal" delay={0}   />
          <StatCard label="Today's Protein"  value={todayProt} max={150}  color="#10b981" unit="g"    delay={80}  />
          <StatCard label="Meals Today"      value={todayMeals} max={4}   color="#8b5cf6" unit=""     delay={160} />
          <StatCard label="Active Days"      value={weekWorkouts} max={7} color="#14b8a6" unit=""     delay={240} />
        </div>

        {/* ── week nav ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 26, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.5px' }}>Weekly Plan</h2>
            <p style={{ fontSize: 15, color: '#94a3b8', marginTop: 3 }}>{monthLabel}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => setShowRestore(true)} style={{ height: 40, padding: '0 16px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              ↩ Restore
            </button>
            <button onClick={() => setMonday(d => addDays(d, -7))} style={{ width: 40, height: 40, borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', color: '#0f172a', fontSize: 18, cursor: 'pointer' }}>←</button>
            <button onClick={() => setMonday(isoWeekMonday(new Date()))} style={{ height: 40, padding: '0 16px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', color: '#0f172a', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Today</button>
            <button onClick={() => setMonday(d => addDays(d, 7))} style={{ width: 40, height: 40, borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', color: '#0f172a', fontSize: 18, cursor: 'pointer' }}>→</button>
          </div>
        </div>

        {/* ── weekly grid ── */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 10 }}>
            {weekDays.map(d => (
              <div key={d} style={{ borderRadius: 18, height: 360, background: 'linear-gradient(90deg,#e8edf5 25%,#f1f5fb 50%,#e8edf5 75%)', backgroundSize: '400px 100%', animation: 'shimmer 1.4s infinite linear' }} />
            ))}
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
                  background: isToday ? 'rgba(255,255,255,0.98)' : 'rgba(255,255,255,0.75)',
                  borderRadius: 18,
                  overflow: 'hidden',
                  boxShadow: isToday ? '0 4px 20px rgba(99,102,241,0.12)' : '0 2px 8px rgba(15,23,42,0.05)',
                  border: isToday ? '1.5px solid rgba(99,102,241,0.25)' : '1px solid rgba(226,232,240,0.8)',
                  animation: `dashFadeUp 0.5s ease ${di * 50}ms both`,
                  display: 'flex',
                  flexDirection: 'column',
                }}>
                  {/* day header */}
                  <div style={{
                    padding: '14px 14px 10px',
                    borderBottom: '1px solid #f1f5f9',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                    background: isToday ? 'linear-gradient(135deg,rgba(99,102,241,0.05),rgba(20,184,166,0.04))' : 'transparent',
                  }}>
                    <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', color: isToday ? '#6366f1' : '#94a3b8', textTransform: 'uppercase' }}>{weekday}</span>
                    <span style={{
                      width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16, fontWeight: 700,
                      background: isToday ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'transparent',
                      color: isToday ? '#fff' : '#0f172a',
                    }}>{date}</span>
                  </div>

                  {/* workout slot */}
                  <div className="group plan-cell" style={{ padding: '8px 10px', borderBottom: '1px solid #f1f5f9', minHeight: 56, position: 'relative' }}>
                    {w ? (
                      w.is_rest_day ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 500, fontStyle: 'italic' }}>Rest day</span>
                          <button onClick={() => setWorkoutDate(day)} className="add-btn" style={{ fontSize: 12, color: '#14b8a6', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Edit</button>
                        </div>
                      ) : (
                        <div style={{ position: 'relative' }}>
                          <button onClick={() => setSelectedWorkout(w)} style={{ width: '100%', textAlign: 'left', background: 'linear-gradient(135deg,#f0fdfa,#ccfbf1)', borderRadius: 10, padding: '7px 10px', border: '1px solid rgba(20,184,166,0.2)', cursor: 'pointer' }}>
                            <p style={{ fontSize: 13, fontWeight: 700, color: '#0d9488', lineHeight: 1.3 }} className="truncate">{w.title}</p>
                            {w.duration_minutes && <p style={{ fontSize: 12, color: '#0d9488', opacity: 0.7, marginTop: 2 }}>{w.duration_minutes} min</p>}
                          </button>
                          <button onClick={() => setWorkoutDate(day)} className="add-btn" style={{ position: 'absolute', top: 4, right: 4, fontSize: 11, fontWeight: 700, color: '#fff', background: '#0d9488', border: 'none', borderRadius: 5, padding: '2px 7px', cursor: 'pointer' }}>Edit</button>
                        </div>
                      )
                    ) : (
                      <button onClick={() => setWorkoutDate(day)} className="add-btn" style={{ width: '100%', textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#14b8a6', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}>
                        + Log workout
                      </button>
                    )}
                    {/* workout label */}
                    <span style={{ position: 'absolute', top: 8, left: 10, fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: '#14b8a6', textTransform: 'uppercase', opacity: w ? 0 : 0.6 }}>Workout</span>
                  </div>

                  {/* meal slots */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    {SLOTS.map((slot) => {
                      const entries = dayEntries.filter(e => e.meal_slot === slot);
                      const meta = SLOT_META[slot];
                      return (
                        <div key={slot} className="group plan-cell" style={{ padding: '8px 10px', flex: 1, minHeight: 70, borderBottom: slot !== 'snack' ? '1px solid #f1f5f9' : 'none', position: 'relative' }}>
                          {/* slot label — only show on first column or if has content */}
                          {(di === 0 || entries.length > 0) && (
                            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', color: meta.color, textTransform: 'uppercase', opacity: 0.7, display: 'block', marginBottom: 4 }}>{meta.label}</span>
                          )}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {entries.map(entry => (
                              <div key={entry.id} className="meal-chip" style={{ background: meta.bg, border: `1px solid ${meta.color}25`, borderRadius: 9, padding: '6px 8px', cursor: 'pointer', position: 'relative' }}
                                onClick={() => setSelectedMeal(entry)}>
                                <span style={{ fontSize: 13, fontWeight: 600, color: meta.color, display: 'block', lineHeight: 1.3 }} className="truncate">{entry.recipe?.title}</span>
                                {entry.recipe?.nutrition?.calories != null && (
                                  <span style={{ fontSize: 12, color: meta.color, opacity: 0.65 }}>
                                    {Math.round(entry.recipe.nutrition.calories / 10) * 10} cal
                                    {entry.recipe.nutrition.protein_g != null ? ` · ${Math.round(entry.recipe.nutrition.protein_g)}g P` : ''}
                                  </span>
                                )}
                                <button onClick={e => { e.stopPropagation(); handleDeleteMeal(entry.id); }}
                                  style={{ position: 'absolute', top: 4, right: 5, fontSize: 12, color: meta.color, background: 'none', border: 'none', cursor: 'pointer', opacity: 0, transition: 'opacity 0.15s' }}
                                  className="add-btn">✕</button>
                              </div>
                            ))}
                          </div>
                          <button className="add-btn" onClick={() => { setAdding({ date: day, slot }); setSelectedRecipeId(''); setAddError(''); }}
                            style={{ width: '100%', textAlign: 'center', fontSize: 13, fontWeight: 600, color: meta.color, background: 'none', border: 'none', cursor: 'pointer', paddingTop: 4 }}>
                            + Add
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── meal detail modal ── */}
        {selectedMeal && (
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(10px)' }} onClick={() => setSelectedMeal(null)}>
            <div className="w-full max-w-lg flex flex-col" style={{ background: '#fff', borderRadius: 24, maxHeight: '88vh', boxShadow: '0 32px 80px rgba(15,23,42,0.2)', animation: 'modalIn 0.25s ease' }} onClick={e => e.stopPropagation()}>
              <div className="h-1.5 rounded-t-[24px]" style={{ background: `linear-gradient(90deg,${SLOT_META[selectedMeal.meal_slot]?.color},${SLOT_META[selectedMeal.meal_slot]?.color}aa)` }} />
              <div style={{ padding: '18px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>{selectedMeal.recipe?.title}</h3>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', padding: '3px 10px', borderRadius: 20, color: SLOT_META[selectedMeal.meal_slot]?.color, background: SLOT_META[selectedMeal.meal_slot]?.bg }}>{SLOT_META[selectedMeal.meal_slot]?.label}</span>
                    {selectedMeal.recipe?.cuisine && <span style={{ fontSize: 12, color: '#94a3b8' }}>{selectedMeal.recipe.cuisine}</span>}
                    {(selectedMeal.recipe?.prep_time || selectedMeal.recipe?.cook_time) && <span style={{ fontSize: 12, color: '#94a3b8' }}>⏱ {(selectedMeal.recipe!.prep_time || 0) + (selectedMeal.recipe!.cook_time || 0)} min</span>}
                  </div>
                </div>
                <button onClick={() => setSelectedMeal(null)} style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: '#f8fafc', color: '#94a3b8', fontSize: 16, cursor: 'pointer', flexShrink: 0, marginLeft: 12 }}>✕</button>
              </div>
              <div style={{ overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                {selectedMeal.recipe?.nutrition?.calories != null && <NutritionLabel n={selectedMeal.recipe.nutrition} />}
                {selectedMeal.recipe?.description && <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.6 }}>{selectedMeal.recipe.description}</p>}
                {selectedMeal.recipe?.ingredients?.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 12 }}>Ingredients</h4>
                    <ul style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {selectedMeal.recipe.ingredients.map((ing, i) => (
                        <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, color: '#0f172a' }}>
                          <span style={{ marginTop: 6, width: 6, height: 6, borderRadius: '50%', background: SLOT_META[selectedMeal.meal_slot]?.color, flexShrink: 0 }} />
                          <span><strong>{ing.quantity} {ing.unit}</strong> {ing.name}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {selectedMeal.recipe?.steps?.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 12 }}>Steps</h4>
                    <ol style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {selectedMeal.recipe.steps.map((step, i) => (
                        <li key={i} style={{ display: 'flex', gap: 12, fontSize: 14, color: '#0f172a' }}>
                          <span style={{ flexShrink: 0, width: 24, height: 24, borderRadius: '50%', background: '#f1f5f9', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{i + 1}</span>
                          <span style={{ paddingTop: 3, lineHeight: 1.5 }}>{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── workout detail modal ── */}
        {selectedWorkout && !workoutDate && (
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(10px)' }} onClick={() => setSelectedWorkout(null)}>
            <div className="w-full max-w-md flex flex-col" style={{ background: '#fff', borderRadius: 24, maxHeight: '88vh', boxShadow: '0 32px 80px rgba(15,23,42,0.2)', animation: 'modalIn 0.25s ease' }} onClick={e => e.stopPropagation()}>
              <div className="h-1.5 rounded-t-[24px]" style={{ background: 'linear-gradient(90deg,#14b8a6,#0d9488)' }} />
              <div style={{ padding: '18px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{selectedWorkout.title}</h3>
                  <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                    {selectedWorkout.workout_type && <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', padding: '3px 10px', borderRadius: 20, color: '#0d9488', background: '#f0fdfa' }}>{selectedWorkout.workout_type}</span>}
                    {selectedWorkout.duration_minutes && <span style={{ fontSize: 12, color: '#94a3b8' }}>⏱ {selectedWorkout.duration_minutes} min</span>}
                  </div>
                </div>
                <button onClick={() => setSelectedWorkout(null)} style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: '#f8fafc', color: '#94a3b8', fontSize: 16, cursor: 'pointer', marginLeft: 12 }}>✕</button>
              </div>
              <div style={{ overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(selectedWorkout.exercises as unknown as ExerciseEntry[])?.map((ex, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#f8fafc', borderRadius: 14, padding: '12px 16px', border: '1px solid #e2e8f0' }}>
                    <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#14b8a6,#0d9488)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{ex.name}</p>
                      {(ex.sets || ex.reps) && <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{ex.sets && `${ex.sets} sets`}{ex.sets && ex.reps && ' × '}{ex.reps && `${ex.reps}`}</p>}
                    </div>
                  </div>
                ))}
                {selectedWorkout.notes && <p style={{ fontSize: 14, color: '#94a3b8', marginTop: 4 }}>{selectedWorkout.notes}</p>}
              </div>
            </div>
          </div>
        )}

        {/* ── workout entry modal ── */}
        {workoutDate && (
          <WorkoutModal
            date={workoutDate}
            existing={workouts[workoutDate] ?? null}
            onClose={() => { setWorkoutDate(null); setSelectedWorkout(null); }}
            onSaved={() => { setWorkoutDate(null); setSelectedWorkout(null); fetchWorkouts(); }}
          />
        )}

        {/* ── restore modal ── */}
        {showRestore && (
          <RestoreModal
            weekStart={toIso(monday)}
            onClose={() => setShowRestore(false)}
            onRestored={() => { setShowRestore(false); fetchPlan(); }}
          />
        )}

        {/* ── add meal modal ── */}
        {adding && (
          <div className="fixed inset-0 flex items-end sm:items-center justify-center z-50 p-4" style={{ background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(10px)' }}>
            <div style={{ background: '#fff', borderRadius: 24, boxShadow: '0 32px 80px rgba(15,23,42,0.2)', padding: 24, width: '100%', maxWidth: 380, animation: 'modalIn 0.25s ease' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', padding: '3px 10px', borderRadius: 20, color: SLOT_META[adding.slot].color, background: SLOT_META[adding.slot].bg }}>{SLOT_META[adding.slot].label}</span>
              </div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: addError ? 0 : 16 }}>
                {new Date(adding.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </h3>
              {addError && <p style={{ fontSize: 12, color: '#ef4444', margin: '8px 0' }}>{addError}</p>}
              <div style={{ marginBottom: 16 }}>
                {recipes.length === 0 ? (
                  <p style={{ fontSize: 14, color: '#94a3b8', textAlign: 'center', padding: '16px 0' }}>No recipes yet. Add some first.</p>
                ) : (
                  <select value={selectedRecipeId} onChange={e => setSelectedRecipeId(e.target.value)}
                    style={{ width: '100%', height: 48, padding: '0 14px', border: '1.5px solid #e2e8f0', borderRadius: 12, color: selectedRecipeId ? '#0f172a' : '#94a3b8', background: '#fff', fontSize: 14, outline: 'none' }}>
                    <option value="">Choose a recipe…</option>
                    {recipes.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
                  </select>
                )}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setAdding(null)} style={{ flex: 1, height: 44, borderRadius: 12, border: '1px solid #e2e8f0', color: '#64748b', background: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleAdd} disabled={!selectedRecipeId || saving}
                  style={{ flex: 1, height: 44, borderRadius: 12, background: '#0f172a', color: '#fff', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer', opacity: (!selectedRecipeId || saving) ? 0.4 : 1 }}>
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
