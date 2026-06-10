'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getWeeklyPlan, addMealPlan, deleteMealPlan, getRecipes, isLoggedIn, getWeeklyWorkouts } from '@/lib/api';
import type { MealPlanEntry, Recipe, WorkoutPlan, NutritionInfo } from '@/types';

const SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
const SLOT_META: Record<string, { label: string; color: string; bg: string }> = {
  breakfast: { label: 'Breakfast', color: '#f59e0b', bg: '#fffbeb' },
  lunch:     { label: 'Lunch',     color: '#10b981', bg: '#f0fdf4' },
  dinner:    { label: 'Dinner',    color: '#6366f1', bg: '#eef2ff' },
  snack:     { label: 'Snack',     color: '#f43f5e', bg: '#fff1f2' },
};

function isoWeekMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
}
function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function toIso(d: Date): string { return d.toISOString().split('T')[0]; }
function formatDay(dateStr: string): { weekday: string; date: number } {
  const d = new Date(dateStr + 'T00:00:00');
  return { weekday: d.toLocaleDateString('en-US', { weekday: 'short' }), date: d.getDate() };
}

function NutritionLabel({ n }: { n: NutritionInfo }) {
  const cal = n.calories != null ? Math.round(n.calories / 10) * 10 : null;
  const rows: [string, number | null, string][] = [
    ['Total Fat', n.fat_g, 'g'],
    ['  Saturated Fat', n.saturated_fat_g, 'g'],
    ['Cholesterol', n.cholesterol_mg, 'mg'],
    ['Sodium', n.sodium_mg, 'mg'],
    ['Total Carbohydrate', n.carbs_g, 'g'],
    ['  Dietary Fiber', n.fiber_g, 'g'],
    ['  Total Sugars', n.sugar_g, 'g'],
    ['Protein', n.protein_g, 'g'],
  ];
  return (
    <div style={{ border: '2px solid #191c1f', borderRadius: 8, padding: '10px 12px' }}>
      <p className="font-black text-xl" style={{ color: '#191c1f', borderBottom: '8px solid #191c1f', paddingBottom: 4, marginBottom: 4 }}>Nutrition Facts</p>
      <p className="text-xs" style={{ color: '#191c1f', borderBottom: '1px solid #c0c4cc', paddingBottom: 4, marginBottom: 4 }}>Per serving</p>
      {cal != null && (
        <div className="flex items-end justify-between" style={{ borderBottom: '4px solid #191c1f', paddingBottom: 4, marginBottom: 4 }}>
          <span className="text-xs font-bold" style={{ color: '#191c1f' }}>Calories</span>
          <span className="font-black text-3xl" style={{ color: '#191c1f' }}>{cal}</span>
        </div>
      )}
      <div className="space-y-1">
        {rows.map(([label, val, unit]) => val != null && (
          <div key={label} className="flex justify-between text-xs" style={{ borderBottom: '1px solid #e2e2e7', paddingBottom: 2 }}>
            <span style={{ color: '#191c1f', paddingLeft: label.startsWith('  ') ? 12 : 0, fontWeight: label.startsWith('  ') ? 400 : 600 }}>{label.trim()}</span>
            <span style={{ color: '#191c1f' }}><strong>{Math.round(val * 10) / 10}</strong>{unit}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [monday, setMonday] = useState<Date>(() => isoWeekMonday(new Date()));
  const [plan, setPlan] = useState<Record<string, MealPlanEntry[]>>({});
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [workouts, setWorkouts] = useState<Record<string, WorkoutPlan>>({});
  const [selectedMeal, setSelectedMeal] = useState<MealPlanEntry | null>(null);
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutPlan | null>(null);
  const [adding, setAdding] = useState<{ date: string; slot: string } | null>(null);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const weekDays = Array.from({ length: 7 }, (_, i) => toIso(addDays(monday, i)));
  const today = toIso(new Date());
  const monthLabel = new Date(weekDays[0] + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const fetchPlan = useCallback(async () => {
    setLoading(true);
    try { setPlan((await getWeeklyPlan(toIso(monday)))?.days || {}); }
    catch { if (!isLoggedIn()) router.push('/login'); }
    finally { setLoading(false); }
  }, [monday, router]);

  useEffect(() => { if (!isLoggedIn()) { router.push('/login'); return; } fetchPlan(); }, [fetchPlan, router]);
  useEffect(() => { if (isLoggedIn()) getRecipes({ page_size: 100 }).then(d => setRecipes(d?.recipes || [])).catch(() => {}); }, []);
  useEffect(() => { if (isLoggedIn()) getWeeklyWorkouts(toIso(monday)).then(d => setWorkouts(d?.workouts || {})).catch(() => {}); }, [monday]);

  async function handleAdd() {
    if (!selectedRecipeId || !adding) return;
    setSaving(true); setError('');
    try {
      await addMealPlan({ recipe_id: selectedRecipeId, planned_date: adding.date, meal_slot: adding.slot });
      setAdding(null); setSelectedRecipeId(''); fetchPlan();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    try { await deleteMealPlan(id); fetchPlan(); } catch {}
  }

  const totalMeals = Object.values(plan).flat().length;

  return (
    <div className="p-6 min-h-full" style={{ background: '#f7f7f8' }}>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: '#191c1f', letterSpacing: '-0.5px' }}>Weekly Plan</h1>
          <p className="text-base mt-1" style={{ color: '#8d969e' }}>{monthLabel} · {totalMeals} meal{totalMeals !== 1 ? 's' : ''} planned</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setMonday(d => addDays(d, -7))} className="w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium" style={{ background: '#fff', border: '1px solid #e2e2e7', color: '#191c1f' }}>←</button>
          <button onClick={() => setMonday(isoWeekMonday(new Date()))} className="px-3 h-8 rounded-lg text-xs font-semibold" style={{ background: '#fff', border: '1px solid #e2e2e7', color: '#191c1f' }}>Today</button>
          <button onClick={() => setMonday(d => addDays(d, 7))} className="w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium" style={{ background: '#fff', border: '1px solid #e2e2e7', color: '#191c1f' }}>→</button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-32 text-sm" style={{ color: '#8d969e' }}>Loading your plan…</div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid #e8e8ec', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div className="grid grid-cols-7" style={{ borderBottom: '1px solid #e8e8ec' }}>
            {weekDays.map(day => {
              const { weekday, date } = formatDay(day);
              const isToday = day === today;
              return (
                <div key={day} className="flex flex-col items-center py-3 gap-1" style={{ borderRight: '1px solid #e8e8ec' }}>
                  <span className="text-lg font-semibold uppercase tracking-wider" style={{ color: '#8d969e' }}>{weekday}</span>
                  <span className="w-7 h-7 flex items-center justify-center rounded-full text-sm font-bold"
                    style={isToday ? { background: '#191c1f', color: '#fff' } : { color: '#191c1f' }}>{date}</span>
                </div>
              );
            })}
          </div>

          {Object.keys(workouts).length > 0 && (
            <div className="grid grid-cols-7" style={{ borderBottom: '1px solid #f0f0f2' }}>
              {weekDays.map((day, di) => {
                const w = workouts[day];
                return (
                  <div key={day} className="p-2.5 min-h-[72px] flex flex-col justify-center"
                    style={{ borderRight: di < 6 ? '1px solid #f0f0f2' : 'none' }}>
                    {di === 0 && (
                      <span className="text-[20px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md self-start mb-1" style={{ color: '#0d9488', background: '#f0fdfa' }}>Workout</span>
                    )}
                    {w ? (
                      w.is_rest_day ? (
                        <span className="text-[13px] font-medium px-2 py-1" style={{ color: '#8d969e' }}>Rest day</span>
                      ) : (
                        <button onClick={() => setSelectedWorkout(w)} className="text-left w-full rounded-lg px-2.5 py-2 transition-all" style={{ background: '#f0fdfa', border: '1px solid #0d948822' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#ccfbf1'}
                          onMouseLeave={e => e.currentTarget.style.background = '#f0fdfa'}>
                          <p className="text-[14px] font-semibold leading-tight" style={{ color: '#0d9488' }}>{w.title}</p>
                          {w.duration_minutes && (
                            <p className="text-[12px] mt-0.5" style={{ color: '#0d9488', opacity: 0.7 }}>{w.duration_minutes} min · {w.exercises?.length || 0} exercises</p>
                          )}
                        </button>
                      )
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          {SLOTS.map((slot, si) => (
            <div key={slot} className="grid grid-cols-7" style={{ borderBottom: si < SLOTS.length - 1 ? '1px solid #f0f0f2' : 'none' }}>
              {weekDays.map((day, di) => {
                const entries = (plan[day] || []).filter(e => e.meal_slot === slot);
                const meta = SLOT_META[slot];
                return (
                  <div key={day} className="group p-2.5 min-h-[140px] flex flex-col gap-1.5"
                    style={{ borderRight: di < 6 ? '1px solid #f0f0f2' : 'none' }}>
                    {di === 0 && (
                      <span className="text-[20px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md self-start" style={{ color: meta.color, background: meta.bg }}>{meta.label}</span>
                    )}
                    {di > 0 && entries.length === 0 && <div className="h-5" />}
                    {entries.map(entry => (
                      <div key={entry.id} className="group relative rounded-lg px-2.5 py-2 cursor-pointer transition-all"
                        style={{ background: meta.bg, border: `1px solid ${meta.color}22` }}
                        onClick={() => setSelectedMeal(entry)}
                        onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                        onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                        <span className="text-[14px] font-semibold leading-tight block pr-4 truncate" style={{ color: meta.color }}>{entry.recipe?.title}</span>
                        {entry.recipe?.nutrition?.calories != null && (
                          <p className="text-[11px] mt-0.5" style={{ color: meta.color, opacity: 0.7 }}>
                            {Math.round(entry.recipe.nutrition.calories / 10) * 10} cal{entry.recipe.nutrition.protein_g != null ? ` · ${Math.round(entry.recipe.nutrition.protein_g)}g protein` : ''}
                          </p>
                        )}
                        <button onClick={e => { e.stopPropagation(); handleDelete(entry.id); }} className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-[10px]" style={{ color: meta.color }}>✕</button>
                      </div>
                    ))}
                    <button
                      onClick={() => { setAdding({ date: day, slot }); setSelectedRecipeId(''); setError(''); }}
                      className="mt-auto text-[15px] font-semibold text-left px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: meta.color }}>
                      + Add
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {selectedMeal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} onClick={() => setSelectedMeal(null)}>
          <div className="w-full max-w-lg flex flex-col" style={{ background: '#fff', borderRadius: 20, maxHeight: '88vh', boxShadow: '0 24px 64px rgba(0,0,0,0.15)' }} onClick={e => e.stopPropagation()}>
            <div className="h-1.5 rounded-t-[20px]" style={{ background: SLOT_META[selectedMeal.meal_slot]?.color || '#191c1f' }} />
            <div className="px-6 pt-4 pb-4 flex items-start justify-between" style={{ borderBottom: '1px solid #f0f0f2' }}>
              <div>
                <h3 className="font-bold text-lg leading-tight" style={{ color: '#191c1f' }}>{selectedMeal.recipe?.title}</h3>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className="text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md" style={{ color: SLOT_META[selectedMeal.meal_slot]?.color, background: SLOT_META[selectedMeal.meal_slot]?.bg }}>
                    {SLOT_META[selectedMeal.meal_slot]?.label}
                  </span>
                  {selectedMeal.recipe?.cuisine && <span className="text-xs" style={{ color: '#8d969e' }}>{selectedMeal.recipe.cuisine}</span>}
                  {(selectedMeal.recipe?.prep_time || selectedMeal.recipe?.cook_time) && (
                    <span className="text-xs" style={{ color: '#8d969e' }}>⏱ {(selectedMeal.recipe!.prep_time || 0) + (selectedMeal.recipe!.cook_time || 0)} min</span>
                  )}
                </div>
              </div>
              <button onClick={() => setSelectedMeal(null)} className="ml-4 w-8 h-8 flex items-center justify-center rounded-full text-lg" style={{ color: '#8d969e', background: '#f4f4f4' }}>✕</button>
            </div>
            <div className="overflow-y-auto px-6 py-5 space-y-5">
              {selectedMeal.recipe?.nutrition?.calories != null && <NutritionLabel n={selectedMeal.recipe.nutrition} />}
              {selectedMeal.recipe?.description && <p className="text-sm" style={{ color: '#505a63' }}>{selectedMeal.recipe.description}</p>}
              {selectedMeal.recipe?.ingredients?.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#8d969e' }}>Ingredients</h4>
                  <ul className="space-y-2">
                    {selectedMeal.recipe.ingredients.map((ing, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm" style={{ color: '#191c1f' }}>
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: SLOT_META[selectedMeal.meal_slot]?.color }} />
                        <span><strong>{ing.quantity} {ing.unit}</strong> {ing.name}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {selectedMeal.recipe?.steps?.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#8d969e' }}>Steps</h4>
                  <ol className="space-y-3">
                    {selectedMeal.recipe.steps.map((step, i) => (
                      <li key={i} className="flex gap-3 text-sm" style={{ color: '#191c1f' }}>
                        <span className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: '#f4f4f4', color: '#505a63' }}>{i + 1}</span>
                        <span className="pt-0.5">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedWorkout && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} onClick={() => setSelectedWorkout(null)}>
          <div className="w-full max-w-md flex flex-col" style={{ background: '#fff', borderRadius: 20, maxHeight: '88vh', boxShadow: '0 24px 64px rgba(0,0,0,0.15)' }} onClick={e => e.stopPropagation()}>
            <div className="h-1.5 rounded-t-[20px]" style={{ background: '#0d9488' }} />
            <div className="px-6 pt-4 pb-4 flex items-start justify-between" style={{ borderBottom: '1px solid #f0f0f2' }}>
              <div>
                <h3 className="font-bold text-lg leading-tight" style={{ color: '#191c1f' }}>{selectedWorkout.title}</h3>
                <div className="flex items-center gap-2 mt-1">
                  {selectedWorkout.workout_type && <span className="text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md" style={{ color: '#0d9488', background: '#f0fdfa' }}>{selectedWorkout.workout_type}</span>}
                  {selectedWorkout.duration_minutes && <span className="text-xs" style={{ color: '#8d969e' }}>⏱ {selectedWorkout.duration_minutes} min</span>}
                </div>
              </div>
              <button onClick={() => setSelectedWorkout(null)} className="ml-4 w-8 h-8 flex items-center justify-center rounded-full text-lg" style={{ color: '#8d969e', background: '#f4f4f4' }}>✕</button>
            </div>
            <div className="overflow-y-auto px-6 py-5">
              <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#8d969e' }}>Exercises</h4>
              <ol className="space-y-3">
                {selectedWorkout.exercises?.map((ex, i) => (
                  <li key={i} className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: '#f7f7f8' }}>
                    <span className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: '#0d9488', color: '#fff' }}>{i + 1}</span>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: '#191c1f' }}>{ex.name}</p>
                      {(ex.sets || ex.reps) && (
                        <p className="text-xs mt-0.5" style={{ color: '#8d969e' }}>
                          {ex.sets && `${ex.sets} sets`}{ex.sets && ex.reps && ' × '}{ex.reps && `${ex.reps} reps`}
                          {ex.duration && ` · ${ex.duration}`}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
              {selectedWorkout.notes && <p className="text-sm mt-4" style={{ color: '#8d969e' }}>{selectedWorkout.notes}</p>}
            </div>
          </div>
        </div>
      )}

      {adding && (
        <div className="fixed inset-0 flex items-end sm:items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-sm" style={{ background: '#fff', borderRadius: 20, boxShadow: '0 24px 64px rgba(0,0,0,0.15)', padding: 24 }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md" style={{ color: SLOT_META[adding.slot].color, background: SLOT_META[adding.slot].bg }}>
                {SLOT_META[adding.slot].label}
              </span>
            </div>
            <h3 className="font-bold text-base mb-1" style={{ color: '#191c1f' }}>
              {new Date(adding.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </h3>
            {error && <p className="text-xs mt-2 mb-3" style={{ color: '#e23b4a' }}>{error}</p>}
            <div className="my-4">
              {recipes.length === 0 ? (
                <p className="text-sm py-4 text-center" style={{ color: '#8d969e' }}>No recipes yet. Add some first.</p>
              ) : (
                <select value={selectedRecipeId} onChange={e => setSelectedRecipeId(e.target.value)}
                  className="w-full text-sm focus:outline-none"
                  style={{ height: 48, padding: '0 14px', border: '1.5px solid #e2e2e7', borderRadius: 12, color: selectedRecipeId ? '#191c1f' : '#8d969e', background: '#fff' }}>
                  <option value="">Choose a recipe…</option>
                  {recipes.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
                </select>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setAdding(null)} className="flex-1 text-sm font-medium" style={{ height: 44, borderRadius: 12, border: '1px solid #e2e2e7', color: '#505a63', background: '#fff' }}>Cancel</button>
              <button onClick={handleAdd} disabled={!selectedRecipeId || saving} className="flex-1 text-sm font-semibold text-white disabled:opacity-40" style={{ height: 44, borderRadius: 12, background: '#191c1f' }}>
                {saving ? 'Adding…' : 'Add meal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
