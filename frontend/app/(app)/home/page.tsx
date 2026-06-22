'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  getWeeklyPlan, getWeeklyWorkouts, isLoggedIn,
} from '@/lib/api';
import type { MealPlanEntry, WorkoutPlan } from '@/types';

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
      return Object.fromEntries(ids.map(id => [id, true]));
    } catch { return {}; }
  });
  const [selectedMeal, setSelectedMeal] = useState<MealPlanEntry | null>(null);

  useEffect(() => {
    if (!isLoggedIn()) { router.push('/login'); return; }
    const weekStart = toIso(monday);
    Promise.all([
      getWeeklyPlan(weekStart),
      getWeeklyWorkouts(weekStart),
    ])
      .then(([planData, workoutData]) => {
        setPlan(planData?.days || {});
        setWorkout(workoutData?.workouts?.[today] ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const todayEntries = plan[today] || [];
  const completedEntries = todayEntries.filter(e => checked[e.id]);
  const todayCal = Math.round(completedEntries.reduce((s, e) => s + (e.recipe?.nutrition?.calories ?? 0), 0));
  const todayProt = Math.round(completedEntries.reduce((s, e) => s + (e.recipe?.nutrition?.protein_g ?? 0), 0));

  const workoutIsActive = workout && !workout.is_rest_day;
  const totalTasks = todayEntries.length + (workoutIsActive ? 1 : 0);
  const mealsDone = todayEntries.filter(e => checked[e.id]).length;
  const workoutDone = !!checked['__workout__'];
  const completedCount = mealsDone + (workoutDone ? 1 : 0);
  const progress = totalTasks > 0 ? completedCount / totalTasks : 0;
  const allDone = totalTasks > 0 && completedCount === totalTasks;

  const dateLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

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
    setChecked(c => ({ ...c, __workout__: !c.__workout__ }));
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
        <h1 style={{ fontSize: 30, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.6px', lineHeight: 1.1, marginBottom: 18 }}>
          {dateLabel}
        </h1>

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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
        {[
          {
            label: 'Calories', displayVal: loading ? '—' : `${todayCal}`, sub: 'of 2,000 cal',
            pct: todayCal / 2000, color: BLUE,
            icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={BLUE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>,
          },
          {
            label: 'Protein', displayVal: loading ? '—' : `${todayProt}g`, sub: 'of 150g',
            pct: todayProt / 150, color: '#a78bfa',
            icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>,
          },
          {
            label: 'Meals Done', displayVal: loading ? '—' : `${mealsDone}`, sub: `of ${todayEntries.length} planned`,
            pct: todayEntries.length > 0 ? mealsDone / todayEntries.length : 0, color: '#34d399',
            icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/></svg>,
          },
          {
            label: 'Tasks Done', displayVal: loading ? '—' : `${completedCount}`, sub: `of ${totalTasks} total`,
            pct: progress, color: '#fb923c',
            icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fb923c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
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
          ) : todayEntries.length === 0 && !workoutIsActive ? (
            <div style={{
              background: 'var(--bg-card)', border: '1px solid var(--border-color)',
              borderRadius: 16, padding: '40px 24px', textAlign: 'center',
            }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>Nothing planned today</p>
              <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 16 }}>Add meals to your weekly plan to see them here.</p>
              <a href="/dashboard" style={{
                display: 'inline-flex', alignItems: 'center', height: 34, padding: '0 14px',
                borderRadius: 9, background: BLUE, color: '#fff', fontSize: 12, fontWeight: 600, textDecoration: 'none',
              }}>
                Go to Plan →
              </a>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Meal tasks */}
              {SLOTS.map(slot =>
                todayEntries.filter(e => e.meal_slot === slot).map(entry => (
                  <div key={entry.id} className="meal-task">
                    <MealTaskCard
                      entry={entry}
                      slotLabel={SLOT_LABELS[slot]}
                      done={!!checked[entry.id]}
                      onToggle={e => toggleMeal(e, entry.id)}
                      onViewDetail={() => setSelectedMeal(entry)}
                    />
                  </div>
                ))
              )}

              {/* Workout task */}
              {workoutIsActive && (
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14, cursor: 'default',
                    background: 'var(--bg-card)',
                    border: workoutDone ? '1px solid rgba(34,197,94,0.35)' : '1px solid var(--border-color)',
                    borderRadius: 16, padding: '13px 16px',
                    opacity: workoutDone ? 0.65 : 1,
                  }}
                >
                  <button
                    onClick={toggleWorkout}
                    style={{ flexShrink: 0, width: 26, height: 26, borderRadius: '50%', border: workoutDone ? 'none' : '2px solid var(--border-color)', background: workoutDone ? '#22c55e' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
                  >
                    {workoutDone && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="1.5,6 4.5,9.5 10.5,2.5" />
                      </svg>
                    )}
                  </button>
                  <div style={{ width: 54, flexShrink: 0 }}>
                    <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: workoutDone ? '#22c55e' : '#fb923c' }}>Workout</p>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', textDecoration: workoutDone ? 'line-through' : 'none' }}>{workout!.title ?? 'Workout'}</p>
                    {workout!.workout_type && (
                      <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                        {workout!.workout_type}{workout!.duration_minutes ? ` · ${workout!.duration_minutes} min` : ''}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Rest day */}
              {workout?.is_rest_day && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--bg-soft)', border: '1px solid var(--border-color)', borderRadius: 16, padding: '13px 16px' }}>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', border: '2px dashed var(--border-color)', flexShrink: 0 }} />
                  <div style={{ width: 54, flexShrink: 0 }}>
                    <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-placeholder)' }}>Workout</p>
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-tertiary)' }}>Rest day — enjoy the recovery</p>
                </div>
              )}

              {/* No workout yet */}
              {workout === null && (
                <a href="/dashboard" style={{ textDecoration: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--bg-soft)', border: '1px dashed var(--border-color)', borderRadius: 16, padding: '13px 16px', cursor: 'pointer' }}>
                    <div style={{ width: 26, height: 26, borderRadius: '50%', border: '2px dashed var(--border-color)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 15, color: 'var(--text-placeholder)', lineHeight: 1 }}>+</span>
                    </div>
                    <div style={{ width: 54, flexShrink: 0 }}>
                      <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-placeholder)' }}>Workout</p>
                    </div>
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
    </div>
  );
}
