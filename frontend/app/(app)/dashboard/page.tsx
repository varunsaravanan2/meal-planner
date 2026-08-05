'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  getWeeklyPlan, addMealPlan, deleteMealPlan, getRecipes, searchRecipes, isLoggedIn,
  getWeeklyWorkouts, deleteWorkoutEntry,
} from '@/lib/api';
import type { MealPlanEntry, Recipe, WorkoutPlan } from '@/types';
import { WorkoutModal } from '@/components/WeeklyPlanSection';

const BLUE  = '#3b82f6';
const SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
const SLOT_COLORS: Record<string, string> = {
  breakfast: '#fb923c',
  lunch:     '#34d399',
  dinner:    '#818cf8',
  snack:     '#f472b6',
};
const SLOT_LABELS: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch:     'Lunch',
  dinner:    'Dinner',
  snack:     'Snack',
};

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function isoWeekMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  date.setDate(date.getDate() - day + (day === 0 ? -6 : 1));
  return date;
}

function AddMealModal({
  date, slot, recipes, onAdd, onClose,
}: {
  date: string; slot: string; recipes: Recipe[];
  onAdd: (recipeId: string) => Promise<void>; onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<Recipe[] | null>(null);

  useEffect(() => {
    if (!query.trim()) { setSearchResults(null); return; }
    const t = setTimeout(() => {
      searchRecipes(query).then(setSearchResults).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const filtered = searchResults ?? recipes;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-card)', borderRadius: 20, width: '100%', maxWidth: 440,
        maxHeight: '78vh', display: 'flex', flexDirection: 'column',
        border: '1px solid var(--border-color)', animation: 'modalIn 0.2s ease',
      }}>
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', color: SLOT_COLORS[slot] ?? BLUE }}>{SLOT_LABELS[slot]}</p>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>
                {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </h3>
            </div>
            <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-soft)', color: 'var(--text-tertiary)', fontSize: 14, cursor: 'pointer' }}>✕</button>
          </div>
          <input
            autoFocus value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search recipes…"
            style={{ width: '100%', height: 40, padding: '0 14px', borderRadius: 10, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ overflowY: 'auto', padding: '10px 12px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', textAlign: 'center', padding: '16px 0' }}>No matches — try a different name</p>
          )}
          {filtered.map(r => (
            <button key={r.id} disabled={!!adding}
              onClick={async () => { setAdding(r.id); await onAdd(r.id); setAdding(null); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 14px',
                borderRadius: 11, border: '1px solid var(--border-color)', background: adding === r.id ? 'rgba(34,197,94,0.08)' : 'var(--bg-soft)',
                cursor: adding ? 'default' : 'pointer', textAlign: 'left', opacity: adding && adding !== r.id ? 0.5 : 1,
              }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</p>
                {r.nutrition?.calories != null && (
                  <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{Math.round(r.nutrition.calories)} cal{r.nutrition.protein_g != null ? ` · ${Math.round(r.nutrition.protein_g)}g protein` : ''}</p>
                )}
              </div>
              {adding === r.id
                ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={BLUE} strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              }
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function PlanPage() {
  const router = useRouter();
  const today = toIso(new Date());

  const [calDate, setCalDate] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [plan, setPlan] = useState<Record<string, MealPlanEntry[]>>({});
  const [loading, setLoading] = useState(true);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedDay, setSelectedDay] = useState<string | null>(toIso(new Date()));
  const [addModal, setAddModal] = useState<{ date: string; slot: string } | null>(null);
  const [workouts, setWorkouts] = useState<Record<string, WorkoutPlan>>({});
  const [workoutDate, setWorkoutDate] = useState<string | null>(null);

  const weeksInView = React.useMemo(() => {
    const year = calDate.getFullYear();
    const month = calDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const weeks: Date[] = [];
    let monday = isoWeekMonday(firstDay);
    while (monday <= lastDay) {
      weeks.push(new Date(monday));
      monday = new Date(monday);
      monday.setDate(monday.getDate() + 7);
    }
    return weeks;
  }, [calDate]);

  const fetchMonth = useCallback(async () => {
    setLoading(true);
    try {
      const results = await Promise.all(weeksInView.map(w => getWeeklyPlan(toIso(w))));
      const merged: Record<string, MealPlanEntry[]> = {};
      for (const r of results) Object.assign(merged, r?.days ?? {});
      setPlan(merged);
    } catch {}
    finally { setLoading(false); }
  }, [weeksInView]);

  const fetchWorkouts = useCallback(async () => {
    try {
      const results = await Promise.all(weeksInView.map(w => getWeeklyWorkouts(toIso(w))));
      const merged: Record<string, WorkoutPlan> = {};
      for (const r of results) Object.assign(merged, r?.workouts ?? {});
      setWorkouts(merged);
    } catch {}
  }, [weeksInView]);

  useEffect(() => {
    if (!isLoggedIn()) { router.push('/login'); return; }
    fetchMonth();
    fetchWorkouts();
    getRecipes({ page_size: 100 }).then(d => setRecipes(d?.recipes ?? [])).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchMonth, fetchWorkouts]);

  const gridDays = React.useMemo(() => {
    const year = calDate.getFullYear();
    const month = calDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startMonday = isoWeekMonday(firstDay);
    const days: string[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(startMonday);
      d.setDate(d.getDate() + i);
      days.push(toIso(d));
    }
    while (days.length > 7) {
      const lastWeek = days.slice(-7);
      if (lastWeek.every(d => new Date(d + 'T00:00:00').getMonth() !== month)) {
        days.splice(-7);
      } else break;
    }
    return days;
  }, [calDate]);

  const currentMonth = calDate.getMonth();
  const currentYear = calDate.getFullYear();
  const monthLabel = calDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  function prevMonth() { setCalDate(d => { const n = new Date(d); n.setMonth(n.getMonth() - 1); return n; }); }
  function nextMonth() { setCalDate(d => { const n = new Date(d); n.setMonth(n.getMonth() + 1); return n; }); }

  async function handleAddMeal(date: string, slot: string, recipeId: string) {
    await addMealPlan({ recipe_id: recipeId, planned_date: date, meal_slot: slot });
    setAddModal(null);
    await fetchMonth();
  }

  async function handleDeleteMeal(id: string) {
    setPlan(prev => {
      const next = { ...prev };
      for (const day in next) next[day] = next[day].filter(e => e.id !== id);
      return next;
    });
    try { await deleteMealPlan(id); } catch { await fetchMonth(); }
  }

  async function handleDeleteWorkout(id: string) {
    setWorkouts(prev => {
      const next = { ...prev };
      for (const day in next) if (next[day].id === id) delete next[day];
      return next;
    });
    try { await deleteWorkoutEntry(id); } catch { await fetchWorkouts(); }
  }

  const selectedEntries = selectedDay ? (plan[selectedDay] ?? []) : [];
  const selectedWorkout = selectedDay ? (workouts[selectedDay] ?? null) : null;

  return (
    <div className="plan-wrap" style={{ minHeight: '100%', padding: '28px 28px 60px' }}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px); animation-timing-function:cubic-bezier(0.23,1,0.32,1); } to { opacity:1; transform:translateY(0); } }
        @keyframes modalIn { from { opacity:0; transform:scale(0.95) translateY(8px); animation-timing-function:cubic-bezier(0.23,1,0.32,1); } to { opacity:1; transform:scale(1) translateY(0); } }
        @media (hover: hover) and (pointer: fine) { .cal-day:hover { background: var(--bg-soft) !important; } }
        @media (max-width: 768px) {
          .plan-wrap { padding: 16px 14px 24px !important; }
          .plan-grid { grid-template-columns: 1fr !important; }
          .cal-day { min-height: 56px !important; padding: 6px 4px 4px !important; }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, animation: 'fadeUp 0.35s ease' }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Meal Plan</p>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>{monthLabel}</h1>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={prevMonth} style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--bg-card)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <button onClick={() => { const n = new Date(); n.setDate(1); setCalDate(n); setSelectedDay(today); }}
            style={{ height: 36, padding: '0 14px', borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--bg-card)', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
            Today
          </button>
          <button onClick={nextMonth} style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid var(--border-color)', background: 'var(--bg-card)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
      </div>

      <div className="plan-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, animation: 'fadeUp 0.4s ease 0.05s both' }}>

        {/* Calendar grid */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 20, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', borderBottom: '1px solid var(--border-color)' }}>
            {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
              <div key={d} style={{ padding: '10px 0', textAlign: 'center', fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>{d}</div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
            {gridDays.map((day, i) => {
              const d = new Date(day + 'T00:00:00');
              const inMonth = d.getMonth() === currentMonth && d.getFullYear() === currentYear;
              const isToday = day === today;
              const isSelected = day === selectedDay;
              const entries = plan[day] ?? [];
              const slotsFilled = SLOTS.filter(s => entries.some(e => e.meal_slot === s));
              const w = workouts[day];
              const isLastRow = i >= gridDays.length - 7;

              return (
                <button key={day} className="cal-day"
                  onClick={() => setSelectedDay(isSelected ? null : day)}
                  style={{
                    position: 'relative', padding: '10px 8px 8px', textAlign: 'left', cursor: 'pointer',
                    border: 'none', borderRight: (i + 1) % 7 !== 0 ? '1px solid var(--border-color)' : 'none',
                    borderBottom: !isLastRow ? '1px solid var(--border-color)' : 'none',
                    background: isSelected ? 'rgba(59,130,246,0.06)' : 'transparent',
                    minHeight: 80, display: 'flex', flexDirection: 'column', gap: 4,
                    transition: 'background 0.15s', outline: isSelected ? `1.5px solid rgba(59,130,246,0.3)` : 'none',
                    outlineOffset: -1,
                  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    {isToday ? (
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>{d.getDate()}</span>
                      </div>
                    ) : (
                      <span style={{ fontSize: 13, fontWeight: inMonth ? 700 : 400, color: inMonth ? 'var(--text-primary)' : 'var(--text-placeholder)' }}>
                        {d.getDate()}
                      </span>
                    )}
                    {entries.length > 0 && (
                      <span style={{ fontSize: 9, fontWeight: 800, color: BLUE, background: 'rgba(59,130,246,0.1)', padding: '1px 5px', borderRadius: 4 }}>{entries.length}</span>
                    )}
                  </div>
                  {(slotsFilled.length > 0 || w) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
                      {w && (
                        <div style={{
                          width: 7, height: 7, borderRadius: 2, flexShrink: 0,
                          background: w.is_rest_day ? 'transparent' : BLUE,
                          border: w.is_rest_day ? '1px dashed var(--text-placeholder)' : 'none',
                        }} />
                      )}
                      {slotsFilled.map(s => (
                        <div key={s} style={{ width: 7, height: 7, borderRadius: '50%', background: SLOT_COLORS[s] }} />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Day detail panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 16, padding: '14px 16px' }}>
            <p style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--text-tertiary)', marginBottom: 10 }}>Legend</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 9, height: 9, borderRadius: 2, background: BLUE, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Workout</span>
              </div>
              {SLOTS.map(s => (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 9, height: 9, borderRadius: '50%', background: SLOT_COLORS[s], flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{SLOT_LABELS[s]}</span>
                </div>
              ))}
            </div>
          </div>

          {selectedDay ? (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 16, padding: '16px', flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--text-tertiary)' }}>
                    {new Date(selectedDay + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' })}
                  </p>
                  <p style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)' }}>
                    {new Date(selectedDay + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                  </p>
                </div>
                {selectedDay === today && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: BLUE, background: 'rgba(59,130,246,0.1)', padding: '3px 8px', borderRadius: 6 }}>Today</span>
                )}
              </div>

              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[0,1,2].map(i => <div key={i} className="skeleton" style={{ height: 52, borderRadius: 10 }} />)}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: BLUE }} />
                        <p style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--text-tertiary)' }}>Workout</p>
                      </div>
                      {!selectedWorkout && (
                        <button onClick={() => setWorkoutDate(selectedDay)}
                          style={{ width: 22, height: 22, borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={BLUE} strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        </button>
                      )}
                    </div>
                    {!selectedWorkout ? (
                      <p style={{ fontSize: 11, color: 'var(--text-placeholder)', fontStyle: 'italic', paddingLeft: 14 }}>No workout planned</p>
                    ) : selectedWorkout.is_rest_day ? (
                      <p style={{ fontSize: 11, color: 'var(--text-tertiary)', fontStyle: 'italic', paddingLeft: 14 }}>Rest day</p>
                    ) : (
                      <div onClick={() => setWorkoutDate(selectedDay)} style={{
                        display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                        background: 'var(--bg-soft)', borderRadius: 10, padding: '8px 10px',
                        borderLeft: `3px solid ${BLUE}`,
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedWorkout.title ?? 'Workout'}</p>
                          {(selectedWorkout.workout_type || selectedWorkout.duration_minutes) && (
                            <p style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1 }}>
                              {selectedWorkout.workout_type}{selectedWorkout.workout_type && selectedWorkout.duration_minutes ? ' · ' : ''}{selectedWorkout.duration_minutes ? `${selectedWorkout.duration_minutes} min` : ''}
                            </p>
                          )}
                        </div>
                        <button onClick={e => { e.stopPropagation(); handleDeleteWorkout(selectedWorkout.id); }}
                          style={{ flexShrink: 0, width: 20, height: 20, borderRadius: 5, border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-placeholder)' }}>
                          <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="1" y1="1" x2="11" y2="11"/><line x1="11" y1="1" x2="1" y2="11"/></svg>
                        </button>
                      </div>
                    )}
                  </div>
                  {SLOTS.map(slot => {
                    const slotEntries = selectedEntries.filter(e => e.meal_slot === slot);
                    return (
                      <div key={slot}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: SLOT_COLORS[slot] }} />
                            <p style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--text-tertiary)' }}>{SLOT_LABELS[slot]}</p>
                          </div>
                          <button onClick={() => setAddModal({ date: selectedDay, slot })}
                            style={{ width: 22, height: 22, borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={BLUE} strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                          </button>
                        </div>
                        {slotEntries.length === 0 ? (
                          <p style={{ fontSize: 11, color: 'var(--text-placeholder)', fontStyle: 'italic', paddingLeft: 14 }}>Add your first meal</p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                            {slotEntries.map(entry => (
                              <div key={entry.id} style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                background: 'var(--bg-soft)', borderRadius: 10, padding: '8px 10px',
                                borderLeft: `3px solid ${SLOT_COLORS[slot]}`,
                              }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.recipe?.title ?? 'Untitled'}</p>
                                  {entry.recipe?.nutrition?.calories != null && (
                                    <p style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1 }}>{Math.round(entry.recipe.nutrition.calories)} cal</p>
                                  )}
                                </div>
                                <button onClick={() => handleDeleteMeal(entry.id)}
                                  style={{ flexShrink: 0, width: 20, height: 20, borderRadius: 5, border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-placeholder)' }}>
                                  <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="1" y1="1" x2="11" y2="11"/><line x1="11" y1="1" x2="1" y2="11"/></svg>
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 16, padding: '24px 16px', textAlign: 'center', flex: 1 }}>
              <p style={{ fontSize: 13, color: 'var(--text-placeholder)' }}>Select a day to view meals</p>
            </div>
          )}
        </div>
      </div>

      {addModal && (
        <AddMealModal
          date={addModal.date}
          slot={addModal.slot}
          recipes={recipes}
          onAdd={(recipeId) => handleAddMeal(addModal.date, addModal.slot, recipeId)}
          onClose={() => setAddModal(null)}
        />
      )}

      {workoutDate && (
        <WorkoutModal
          date={workoutDate}
          existing={workouts[workoutDate] ?? null}
          onClose={() => setWorkoutDate(null)}
          onSaved={() => { setWorkoutDate(null); fetchWorkouts(); }}
        />
      )}
    </div>
  );
}
