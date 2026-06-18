'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  getWorkoutTemplates, createWorkoutTemplate, deleteWorkoutTemplate, scheduleWorkoutTemplate,
  isLoggedIn,
  type WorkoutTemplate, type ExerciseEntry,
} from '@/lib/api';

const TYPE_META: Record<string, { color: string; bg: string }> = {
  strength: { color: '#6366f1', bg: '#eef2ff' },
  cardio:   { color: '#f59e0b', bg: '#fffbeb' },
  hiit:     { color: '#f43f5e', bg: '#fff1f2' },
  yoga:     { color: '#10b981', bg: '#f0fdf4' },
  running:  { color: '#0d9488', bg: '#f0fdfa' },
  cycling:  { color: '#8b5cf6', bg: '#f5f3ff' },
  other:    { color: '#8d969e', bg: '#f4f4f4' },
};
const DEFAULT_META = { color: '#8d969e', bg: '#f4f4f4' };

const WORKOUT_TYPES = ['strength', 'cardio', 'hiit', 'yoga', 'running', 'cycling', 'other'];

function typeMeta(t: string | null) {
  return t ? (TYPE_META[t] || DEFAULT_META) : DEFAULT_META;
}

function TypeBadge({ type }: { type: string | null }) {
  if (!type) return null;
  const { color, bg } = typeMeta(type);
  return (
    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize" style={{ color, background: bg }}>
      {type}
    </span>
  );
}

// ── Add workout modal ──────────────────────────────────────────────────────────

interface WorkoutForm {
  title: string;
  workout_type: string;
  duration_minutes: string;
  notes: string;
  exercises: ExerciseEntry[];
}

function AddWorkoutModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<WorkoutForm>({
    title: '', workout_type: '', duration_minutes: '', notes: '', exercises: [],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function setField<K extends keyof WorkoutForm>(k: K, v: WorkoutForm[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  function addExercise() {
    setForm(f => ({ ...f, exercises: [...f.exercises, { name: '', sets: undefined, reps: '', notes: '' }] }));
  }

  function setExercise(i: number, k: keyof ExerciseEntry, v: string) {
    setForm(f => {
      const exs = [...f.exercises];
      exs[i] = { ...exs[i], [k]: k === 'sets' ? (v ? parseInt(v, 10) : undefined) : v };
      return { ...f, exercises: exs };
    });
  }

  function removeExercise(i: number) {
    setForm(f => ({ ...f, exercises: f.exercises.filter((_, j) => j !== i) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { setError('Title is required.'); return; }
    setSaving(true); setError('');
    try {
      await createWorkoutTemplate({
        title: form.title.trim(),
        workout_type: form.workout_type || undefined,
        duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes, 10) : undefined,
        notes: form.notes.trim() || undefined,
        exercises: form.exercises.filter(e => e.name.trim()),
      });
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  const inp: React.CSSProperties = { height: 44, padding: '0 14px', border: '1.5px solid #e2e2e7', borderRadius: 10, color: '#191c1f', background: '#fff', width: '100%', fontSize: 14, outline: 'none' };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-lg flex flex-col" style={{ background: '#fff', borderRadius: 20, maxHeight: '90vh', boxShadow: '0 24px 64px rgba(0,0,0,0.15)' }}>
        <div className="h-1.5 rounded-t-[20px]" style={{ background: '#0d9488' }} />
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #f0f0f2' }}>
          <h3 className="font-bold text-lg" style={{ color: '#191c1f' }}>New workout</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-lg" style={{ color: '#8d969e', background: '#f4f4f4' }}>✕</button>
        </div>

        <form id="workout-form" onSubmit={handleSubmit} className="overflow-y-auto px-6 py-5 space-y-4">
          {error && <div className="text-sm px-4 py-3 rounded-xl" style={{ color: '#e23b4a', background: '#fff1f2', border: '1px solid #fecdd3' }}>{error}</div>}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#8d969e' }}>Title *</label>
            <input value={form.title} onChange={e => setField('title', e.target.value)} placeholder="e.g. Upper body push day" style={inp}
              onFocus={e => e.currentTarget.style.borderColor = '#0d9488'}
              onBlur={e => e.currentTarget.style.borderColor = '#e2e2e7'} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#8d969e' }}>Type</label>
              <select value={form.workout_type} onChange={e => setField('workout_type', e.target.value)} style={inp}>
                <option value="">—</option>
                {WORKOUT_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#8d969e' }}>Duration (min)</label>
              <input type="number" min="1" value={form.duration_minutes} onChange={e => setField('duration_minutes', e.target.value)} placeholder="45" style={inp}
                onFocus={e => e.currentTarget.style.borderColor = '#0d9488'}
                onBlur={e => e.currentTarget.style.borderColor = '#e2e2e7'} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#8d969e' }}>Exercises</label>
              <button type="button" onClick={addExercise} className="text-xs font-semibold" style={{ color: '#0d9488' }}>+ Add exercise</button>
            </div>
            {form.exercises.length === 0 && (
              <button type="button" onClick={addExercise} className="w-full flex items-center justify-center gap-2 rounded-xl py-4 text-sm font-medium transition-colors"
                style={{ border: '1.5px dashed #d1d5db', color: '#8d969e', background: '#fafafa' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#0d9488'; e.currentTarget.style.color = '#0d9488'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.color = '#8d969e'; }}>
                + Add your first exercise
              </button>
            )}
            <div className="space-y-2">
              {form.exercises.map((ex, i) => (
                <div key={i} className="rounded-xl p-3" style={{ background: '#f7f7f8', border: '1px solid #ebebef' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: '#0d9488', color: '#fff' }}>{i + 1}</span>
                    <input value={ex.name} onChange={e => setExercise(i, 'name', e.target.value)} placeholder="Exercise name"
                      className="flex-1 text-sm font-semibold bg-transparent focus:outline-none"
                      style={{ color: '#191c1f', borderBottom: '1px solid #e2e2e7', paddingBottom: 2 }} />
                    <button type="button" onClick={() => removeExercise(i)} className="text-xs" style={{ color: '#c9c9cd' }}>✕</button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#8d969e' }}>Sets</label>
                      <input type="number" min="1" value={ex.sets ?? ''} onChange={e => setExercise(i, 'sets', e.target.value)} placeholder="3"
                        className="w-full text-sm focus:outline-none bg-white rounded-lg px-3"
                        style={{ height: 36, border: '1px solid #e2e2e7', color: '#191c1f' }} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#8d969e' }}>Reps / duration</label>
                      <input value={ex.reps as string ?? ''} onChange={e => setExercise(i, 'reps', e.target.value)} placeholder="10–12 or 30s"
                        className="w-full text-sm focus:outline-none bg-white rounded-lg px-3"
                        style={{ height: 36, border: '1px solid #e2e2e7', color: '#191c1f' }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#8d969e' }}>Notes</label>
            <textarea value={form.notes} onChange={e => setField('notes', e.target.value)} placeholder="e.g. Rest 90s between sets, focus on controlled tempo" rows={2}
              className="w-full text-sm focus:outline-none resize-none"
              style={{ padding: '10px 14px', border: '1.5px solid #e2e2e7', borderRadius: 10, color: '#191c1f' }}
              onFocus={e => e.currentTarget.style.borderColor = '#0d9488'}
              onBlur={e => e.currentTarget.style.borderColor = '#e2e2e7'} />
          </div>
        </form>

        <div className="px-6 py-4 flex gap-2" style={{ borderTop: '1px solid #f0f0f2' }}>
          <button onClick={onClose} className="flex-1 text-sm font-medium" style={{ height: 44, borderRadius: 12, border: '1px solid #e2e2e7', color: '#505a63', background: '#fff' }}>Cancel</button>
          <button type="submit" form="workout-form" disabled={saving} className="flex-1 text-sm font-semibold text-white disabled:opacity-40" style={{ height: 44, borderRadius: 12, background: '#0d9488' }}>
            {saving ? 'Saving…' : 'Save workout'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Detail / schedule modal ────────────────────────────────────────────────────

function DetailModal({ template, onClose, onDeleted }: {
  template: WorkoutTemplate;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduling, setScheduling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [scheduled, setScheduled] = useState('');
  const [error, setError] = useState('');

  const { color, bg } = typeMeta(template.workout_type);

  async function handleSchedule() {
    if (!scheduleDate) return;
    setScheduling(true); setError(''); setScheduled('');
    try {
      await scheduleWorkoutTemplate(template.id, scheduleDate);
      setScheduled(new Date(scheduleDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Schedule failed.');
    } finally {
      setScheduling(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${template.title}"?`)) return;
    setDeleting(true);
    try { await deleteWorkoutTemplate(template.id); onDeleted(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Delete failed.'); setDeleting(false); }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-lg flex flex-col" style={{ background: '#fff', borderRadius: 20, maxHeight: '90vh', boxShadow: '0 24px 64px rgba(0,0,0,0.15)' }}>
        <div className="h-1.5 rounded-t-[20px]" style={{ background: color }} />

        <div className="px-6 pt-4 pb-4 flex items-start justify-between" style={{ borderBottom: '1px solid #f0f0f2' }}>
          <div>
            <h3 className="font-bold text-lg leading-tight" style={{ color: '#191c1f' }}>{template.title}</h3>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <TypeBadge type={template.workout_type} />
              {template.duration_minutes && (
                <span className="text-xs" style={{ color: '#8d969e' }}>⏱ {template.duration_minutes} min</span>
              )}
              {template.exercises && (
                <span className="text-xs" style={{ color: '#8d969e' }}>{template.exercises.length} exercise{template.exercises.length !== 1 ? 's' : ''}</span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="ml-4 w-8 h-8 flex items-center justify-center rounded-full text-lg" style={{ color: '#8d969e', background: '#f4f4f4' }}>✕</button>
        </div>

        <div className="overflow-y-auto px-6 py-5 space-y-5">
          {error && <div className="text-sm px-4 py-3 rounded-xl" style={{ color: '#e23b4a', background: '#fff1f2', border: '1px solid #fecdd3' }}>{error}</div>}

          {template.exercises && template.exercises.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#8d969e' }}>Exercises</h4>
              <ol className="space-y-2">
                {template.exercises.map((ex, i) => (
                  <li key={i} className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: '#f7f7f8' }}>
                    <span className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: color, color: '#fff' }}>{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: '#191c1f' }}>{ex.name}</p>
                      {(ex.sets || ex.reps) && (
                        <p className="text-xs mt-0.5" style={{ color: '#8d969e' }}>
                          {ex.sets && `${ex.sets} sets`}{ex.sets && ex.reps && ' × '}{ex.reps && `${ex.reps}`}
                        </p>
                      )}
                      {ex.notes && <p className="text-xs mt-0.5 italic" style={{ color: '#8d969e' }}>{ex.notes}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {template.notes && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#8d969e' }}>Notes</h4>
              <p className="text-sm" style={{ color: '#505a63' }}>{template.notes}</p>
            </div>
          )}

          {/* Schedule to calendar */}
          <div className="rounded-xl p-4" style={{ background: bg, border: `1px solid ${color}22` }}>
            <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color }}>Add to calendar</h4>
            {scheduled ? (
              <div className="flex items-center gap-2 text-sm font-medium" style={{ color: '#065f46' }}>
                <span>✓</span>
                <span>Scheduled for {scheduled}</span>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="date"
                  value={scheduleDate}
                  onChange={e => setScheduleDate(e.target.value)}
                  className="flex-1 text-sm focus:outline-none rounded-lg px-3"
                  style={{ height: 40, border: '1.5px solid #e2e2e7', color: '#191c1f', background: '#fff' }}
                />
                <button
                  onClick={handleSchedule}
                  disabled={!scheduleDate || scheduling}
                  className="text-sm font-semibold text-white px-4 rounded-lg disabled:opacity-40 transition-opacity"
                  style={{ height: 40, background: color }}>
                  {scheduling ? 'Scheduling…' : 'Schedule'}
                </button>
              </div>
            )}
            {scheduled && (
              <button onClick={() => { setScheduled(''); setScheduleDate(''); }} className="mt-2 text-xs" style={{ color }}>
                Schedule another date
              </button>
            )}
          </div>
        </div>

        <div className="px-6 py-4" style={{ borderTop: '1px solid #f0f0f2' }}>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="w-full text-sm font-medium py-2.5 rounded-xl transition-colors disabled:opacity-40"
            style={{ color: '#e23b4a', border: '1px solid #fecdd3', background: '#fff' }}
            onMouseEnter={e => e.currentTarget.style.background = '#fff1f2'}
            onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
            {deleting ? 'Deleting…' : 'Delete workout'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function WorkoutsPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<WorkoutTemplate | null>(null);

  useEffect(() => {
    if (!isLoggedIn()) { router.push('/login'); return; }
    load();
  }, [router]);

  async function load() {
    setLoading(true);
    try { setTemplates(await getWorkoutTemplates()); }
    catch { if (!isLoggedIn()) router.push('/login'); }
    finally { setLoading(false); }
  }

  const filtered = query.trim()
    ? templates.filter(t => t.title.toLowerCase().includes(query.toLowerCase()) || t.workout_type?.toLowerCase().includes(query.toLowerCase()))
    : templates;

  return (
    <div className="p-6 min-h-full" style={{ background: '#f7f7f8' }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: '#191c1f', letterSpacing: '-0.5px' }}>Workouts</h1>
          <p className="text-base mt-1" style={{ color: '#8d969e' }}>{templates.length} workout{templates.length !== 1 ? 's' : ''} saved</p>
        </div>
        <button
          onClick={() => { setShowAdd(true); }}
          className="flex items-center gap-2 text-sm font-semibold text-white transition-all"
          style={{ height: 40, padding: '0 18px', borderRadius: 10, background: '#0d9488' }}
          onMouseEnter={e => e.currentTarget.style.background = '#0f766e'}
          onMouseLeave={e => e.currentTarget.style.background = '#0d9488'}>
          + Add workout
        </button>
      </div>

      <div className="relative mb-5">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#8d969e' }}>🔍</span>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search workouts…"
          className="w-full text-sm focus:outline-none"
          style={{ height: 52, paddingLeft: 42, paddingRight: 16, border: '1.5px solid #e2e2e7', borderRadius: 14, color: '#191c1f', background: '#fff', fontSize: 15 }}
          onFocus={e => e.currentTarget.style.borderColor = '#0d9488'}
          onBlur={e => e.currentTarget.style.borderColor = '#e2e2e7'}
        />
      </div>

      {loading ? (
        <div className="text-center py-32 text-sm" style={{ color: '#8d969e' }}>Loading workouts…</div>
      ) : templates.length === 0 ? (
        <div className="text-center py-32">
          <div className="text-5xl mb-4">—</div>
          <h3 className="font-bold text-lg mb-1" style={{ color: '#191c1f' }}>No workouts yet</h3>
          <p className="text-sm mb-6" style={{ color: '#8d969e' }}>Build your workout library and add them to your weekly calendar.</p>
          <button onClick={() => setShowAdd(true)} className="text-sm font-semibold text-white px-5 py-2.5 rounded-xl" style={{ background: '#0d9488' }}>
            Create your first workout
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(t => {
            const { color, bg } = typeMeta(t.workout_type);
            return (
              <button
                key={t.id}
                onClick={() => setSelected(t)}
                className="text-left rounded-2xl overflow-hidden transition-all"
                style={{ background: '#fff', border: '1px solid #e8e8ec', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.1)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'; e.currentTarget.style.transform = 'none'; }}>
                <div className="h-2" style={{ background: color }} />
                <div className="p-5">
                  <h3 className="font-bold leading-snug mb-3" style={{ color: '#191c1f', fontSize: 16 }}>{t.title}</h3>
                  <div className="flex items-center justify-between">
                    <TypeBadge type={t.workout_type} />
                    {t.duration_minutes && (
                      <span style={{ color: '#8d969e', fontSize: 13 }}>⏱ {t.duration_minutes} min</span>
                    )}
                  </div>
                  {t.exercises && t.exercises.length > 0 && (
                    <div className="mt-3 pt-3" style={{ borderTop: '1px solid #f0f0f2' }}>
                      <p className="text-xs font-medium mb-1.5" style={{ color: '#8d969e' }}>{t.exercises.length} exercise{t.exercises.length !== 1 ? 's' : ''}</p>
                      <div className="flex flex-wrap gap-1">
                        {t.exercises.slice(0, 3).map((ex, i) => (
                          <span key={i} className="text-xs px-2 py-0.5 rounded-full truncate max-w-[120px]" style={{ background: bg, color }}>{ex.name}</span>
                        ))}
                        {t.exercises.length > 3 && (
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#f4f4f4', color: '#8d969e' }}>+{t.exercises.length - 3}</span>
                        )}
                      </div>
                    </div>
                  )}
                  {t.notes && !t.exercises?.length && (
                    <p className="mt-3 text-xs line-clamp-2" style={{ color: '#8d969e' }}>{t.notes}</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {showAdd && (
        <AddWorkoutModal
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); load(); }}
        />
      )}

      {selected && (
        <DetailModal
          template={selected}
          onClose={() => setSelected(null)}
          onDeleted={() => { setSelected(null); load(); }}
        />
      )}
    </div>
  );
}
