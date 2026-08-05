'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  getWeeklyPlan, getWeeklyWorkouts, isLoggedIn,
  getFoodLog, addFoodLog, deleteFoodLog, getRecipes,
} from '@/lib/api';
import type { MealPlanEntry, WorkoutPlan, FoodLogEntry, Recipe } from '@/types';
import WeeklyPlanSection from '@/components/WeeklyPlanSection';

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
  const [addForm, setAddForm] = useState({ name: '', calories: '', protein_g: '', carbs_g: '', fat_g: '', fiber_g: '' });
  const [addingFood, setAddingFood] = useState(false);

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
        const allWorkouts = workoutData?.workouts || {};
        setWorkout(allWorkouts[today] ?? null);
        setFoodLog(logData || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    getRecipes({ page_size: 100 }).then(d => setAllRecipes(d?.recipes || [])).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const todayEntries = plan[today] || [];
  const workoutIsActive = workout && !workout.is_rest_day;
  const workoutDone = !!checked['__workout__'];

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
        fiber_g: r?.nutrition?.fiber_g != null ? Math.round(r.nutrition.fiber_g * servings * 10) / 10 : null,
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
        fiber_g: recipe.nutrition?.fiber_g ?? null,
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
        fiber_g: addForm.fiber_g ? parseFloat(addForm.fiber_g) : null,
        servings: 1,
      });
      setFoodLog(prev => [...prev, logged]);
      setAddModal(null); setAddForm({ name: '', calories: '', protein_g: '', carbs_g: '', fat_g: '', fiber_g: '' });
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
    <div style={{ minHeight: '100%' }}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px); animation-timing-function:cubic-bezier(0.23,1,0.32,1); } to { opacity:1; transform:translateY(0); } }
        @keyframes modalIn { from { opacity:0; transform:scale(0.95) translateY(8px); animation-timing-function:cubic-bezier(0.23,1,0.32,1); } to { opacity:1; transform:scale(1) translateY(0); } }
        @media (hover: hover) and (pointer: fine) {
          .meal-task:hover { box-shadow: 0 4px 16px rgba(59,130,246,0.1); }
          .qlink:hover { background: var(--bg-soft) !important; }
        }
      `}</style>

      {/* ── Weekly plan section wraps tasks between stats and calendar ── */}
      <WeeklyPlanSection>

      {/* ── Tasks ── */}
      <div style={{ marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
              Today&apos;s Tasks
            </h2>
            <span />
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
                      <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary)' }}>{SLOT_LABELS[slot]}</p>
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
                        <button onClick={() => { setAddModal(slot); setAddTab('search'); setAddQuery(''); setAddForm({ name: '', calories: '', protein_g: '', carbs_g: '', fat_g: '', fiber_g: '' }); }}
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
                  <button onClick={toggleWorkout} style={{ flexShrink: 0, width: 26, height: 26, borderRadius: '50%', border: workoutDone ? 'none' : '2px solid var(--border-color)', background: workoutDone ? '#22c55e' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background 160ms ease-out, border-color 160ms ease-out' }}>
                    {workoutDone && <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="1.5,6 4.5,9.5 10.5,2.5" /></svg>}
                  </button>
                  <div style={{ width: 54, flexShrink: 0 }}><p style={{ fontSize: 11, fontWeight: 500, color: workoutDone ? '#22c55e' : 'var(--text-tertiary)' }}>Workout</p></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{workout!.title ?? 'Workout'}</p>
                    {workout!.workout_type && <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{workout!.workout_type}{workout!.duration_minutes ? ` · ${workout!.duration_minutes} min` : ''}</p>}
                  </div>
                </div>
              )}
              {workout?.is_rest_day && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--bg-soft)', border: '1px solid var(--border-color)', borderRadius: 16, padding: '13px 16px' }}>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', border: '2px dashed var(--border-color)', flexShrink: 0 }} />
                  <div style={{ width: 54, flexShrink: 0 }}><p style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-placeholder)' }}>Workout</p></div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-tertiary)' }}>Rest day — enjoy the recovery</p>
                </div>
              )}
              {workout === null && (
                <a href="/workouts" style={{ textDecoration: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--bg-soft)', border: '1px dashed var(--border-color)', borderRadius: 16, padding: '13px 16px', cursor: 'pointer' }}>
                    <div style={{ width: 26, height: 26, borderRadius: '50%', border: '2px dashed var(--border-color)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: 15, color: 'var(--text-placeholder)', lineHeight: 1 }}>+</span></div>
                    <div style={{ width: 54, flexShrink: 0 }}><p style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-placeholder)' }}>Workout</p></div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-tertiary)' }}>Log today&apos;s workout</p>
                  </div>
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      </WeeklyPlanSection>

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
                    { key: 'fiber_g', label: 'Fiber (g)', placeholder: '0', type: 'number' },
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
