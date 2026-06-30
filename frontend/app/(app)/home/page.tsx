'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  getWeeklyPlan, getWeeklyWorkouts, isLoggedIn, getProfile,
  getFoodLog, addFoodLog, deleteFoodLog, getRecipes,
} from '@/lib/api';
import type { MealPlanEntry, WorkoutPlan, FoodLogEntry, Recipe } from '@/types';

const BLUE = '#3b82f6';
const SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
const SLOT_LABELS: Record<string, string> = {
  breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack',
};

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function isoWeekMonday(d: Date): Date {
  const date = new Date(d); const day = date.getDay();
  date.setDate(date.getDate() - day + (day === 0 ? -6 : 1)); return date;
}
function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function calcStreak(days: string[], today: string): number {
  const set = new Set(days);
  let streak = 0;
  const d = new Date();
  if (!set.has(today)) d.setDate(d.getDate() - 1);
  while (set.has(toIso(d))) { streak++; d.setDate(d.getDate() - 1); }
  return streak;
}

// ── Recipe detail modal ────────────────────────────────────────────────────────

function RecipeModal({ entry, onClose }: { entry: MealPlanEntry; onClose: () => void }) {
  const r = entry.recipe;
  const slot = SLOT_LABELS[entry.meal_slot] ?? entry.meal_slot;
  const cal = r?.nutrition?.calories != null ? Math.round(r.nutrition.calories / 10) * 10 : null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(10px)' }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-card)', borderRadius: 20, width: '100%', maxWidth: 460,
          maxHeight: '88vh', display: 'flex', flexDirection: 'column',
          border: '1px solid var(--border-color)', animation: 'modalIn 0.22s ease',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Blue accent top bar */}
        <div style={{ height: 3, borderRadius: '20px 20px 0 0', background: BLUE }} />

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
            <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', padding: '3px 10px', borderRadius: 20, color: BLUE, background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.2)' }}>
              {slot}
            </span>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginTop: 8, lineHeight: 1.2 }}>{r?.title ?? 'Recipe'}</h3>
            <div style={{ display: 'flex', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
              {cal != null && <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{cal} cal</span>}
              {r?.cuisine && <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{r.cuisine}</span>}
              {(r?.prep_time || r?.cook_time) && (
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                  {(r.prep_time ?? 0) + (r.cook_time ?? 0)} min
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-soft)', color: 'var(--text-tertiary)', fontSize: 14, cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {r?.description && (
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.65 }}>{r.description}</p>
          )}

          {/* Nutrition row */}
          {r?.nutrition && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
              {[
                { label: 'Calories', value: cal, unit: '' },
                { label: 'Protein', value: r.nutrition.protein_g != null ? Math.round(r.nutrition.protein_g) : null, unit: 'g' },
                { label: 'Carbs', value: r.nutrition.carbs_g != null ? Math.round(r.nutrition.carbs_g) : null, unit: 'g' },
                { label: 'Fat', value: r.nutrition.fat_g != null ? Math.round(r.nutrition.fat_g) : null, unit: 'g' },
              ].filter(n => n.value != null).map(({ label, value, unit }) => (
                <div key={label} style={{ background: 'var(--bg-soft)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                  <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>{value}{unit}</p>
                  <p style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Ingredients */}
          {r?.ingredients?.length > 0 && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 10 }}>Ingredients</p>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {r.ingredients.map((ing, i) => (
                  <li key={i} style={{ display: 'flex', gap: 10, fontSize: 13, color: 'var(--text-primary)' }}>
                    <span style={{ marginTop: 5, width: 5, height: 5, borderRadius: '50%', background: BLUE, flexShrink: 0 }} />
                    <span><strong>{ing.quantity} {ing.unit}</strong> {ing.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Steps */}
          {r?.steps?.length > 0 && (
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 10 }}>Steps</p>
              <ol style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {r.steps.map((step, i) => (
                  <li key={i} style={{ display: 'flex', gap: 12, fontSize: 13, color: 'var(--text-primary)' }}>
                    <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: '50%', background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.2)', color: BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>{i + 1}</span>
                    <span style={{ paddingTop: 2, lineHeight: 1.55 }}>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Circular progress ring ─────────────────────────────────────────────────────

function Ring({ pct, color, size = 54 }: { pct: number; color: string; size?: number }) {
  const stroke = 4.5;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(pct, 1));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)', display: 'block' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg-soft)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(0.4,0,0.2,1)' }} />
    </svg>
  );
}

// ── Task card ──────────────────────────────────────────────────────────────────

function MealTaskCard({
  entry, slotLabel, done,
  onToggle, onViewDetail,
}: {
  entry: MealPlanEntry; slotLabel: string; done: boolean;
  onToggle: (e: React.MouseEvent) => void;
  onViewDetail: () => void;
}) {
  const cal = entry.recipe?.nutrition?.calories;
  const prot = entry.recipe?.nutrition?.protein_g;

  return (
    <div
      onClick={onViewDetail}
      style={{
        display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer',
        background: done ? 'rgba(34,197,94,0.03)' : 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderLeft: done ? '3px solid #22c55e' : '3px solid rgba(59,130,246,0.45)',
        borderRadius: 12, padding: '12px 16px',
        opacity: done ? 0.7 : 1,
        transition: 'all 0.2s ease',
      }}
    >
      {/* Checkbox — separate click target */}
      <button
        onClick={onToggle}
        style={{
          flexShrink: 0, width: 26, height: 26, borderRadius: '50%',
          border: done ? 'none' : '2px solid var(--border-color)',
          background: done ? '#22c55e' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', transition: 'all 0.2s ease',
        }}
      >
        {done && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1.5,6 4.5,9.5 10.5,2.5" />
          </svg>
        )}
      </button>

      {/* Slot label */}
      <div style={{ flexShrink: 0, width: 54 }}>
        <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: done ? '#22c55e' : BLUE }}>
          {slotLabel}
        </p>
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', textDecoration: done ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {entry.recipe?.title ?? 'Untitled'}
        </p>
        {entry.recipe?.description && (
          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {entry.recipe.description}
          </p>
        )}
      </div>

      {/* Nutrition — only shown once completed */}
      {done && cal != null && (
        <div style={{ flexShrink: 0, textAlign: 'right' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)' }}>
            {Math.round(cal / 10) * 10} cal
          </p>
          {prot != null && (
            <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>{Math.round(prot)}g protein</p>
          )}
        </div>
      )}

      {/* Chevron hint */}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-placeholder)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter();
  const today = toIso(new Date());
  const monday = isoWeekMonday(new Date());

  const [plan, setPlan] = useState<Record<string, MealPlanEntry[]>>({});
  const [workout, setWorkout] = useState<WorkoutPlan | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [checked, setChecked] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const ids: string[] = JSON.parse(localStorage.getItem('meal_completions') || '[]');
      const result = Object.fromEntries(ids.map(id => [id, true]));
      const workoutMap: Record<string, boolean> = JSON.parse(localStorage.getItem('workout_completions') || '{}');
      if (workoutMap[toIso(new Date())]) result['__workout__'] = true;
      return result;
    } catch { return {}; }
  });
  const [selectedMeal, setSelectedMeal] = useState<MealPlanEntry | null>(null);
  const [foodLog, setFoodLog] = useState<FoodLogEntry[]>([]);
  // log-planned-meal modal
  const [logModal, setLogModal] = useState<{ entry: MealPlanEntry; servings: number } | null>(null);
  const [logging, setLogging] = useState(false);
  // add-food modal
  const [allRecipes, setAllRecipes] = useState<Recipe[]>([]);
  const [addModal, setAddModal] = useState<string | null>(null); // slot name
  const [addTab, setAddTab] = useState<'search' | 'manual'>('search');
  const [addQuery, setAddQuery] = useState('');
  const [addForm, setAddForm] = useState({ name: '', calories: '', protein_g: '', carbs_g: '', fat_g: '' });
  const [addingFood, setAddingFood] = useState(false);
  const [calorieGoal, setCalorieGoal] = useState(2000);
  const [proteinGoal, setProteinGoal] = useState(150);
  const [carbsGoal, setCarbsGoal] = useState(250);
  const [fatGoal, setFatGoal] = useState(65);
  const [waterGoal, setWaterGoal] = useState(8);
  const [water, setWater] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    try { const logs: Record<string, number> = JSON.parse(localStorage.getItem('water_logs') || '{}'); return logs[toIso(new Date())] ?? 0; } catch { return 0; }
  });
  const [streak, setStreak] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    try {
      const days: string[] = JSON.parse(localStorage.getItem('completed_days') || '[]');
      return calcStreak(days, toIso(new Date()));
    } catch { return 0; }
  });

  useEffect(() => {
    if (!isLoggedIn()) { router.push('/login'); return; }
    const weekStart = toIso(monday);
    Promise.all([
      getWeeklyPlan(weekStart),
      getWeeklyWorkouts(weekStart),
      getFoodLog(today),
    ])
      .then(([planData, workoutData, logData]) => {
        setPlan(planData?.days || {});
        setWorkout(workoutData?.workouts?.[today] ?? null);
        setFoodLog(logData || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    getRecipes({ page_size: 100 }).then(d => setAllRecipes(d?.recipes || [])).catch(() => {});
    getProfile().then(p => {
      if (!p) return;
      const pr = p as unknown as Record<string, number>;
      if (pr.calorie_goal) setCalorieGoal(pr.calorie_goal);
      if (pr.protein_goal_g) setProteinGoal(pr.protein_goal_g);
      if (pr.carbs_goal_g) setCarbsGoal(pr.carbs_goal_g);
      if (pr.fat_goal_g) setFatGoal(pr.fat_goal_g);
      if (pr.water_goal) setWaterGoal(pr.water_goal);
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const todayEntries = plan[today] || [];
  const todayCal = Math.round(foodLog.reduce((s, e) => s + (e.calories ?? 0), 0));
  const todayProt = Math.round(foodLog.reduce((s, e) => s + (e.protein_g ?? 0), 0));
  const todayCarbs = Math.round(foodLog.reduce((s, e) => s + (e.carbs_g ?? 0), 0));
  const todayFat = Math.round(foodLog.reduce((s, e) => s + (e.fat_g ?? 0), 0));

  const loggedRecipeIds = new Set(foodLog.map(e => e.recipe_id).filter(Boolean));
  const workoutIsActive = workout && !workout.is_rest_day;
  const mealsDone = todayEntries.filter(e => loggedRecipeIds.has(e.recipe?.id ?? '')).length;
  const workoutDone = !!checked['__workout__'];
  const totalTasks = todayEntries.length + (workoutIsActive ? 1 : 0);
  const completedCount = mealsDone + (workoutDone ? 1 : 0);
  const progress = totalTasks > 0 ? completedCount / totalTasks : 0;
  const allDone = totalTasks > 0 && completedCount === totalTasks;

  const dateLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  // Save streak when all tasks are done for the day
  React.useEffect(() => {
    if (!allDone || typeof window === 'undefined') return;
    try {
      const days: string[] = JSON.parse(localStorage.getItem('completed_days') || '[]');
      if (!days.includes(today)) {
        days.push(today);
        localStorage.setItem('completed_days', JSON.stringify(days));
        setStreak(calcStreak(days, today));
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDone]);

  function updateWater(delta: number) {
    setWater(w => {
      const next = Math.max(0, Math.min(w + delta, waterGoal * 2));
      try {
        const logs: Record<string, number> = JSON.parse(localStorage.getItem('water_logs') || '{}');
        logs[today] = next;
        localStorage.setItem('water_logs', JSON.stringify(logs));
      } catch {}
      return next;
    });
  }

  async function handleLogMeal(entry: MealPlanEntry, servings: number) {
    setLogging(true);
    const r = entry.recipe;
    try {
      const logged = await addFoodLog({
        recipe_id: r?.id ?? null,
        log_date: today,
        meal_slot: entry.meal_slot,
        name: r?.title ?? 'Meal',
        calories: r?.nutrition?.calories != null ? Math.round(r.nutrition.calories * servings) : null,
        protein_g: r?.nutrition?.protein_g != null ? Math.round(r.nutrition.protein_g * servings * 10) / 10 : null,
        carbs_g: r?.nutrition?.carbs_g != null ? Math.round(r.nutrition.carbs_g * servings * 10) / 10 : null,
        fat_g: r?.nutrition?.fat_g != null ? Math.round(r.nutrition.fat_g * servings * 10) / 10 : null,
        servings,
      });
      setFoodLog(prev => [...prev, logged]);
      setLogModal(null);
    } catch { /* silent */ }
    finally { setLogging(false); }
  }

  async function handleLogFromRecipe(recipe: Recipe) {
    if (!addModal) return;
    setAddingFood(true);
    try {
      const logged = await addFoodLog({
        recipe_id: recipe.id,
        log_date: today,
        meal_slot: addModal,
        name: recipe.title,
        calories: recipe.nutrition?.calories != null ? Math.round(recipe.nutrition.calories) : null,
        protein_g: recipe.nutrition?.protein_g ?? null,
        carbs_g: recipe.nutrition?.carbs_g ?? null,
        fat_g: recipe.nutrition?.fat_g ?? null,
        servings: 1,
      });
      setFoodLog(prev => [...prev, logged]);
      setAddModal(null); setAddQuery('');
    } catch { /* silent */ }
    finally { setAddingFood(false); }
  }

  async function handleAddManual() {
    if (!addModal || !addForm.name.trim()) return;
    setAddingFood(true);
    try {
      const logged = await addFoodLog({
        log_date: today,
        meal_slot: addModal,
        name: addForm.name.trim(),
        calories: addForm.calories ? parseFloat(addForm.calories) : null,
        protein_g: addForm.protein_g ? parseFloat(addForm.protein_g) : null,
        carbs_g: addForm.carbs_g ? parseFloat(addForm.carbs_g) : null,
        fat_g: addForm.fat_g ? parseFloat(addForm.fat_g) : null,
        servings: 1,
      });
      setFoodLog(prev => [...prev, logged]);
      setAddModal(null); setAddForm({ name: '', calories: '', protein_g: '', carbs_g: '', fat_g: '' });
    } catch { /* silent */ }
    finally { setAddingFood(false); }
  }

  async function handleDeleteLog(id: string) {
    setFoodLog(prev => prev.filter(e => e.id !== id));
    try { await deleteFoodLog(id); } catch { getFoodLog(today).then(setFoodLog).catch(() => {}); }
  }

  function toggleMeal(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    setChecked(c => {
      const next = { ...c, [id]: !c[id] };
      try {
        const ids = Object.entries(next).filter(([k, v]) => v && !k.startsWith('__')).map(([k]) => k);
        localStorage.setItem('meal_completions', JSON.stringify(ids));
      } catch {}
      return next;
    });
  }
  function toggleWorkout(e: React.MouseEvent) {
    e.stopPropagation();
    setChecked(c => {
      const next = { ...c, __workout__: !c.__workout__ };
      try {
        const workoutMap: Record<string, boolean> = JSON.parse(localStorage.getItem('workout_completions') || '{}');
        workoutMap[today] = !!next.__workout__;
        localStorage.setItem('workout_completions', JSON.stringify(workoutMap));
      } catch {}
      return next;
    });
  }

  return (
    <div style={{ minHeight: '100%', padding: '28px 28px 60px' }}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes modalIn { from { opacity:0; transform:scale(0.96) translateY(8px); } to { opacity:1; transform:scale(1) translateY(0); } }
        .meal-task:hover { box-shadow: 0 4px 16px rgba(59,130,246,0.1); }
        .qlink:hover { background: var(--bg-soft) !important; }
      `}</style>

      {/* ── Header ── */}
      <div style={{ marginBottom: 24, animation: 'fadeUp 0.4s ease' }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
          {greeting()}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <h1 style={{ fontSize: 30, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.6px', lineHeight: 1.1 }}>
            {dateLabel}
          </h1>
          {streak > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 26, padding: '0 10px', borderRadius: 99, background: 'rgba(251,146,60,0.12)', border: '1px solid rgba(251,146,60,0.25)', fontSize: 12, fontWeight: 700, color: '#f97316', flexShrink: 0 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="#f97316" stroke="none"><path d="M12 2C9.5 6 8 9 10 13c-2-1-3-3-3-5C4.5 11 3 14 3 17a9 9 0 0 0 18 0c0-5-4-9-9-15zm0 20a7 7 0 0 1-5-11.9C8 12 10 14 12 14s4-2 5-3.9A7 7 0 0 1 12 22z"/></svg>
              {streak}
            </span>
          )}
        </div>

        {/* Progress bar */}
        {!loading && totalTasks > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--bg-soft)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${progress * 100}%`,
                background: allDone ? '#22c55e' : BLUE,
                borderRadius: 3, transition: 'width 0.5s ease',
              }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: allDone ? '#22c55e' : 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
              {allDone ? '✓ All done!' : `${completedCount} / ${totalTasks} done`}
            </span>
          </div>
        )}
      </div>

      {/* ── Stats row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>
        {[
          {
            label: 'Calories', displayVal: loading ? '—' : `${todayCal}`, sub: `of ${calorieGoal.toLocaleString()} cal`,
            pct: todayCal / calorieGoal, color: BLUE,
            icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={BLUE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>,
          },
          {
            label: 'Protein', displayVal: loading ? '—' : `${todayProt}g`, sub: `of ${proteinGoal}g`,
            pct: todayProt / proteinGoal, color: '#a78bfa',
            icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>,
          },
          {
            label: 'Carbs', displayVal: loading ? '—' : `${todayCarbs}g`, sub: `of ${carbsGoal}g`,
            pct: todayCarbs / carbsGoal, color: '#34d399',
            icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>,
          },
          {
            label: 'Fat', displayVal: loading ? '—' : `${todayFat}g`, sub: `of ${fatGoal}g`,
            pct: todayFat / fatGoal, color: '#fb923c',
            icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fb923c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>,
          },
        ].map(({ label, displayVal, sub, pct, color, icon }, i) => (
          <div key={label} style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 16,
            padding: '16px 16px 13px', animation: `fadeUp 0.4s ease ${i * 55}ms both`,
            display: 'flex', flexDirection: 'column',
          }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 12 }}>{label}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 13 }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <Ring pct={pct} color={color} size={52} />
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
              </div>
              <div>
                <p style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.6px', lineHeight: 1 }}>{displayVal}</p>
                <p style={{ fontSize: 11, color: 'var(--text-placeholder)', marginTop: 4 }}>{sub}</p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{ flex: 1, height: 3, borderRadius: 2, background: 'var(--bg-soft)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(pct * 100, 100)}%`, background: color, borderRadius: 2, transition: 'width 0.9s cubic-bezier(0.4,0,0.2,1)' }} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-placeholder)', flexShrink: 0, minWidth: 30, textAlign: 'right' }}>{Math.round(pct * 100)}%</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Macro donut ── */}
      {!loading && (todayProt > 0 || todayCarbs > 0 || todayFat > 0) && (() => {
        const protCal = todayProt * 4;
        const carbCal = todayCarbs * 4;
        const fatCal = todayFat * 9;
        const total = protCal + carbCal + fatCal;
        const size = 84; const stroke = 9;
        const r = (size - stroke) / 2;
        const circ = 2 * Math.PI * r;
        const pPct = total > 0 ? protCal / total : 0;
        const cPct = total > 0 ? carbCal / total : 0;
        const fPct = total > 0 ? fatCal / total : 0;
        const pDash = circ * pPct; const cDash = circ * cPct; const fDash = circ * fPct;
        const cOffset = pDash; const fOffset = pDash + cDash;
        const cx = size / 2; const cy = size / 2;
        return (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 16, padding: '14px 18px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 20, animation: 'fadeUp 0.4s ease 240ms both' }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)', display: 'block' }}>
                <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--bg-soft)" strokeWidth={stroke} />
                {pPct > 0 && <circle cx={cx} cy={cy} r={r} fill="none" stroke="#a78bfa" strokeWidth={stroke} strokeDasharray={`${pDash} ${circ - pDash}`} strokeLinecap="butt" style={{ transition: 'stroke-dasharray 1s ease' }} />}
                {cPct > 0 && <circle cx={cx} cy={cy} r={r} fill="none" stroke="#34d399" strokeWidth={stroke} strokeDasharray={`${cDash} ${circ - cDash}`} strokeDashoffset={-cOffset} strokeLinecap="butt" style={{ transition: 'stroke-dasharray 1s ease' }} />}
                {fPct > 0 && <circle cx={cx} cy={cy} r={r} fill="none" stroke="#fb923c" strokeWidth={stroke} strokeDasharray={`${fDash} ${circ - fDash}`} strokeDashoffset={-fOffset} strokeLinecap="butt" style={{ transition: 'stroke-dasharray 1s ease' }} />}
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{todayCal}</p>
                <p style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 1 }}>cal</p>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 10 }}>Macro Breakdown</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { label: 'Protein', pct: pPct, color: '#a78bfa', g: todayProt },
                  { label: 'Carbs', pct: cPct, color: '#34d399', g: todayCarbs },
                  { label: 'Fat', pct: fPct, color: '#fb923c', g: todayFat },
                ].map(({ label, pct: p, color, g }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1 }}>{label}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', minWidth: 36, textAlign: 'right' }}>{g}g</span>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)', minWidth: 32, textAlign: 'right' }}>{Math.round(p * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}



      {/* ── Water tracker ── */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 16, padding: '14px 18px', marginBottom: 28, display: 'flex', alignItems: 'center', gap: 16, animation: 'fadeUp 0.4s ease 220ms both' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C6.5 8 4 13 4 17a8 8 0 0 0 16 0c0-4-2.5-9-8-15z"/></svg>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.09em' }}>Water</p>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginTop: 1 }}>{water} <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>/ {waterGoal} glasses</span></p>
          </div>
        </div>
        {/* Glasses dots */}
        <div style={{ display: 'flex', gap: 5, flex: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
          {Array.from({ length: waterGoal }).map((_, i) => (
            <button key={i} onClick={() => updateWater(i < water ? -(water - i) : i + 1 - water)}
              style={{ width: 18, height: 22, borderRadius: 4, border: 'none', background: i < water ? '#38bdf8' : 'var(--bg-soft)', cursor: 'pointer', transition: 'background 0.15s', padding: 0 }} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button onClick={() => updateWater(-1)} disabled={water === 0}
            style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-soft)', color: 'var(--text-primary)', fontSize: 16, fontWeight: 700, cursor: water === 0 ? 'not-allowed' : 'pointer', opacity: water === 0 ? 0.4 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
          <button onClick={() => updateWater(1)} disabled={water >= waterGoal * 2}
            style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border-color)', background: '#38bdf8', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
        </div>
      </div>

      {/* ── Tasks ── */}
      <div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
              Today&apos;s Tasks
            </h2>
            <a href="/dashboard" style={{ fontSize: 12, fontWeight: 600, color: BLUE, textDecoration: 'none' }}>
              View full plan →
            </a>
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="skeleton" style={{ height: 68, borderRadius: 16 }} />
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* ── Meal slots ── */}
              {SLOTS.map(slot => {
                const planned = todayEntries.filter(e => e.meal_slot === slot);
                const slotLog = foodLog.filter(e => e.meal_slot === slot);
                const loggedIds = new Set(slotLog.map(e => e.recipe_id).filter(Boolean));
                const unlogged = planned.filter(e => !loggedIds.has(e.recipe?.id ?? ''));
                return (
                  <div key={slot}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>{SLOT_LABELS[slot]}</p>
                      {slotLog.length > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: '#22c55e' }}>{slotLog.length} logged</span>}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {/* Logged food entries */}
                      {slotLog.map(log => (
                        <div key={log.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(34,197,94,0.04)', border: '1px solid var(--border-color)', borderLeft: '3px solid #22c55e', borderRadius: 12, padding: '10px 14px' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><polyline points="20 6 9 17 4 12"/></svg>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.name}</p>
                            {log.calories != null && (
                              <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>
                                {Math.round(log.calories)} cal{log.protein_g != null ? ` · ${Math.round(log.protein_g)}g protein` : ''}{log.servings !== 1 ? ` · ${log.servings} srv` : ''}
                              </p>
                            )}
                          </div>
                          <button onClick={() => handleDeleteLog(log.id)}
                            style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                            <svg width="8" height="8" viewBox="0 0 12 12" fill="none" stroke="var(--text-tertiary)" strokeWidth="2.5" strokeLinecap="round"><line x1="1" y1="1" x2="11" y2="11"/><line x1="11" y1="1" x2="1" y2="11"/></svg>
                          </button>
                        </div>
                      ))}

                      {/* Unlogged planned meals */}
                      {unlogged.map(entry => (
                        <div key={entry.id} className="meal-task" style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderLeft: `3px solid rgba(59,130,246,0.45)`, borderRadius: 12, padding: '10px 14px', cursor: 'pointer' }}
                          onClick={() => setSelectedMeal(entry)}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.recipe?.title ?? 'Untitled'}</p>
                            {entry.recipe?.nutrition?.calories != null && (
                              <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>{Math.round(entry.recipe.nutrition.calories / 10) * 10} cal planned</p>
                            )}
                          </div>
                          <button onClick={e => { e.stopPropagation(); setLogModal({ entry, servings: 1 }); }}
                            style={{ flexShrink: 0, height: 28, padding: '0 12px', borderRadius: 8, border: `1.5px solid ${BLUE}`, background: 'transparent', color: BLUE, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                            Log
                          </button>
                        </div>
                      ))}

                      {/* + Log food button — always for snack, only when nothing planned or logged for other slots */}
                      {(slot === 'snack' || (planned.length === 0 && slotLog.length === 0)) && (
                        <button onClick={() => { setAddModal(slot); setAddTab('search'); setAddQuery(''); setAddForm({ name: '', calories: '', protein_g: '', carbs_g: '', fat_g: '' }); }}
                          style={{ width: '100%', textAlign: 'left', padding: '8px 14px', border: '1px dashed var(--border-color)', borderRadius: 10, background: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                          Log food to {SLOT_LABELS[slot]}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}


              {/* Workout */}
              {workoutIsActive && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--bg-card)', border: workoutDone ? '1px solid rgba(34,197,94,0.35)' : '1px solid var(--border-color)', borderRadius: 16, padding: '13px 16px', opacity: workoutDone ? 0.65 : 1 }}>
                  <button onClick={toggleWorkout} style={{ flexShrink: 0, width: 26, height: 26, borderRadius: '50%', border: workoutDone ? 'none' : '2px solid var(--border-color)', background: workoutDone ? '#22c55e' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}>
                    {workoutDone && <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="1.5,6 4.5,9.5 10.5,2.5" /></svg>}
                  </button>
                  <div style={{ width: 54, flexShrink: 0 }}><p style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: workoutDone ? '#22c55e' : '#fb923c' }}>Workout</p></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{workout!.title ?? 'Workout'}</p>
                    {workout!.workout_type && <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{workout!.workout_type}{workout!.duration_minutes ? ` · ${workout!.duration_minutes} min` : ''}</p>}
                  </div>
                </div>
              )}
              {workout?.is_rest_day && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--bg-soft)', border: '1px solid var(--border-color)', borderRadius: 16, padding: '13px 16px' }}>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', border: '2px dashed var(--border-color)', flexShrink: 0 }} />
                  <div style={{ width: 54, flexShrink: 0 }}><p style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-placeholder)' }}>Workout</p></div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-tertiary)' }}>Rest day — enjoy the recovery</p>
                </div>
              )}
              {workout === null && (
                <a href="/dashboard" style={{ textDecoration: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--bg-soft)', border: '1px dashed var(--border-color)', borderRadius: 16, padding: '13px 16px', cursor: 'pointer' }}>
                    <div style={{ width: 26, height: 26, borderRadius: '50%', border: '2px dashed var(--border-color)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: 15, color: 'var(--text-placeholder)', lineHeight: 1 }}>+</span></div>
                    <div style={{ width: 54, flexShrink: 0 }}><p style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-placeholder)' }}>Workout</p></div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-tertiary)' }}>Log today&apos;s workout</p>
                  </div>
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Recipe detail modal ── */}
      {selectedMeal && (
        <RecipeModal entry={selectedMeal} onClose={() => setSelectedMeal(null)} />
      )}

      {/* ── Log planned meal modal ── */}
      {logModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }} onClick={() => setLogModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, padding: '24px 24px 36px', animation: 'modalIn 0.22s ease' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border-color)', margin: '0 auto 20px' }} />
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--text-tertiary)', marginBottom: 4 }}>{SLOT_LABELS[logModal.entry.meal_slot]}</p>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 20 }}>{logModal.entry.recipe?.title}</h3>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Servings</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <button onClick={() => setLogModal(m => m ? { ...m, servings: Math.max(0.5, parseFloat((m.servings - 0.5).toFixed(1))) } : m)}
                  style={{ width: 32, height: 32, borderRadius: 8, border: '1.5px solid var(--border-color)', background: 'var(--bg-soft)', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', minWidth: 28, textAlign: 'center' }}>{logModal.servings}</span>
                <button onClick={() => setLogModal(m => m ? { ...m, servings: parseFloat((m.servings + 0.5).toFixed(1)) } : m)}
                  style={{ width: 32, height: 32, borderRadius: 8, border: '1.5px solid var(--border-color)', background: 'var(--bg-soft)', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
              </div>
            </div>
            {logModal.entry.recipe?.nutrition?.calories != null && (
              <div style={{ background: 'var(--bg-soft)', borderRadius: 12, padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 20 }}>
                <div><p style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>{Math.round(logModal.entry.recipe.nutrition.calories * logModal.servings)}</p><p style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>cal</p></div>
                {logModal.entry.recipe.nutrition.protein_g != null && <div><p style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>{Math.round(logModal.entry.recipe.nutrition.protein_g * logModal.servings)}g</p><p style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>protein</p></div>}
                {logModal.entry.recipe.nutrition.carbs_g != null && <div><p style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>{Math.round(logModal.entry.recipe.nutrition.carbs_g * logModal.servings)}g</p><p style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>carbs</p></div>}
                {logModal.entry.recipe.nutrition.fat_g != null && <div><p style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>{Math.round(logModal.entry.recipe.nutrition.fat_g * logModal.servings)}g</p><p style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>fat</p></div>}
              </div>
            )}
            <button onClick={() => handleLogMeal(logModal.entry, logModal.servings)} disabled={logging}
              style={{ width: '100%', height: 48, borderRadius: 13, border: 'none', background: '#22c55e', color: '#fff', fontSize: 15, fontWeight: 700, cursor: logging ? 'not-allowed' : 'pointer', opacity: logging ? 0.7 : 1 }}>
              {logging ? 'Logging…' : 'Log it ✓'}
            </button>
          </div>
        </div>
      )}

      {/* ── Add food modal ── */}
      {addModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }} onClick={() => setAddModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, maxHeight: '80vh', display: 'flex', flexDirection: 'column', animation: 'modalIn 0.22s ease' }}>
            <div style={{ padding: '20px 20px 0' }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border-color)', margin: '0 auto 16px' }} />
              <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 14 }}>Log food to {SLOT_LABELS[addModal]}</h3>
              {/* Tab switcher */}
              <div style={{ display: 'flex', gap: 4, background: 'var(--bg-soft)', borderRadius: 10, padding: 3, marginBottom: 16 }}>
                {(['search', 'manual'] as const).map(t => (
                  <button key={t} onClick={() => setAddTab(t)}
                    style={{ flex: 1, height: 32, borderRadius: 8, border: 'none', background: addTab === t ? 'var(--bg-card)' : 'transparent', fontWeight: 700, fontSize: 13, color: addTab === t ? 'var(--text-primary)' : 'var(--text-tertiary)', cursor: 'pointer', boxShadow: addTab === t ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>
                    {t === 'search' ? 'Your recipes' : 'Manual entry'}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 32px' }}>
              {addTab === 'search' ? (
                <>
                  <div style={{ position: 'relative', marginBottom: 10 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <input
                      autoFocus
                      value={addQuery}
                      onChange={e => setAddQuery(e.target.value)}
                      placeholder="Filter recipes…"
                      style={{ width: '100%', height: 42, paddingLeft: 32, paddingRight: 14, borderRadius: 11, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                    />
                    {addQuery && (
                      <button onClick={() => setAddQuery('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 14, lineHeight: 1, padding: 2 }}>✕</button>
                    )}
                  </div>
                  {(() => {
                    const q = addQuery.toLowerCase();
                    const slotFirst = allRecipes.filter(r => r.category?.toLowerCase() === addModal);
                    const rest = allRecipes.filter(r => r.category?.toLowerCase() !== addModal);
                    const all = [...slotFirst, ...rest];
                    const filtered = q ? all.filter(r => r.title.toLowerCase().includes(q) || r.category?.toLowerCase().includes(q) || r.cuisine?.toLowerCase().includes(q)) : all;
                    if (allRecipes.length === 0) return (
                      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center', padding: '20px 0' }}>No saved recipes yet — add some in the Recipes tab.</p>
                    );
                    if (filtered.length === 0) return (
                      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center', padding: '20px 0' }}>No recipes match &quot;{addQuery}&quot;</p>
                    );
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {!q && slotFirst.length > 0 && (
                          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.09em', marginBottom: 2 }}>{SLOT_LABELS[addModal!]}</p>
                        )}
                        {filtered.map((r, idx) => {
                          const showDivider = !q && idx === slotFirst.length && rest.length > 0 && slotFirst.length > 0;
                          return (
                            <React.Fragment key={r.id}>
                              {showDivider && <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.09em', marginTop: 6, marginBottom: 2 }}>All recipes</p>}
                              <button onClick={() => handleLogFromRecipe(r)} disabled={addingFood}
                                style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '11px 14px', borderRadius: 11, border: '1px solid var(--border-color)', background: 'var(--bg-soft)', cursor: addingFood ? 'default' : 'pointer', textAlign: 'left' }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</p>
                                  <div style={{ display: 'flex', gap: 8, marginTop: 3 }}>
                                    {r.nutrition?.calories != null && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{Math.round(r.nutrition.calories)} cal</span>}
                                    {r.nutrition?.protein_g != null && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{Math.round(r.nutrition.protein_g)}g protein</span>}
                                    {r.cuisine && <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{r.cuisine}</span>}
                                  </div>
                                </div>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                              </button>
                            </React.Fragment>
                          );
                        })}
                      </div>
                    );
                  })()}
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { key: 'name', label: 'Food name', placeholder: 'e.g. Protein shake', type: 'text' },
                    { key: 'calories', label: 'Calories', placeholder: '0', type: 'number' },
                    { key: 'protein_g', label: 'Protein (g)', placeholder: '0', type: 'number' },
                    { key: 'carbs_g', label: 'Carbs (g)', placeholder: '0', type: 'number' },
                    { key: 'fat_g', label: 'Fat (g)', placeholder: '0', type: 'number' },
                  ].map(({ key, label, placeholder, type }) => (
                    <div key={key}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>{label}</p>
                      <input type={type} placeholder={placeholder}
                        value={addForm[key as keyof typeof addForm]}
                        onChange={e => setAddForm(f => ({ ...f, [key]: e.target.value }))}
                        style={{ width: '100%', height: 42, padding: '0 14px', borderRadius: 11, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                  ))}
                  <button onClick={handleAddManual} disabled={addingFood || !addForm.name.trim()}
                    style={{ marginTop: 4, width: '100%', height: 46, borderRadius: 13, border: 'none', background: '#22c55e', color: '#fff', fontSize: 15, fontWeight: 700, cursor: addingFood || !addForm.name.trim() ? 'not-allowed' : 'pointer', opacity: addingFood || !addForm.name.trim() ? 0.6 : 1 }}>
                    {addingFood ? 'Logging…' : 'Log food'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
