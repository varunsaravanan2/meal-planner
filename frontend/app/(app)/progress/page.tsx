'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  getProgressEntries, createProgressEntry, deleteProgressEntry,
  uploadProgressPhoto, deleteProgressPhoto, getProgressPhotos,
  getFoodLog, getWeeklyFoodSummary, isLoggedIn,
} from '@/lib/api';
import type { WeeklyFoodSummary } from '@/lib/api';
import { useRouter } from 'next/navigation';
import type { ProgressEntry, ProgressPhoto, FoodLogEntry } from '@/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function toMonday(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const m = new Date(d);
  m.setDate(d.getDate() + diff);
  m.setHours(0, 0, 0, 0);
  return m;
}

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtShort(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function computeStreak(entries: ProgressEntry[]): number {
  if (!entries.length) return 0;
  const sorted = [...entries].sort((a, b) => b.week_date.localeCompare(a.week_date));
  const now = new Date();
  const mostRecent = new Date(sorted[0].week_date + 'T00:00:00');
  const daysDiff = Math.floor((now.getTime() - mostRecent.getTime()) / (1000 * 60 * 60 * 24));
  if (daysDiff > 13) return 0;
  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    const curr = new Date(sorted[i - 1].week_date + 'T00:00:00');
    const prev = new Date(sorted[i].week_date + 'T00:00:00');
    const diff = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 7) streak++;
    else break;
  }
  return streak;
}

const SLOT_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'];
const SLOT_LABEL: Record<string, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' };
const SLOT_COLOR: Record<string, string> = { breakfast: '#f59e0b', lunch: '#34d399', dinner: '#3b82f6', snack: '#a78bfa' };

// ── Weight Chart ──────────────────────────────────────────────────────────────

function WeightChart({ entries }: { entries: ProgressEntry[] }) {
  const withWeight = useMemo(
    () => [...entries].filter(e => e.weight_lbs != null).sort((a, b) => a.week_date.localeCompare(b.week_date)),
    [entries],
  );

  if (withWeight.length < 2) return null;

  const W = 600, H = 108;
  const pad = { l: 42, r: 12, t: 12, b: 26 };
  const cW = W - pad.l - pad.r, cH = H - pad.t - pad.b;

  const weights = withWeight.map(e => e.weight_lbs!);
  const wMin = Math.min(...weights), wMax = Math.max(...weights);
  const wRange = wMax - wMin || 5;
  const yMin = wMin - wRange * 0.25, yMax = wMax + wRange * 0.25;
  const yRange = yMax - yMin;

  const pts = withWeight.map((e, i) => ({
    x: pad.l + (i / Math.max(withWeight.length - 1, 1)) * cW,
    y: pad.t + (1 - (e.weight_lbs! - yMin) / yRange) * cH,
    entry: e,
  }));

  const lineD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaD = `${lineD} L${pts[pts.length - 1].x.toFixed(1)},${(pad.t + cH).toFixed(1)} L${pts[0].x.toFixed(1)},${(pad.t + cH).toFixed(1)} Z`;

  const yTicks = [yMax, (yMax + yMin) / 2, yMin].map(v => Math.round(v * 2) / 2);
  const step = Math.max(1, Math.ceil(withWeight.length / 5));
  const showX = new Set(withWeight.map((_, i) => i).filter(i => i === 0 || i === withWeight.length - 1 || i % step === 0));

  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border-color)', padding: '16px 20px 12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-tertiary)', margin: 0 }}>
          Weight Trend
        </p>
        <p style={{ fontSize: 11, color: 'var(--text-placeholder)', margin: 0 }}>{withWeight.length} data points</p>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          <linearGradient id="wGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
          <clipPath id="wClip">
            <rect x={pad.l} y={pad.t - 2} width={cW} height={cH + 4} />
          </clipPath>
        </defs>
        {yTicks.map((v, i) => {
          const y = pad.t + (i / 2) * cH;
          return (
            <g key={i}>
              <line x1={pad.l} x2={W - pad.r} y1={y} y2={y} stroke="var(--border-color)" strokeWidth="1" strokeDasharray="4 3" opacity="0.55" />
              <text x={pad.l - 7} y={y + 3.5} textAnchor="end" fontSize="9" fill="var(--text-placeholder)" fontFamily="system-ui,-apple-system,sans-serif">{v}</text>
            </g>
          );
        })}
        <path d={areaD} fill="url(#wGrad)" clipPath="url(#wClip)" />
        <path d={lineD} fill="none" stroke="#3b82f6" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" clipPath="url(#wClip)" />
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="2.75" fill="#3b82f6" stroke="var(--bg-card)" strokeWidth="1.75" />
        ))}
        {pts.map((p, i) => !showX.has(i) ? null : (
          <text key={i} x={p.x} y={H - 3}
            textAnchor={i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle'}
            fontSize="9" fill="var(--text-placeholder)" fontFamily="system-ui,-apple-system,sans-serif">
            {fmtShort(p.entry.week_date)}
          </text>
        ))}
      </svg>
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: 14, padding: '14px 16px', border: '1px solid var(--border-color)', flex: 1, minWidth: 0 }}>
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-tertiary)', margin: '0 0 7px' }}>{label}</p>
      <p style={{ fontSize: 20, fontWeight: 700, color: accent || 'var(--text-primary)', lineHeight: 1, margin: 0 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4, marginBottom: 0 }}>{sub}</p>}
    </div>
  );
}

// ── Macro Bar ─────────────────────────────────────────────────────────────────

function MacroBar({ label, value, max, color, unit }: { label: string; value: number; max: number; color: string; unit: string }) {
  const pct = Math.min(100, max > 0 ? (value / max) * 100 : 0);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color }}>{Math.round(value)}{unit}</span>
      </div>
      <div style={{ height: 6, borderRadius: 99, background: 'var(--bg-soft)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, borderRadius: 99, background: color, transition: 'width 0.5s ease' }} />
      </div>
    </div>
  );
}

// ── Daily Tab ─────────────────────────────────────────────────────────────────

function DailyTab() {
  const [entries, setEntries] = useState<FoodLogEntry[]>([]);
  const [weeklyFood, setWeeklyFood] = useState<WeeklyFoodSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const today = todayIso();

  useEffect(() => {
    const monday = toMonday(new Date());
    const weekStart = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
    getFoodLog(today)
      .then(setEntries)
      .catch(() => {})
      .finally(() => setLoading(false));
    getWeeklyFoodSummary(weekStart).then(setWeeklyFood).catch(() => {});
  }, [today]);

  const totalCal  = Math.round(entries.reduce((s, e) => s + (e.calories ?? 0), 0));
  const totalProt = Math.round(entries.reduce((s, e) => s + (e.protein_g ?? 0), 0));
  const totalCarbs = Math.round(entries.reduce((s, e) => s + (e.carbs_g ?? 0), 0));
  const totalFat  = Math.round(entries.reduce((s, e) => s + (e.fat_g ?? 0), 0));

  const bySlot = useMemo(() => {
    const m: Record<string, FoodLogEntry[]> = {};
    for (const e of entries) {
      const slot = e.meal_slot || 'other';
      if (!m[slot]) m[slot] = [];
      m[slot].push(e);
    }
    return m;
  }, [entries]);

  const orderedSlots = [...SLOT_ORDER.filter(s => bySlot[s]), ...Object.keys(bySlot).filter(s => !SLOT_ORDER.includes(s))];

  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 14 }} />)}
      </div>
    );
  }

  return (
    <div>
      {/* Date + summary */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border-color)', padding: '18px 22px', marginBottom: 16 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{todayLabel}</p>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 18 }}>
          <span style={{ fontSize: 36, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-1px', lineHeight: 1 }}>{totalCal}</span>
          <span style={{ fontSize: 14, color: 'var(--text-tertiary)', fontWeight: 600 }}>kcal today</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <MacroBar label="Protein" value={totalProt}  max={150} color="#a78bfa" unit="g" />
          <MacroBar label="Carbs"   value={totalCarbs} max={250} color="#34d399" unit="g" />
          <MacroBar label="Fat"     value={totalFat}   max={65}  color="#fb923c" unit="g" />
        </div>
      </div>

      {/* Weekly nutrition */}
      {weeklyFood && (
        <div style={{ background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border-color)', padding: '16px 22px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.09em' }}>This Week&apos;s Nutrition</p>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{weeklyFood.days_logged}/7 days logged</span>
          </div>
          <div className="progress-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12 }}>
            {[
              { label: 'Avg Calories', value: weeklyFood.avg_calories,  unit: ' cal', color: '#3b82f6' },
              { label: 'Avg Protein',  value: weeklyFood.avg_protein_g, unit: 'g',    color: '#a78bfa' },
              { label: 'Avg Carbs',    value: weeklyFood.avg_carbs_g,   unit: 'g',    color: '#34d399' },
              { label: 'Avg Fat',      value: weeklyFood.avg_fat_g,     unit: 'g',    color: '#fb923c' },
              { label: 'Avg Fiber',    value: weeklyFood.avg_fiber_g,   unit: 'g',    color: '#a3e635' },
            ].map(({ label, value, unit, color }) => (
              <div key={label} style={{ background: 'var(--bg-soft)', borderRadius: 10, padding: '10px 14px' }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{label}</p>
                <p style={{ fontSize: 20, fontWeight: 800, color, lineHeight: 1 }}>{value > 0 ? Math.round(value) : '—'}{value > 0 ? unit : ''}</p>
                <p style={{ fontSize: 10, color: 'var(--text-placeholder)', marginTop: 3 }}>per logged day</p>
              </div>
            ))}
          </div>
          {weeklyFood.days_logged === 0 && (
            <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 10 }}>Log meals to see weekly averages here.</p>
          )}
        </div>
      )}

      {entries.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 32px', background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border-color)' }}>
          <div style={{ width: 48, height: 48, borderRadius: 13, background: 'rgba(167,139,250,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/>
              <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/>
            </svg>
          </div>
          <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px' }}>No food logged today</p>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: 0 }}>Log meals from the home page or plan to see them here.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {orderedSlots.map(slot => (
            <div key={slot} style={{ background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border-color)', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: '1px solid var(--border-soft)' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: SLOT_COLOR[slot] || '#6b7280', flexShrink: 0 }} />
                <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.09em', margin: 0 }}>
                  {SLOT_LABEL[slot] || slot}
                </p>
              </div>
              {bySlot[slot].map((entry, i) => (
                <div key={entry.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderTop: i > 0 ? '1px solid var(--border-soft)' : undefined }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.name}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-placeholder)', margin: '2px 0 0' }}>
                      {[entry.protein_g && `${Math.round(entry.protein_g)}g protein`, entry.carbs_g && `${Math.round(entry.carbs_g)}g carbs`, entry.fat_g && `${Math.round(entry.fat_g)}g fat`].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', flexShrink: 0, marginLeft: 12 }}>
                    {entry.calories != null ? `${Math.round(entry.calories)} cal` : '—'}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── History Tab ───────────────────────────────────────────────────────────────

function HistoryTab() {
  const router = useRouter();
  const [entries, setEntries] = useState<ProgressEntry[]>([]);
  const [photos, setPhotos] = useState<Record<string, ProgressPhoto[]>>({});
  const [photosLoading, setPhotosLoading] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [weekDate, setWeekDate] = useState(() => {
    const d = toMonday(new Date());
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [weight, setWeight] = useState('');
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState('');
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [photoLabel, setPhotoLabel] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) { router.push('/login'); return; }
    getProgressEntries()
      .then(setEntries)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  const handleExpand = useCallback(async (id: string) => {
    const opening = expanded !== id;
    setExpanded(opening ? id : null);
    if (opening && photos[id] === undefined && !photosLoading[id]) {
      setPhotosLoading(prev => ({ ...prev, [id]: true }));
      try {
        const fetched = await getProgressPhotos(id);
        setPhotos(prev => ({ ...prev, [id]: fetched }));
      } catch {
        setPhotos(prev => ({ ...prev, [id]: [] }));
      } finally {
        setPhotosLoading(prev => ({ ...prev, [id]: false }));
      }
    }
  }, [expanded, photos, photosLoading]);

  async function handleCreate() {
    if (!weekDate) { setFormErr('Select a week date.'); return; }
    setSaving(true); setFormErr('');
    try {
      const entry = await createProgressEntry({ week_date: weekDate, weight_lbs: weight ? parseFloat(weight) : undefined });
      setEntries(prev => [entry, ...prev]);
      setShowForm(false);
      setWeight('');
    } catch (e: unknown) {
      setFormErr(e instanceof Error ? e.message : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this check-in?')) return;
    await deleteProgressEntry(id).catch(() => {});
    setEntries(prev => prev.filter(e => e.id !== id));
    setPhotos(prev => { const n = { ...prev }; delete n[id]; return n; });
    if (expanded === id) setExpanded(null);
  }

  async function handleUpload(entryId: string, file: File) {
    setUploading(true);
    try {
      const photo = await uploadProgressPhoto(entryId, file, photoLabel || undefined);
      setPhotos(prev => ({ ...prev, [entryId]: [...(prev[entryId] || []), photo] }));
      setPhotoLabel('');
      setUploadingFor(null);
    } catch {
      alert('Photo upload failed. Make sure R2 credentials are configured.');
    } finally {
      setUploading(false);
    }
  }

  async function handleDeletePhoto(entryId: string, photoId: string) {
    await deleteProgressPhoto(photoId).catch(() => {});
    setPhotos(prev => ({ ...prev, [entryId]: (prev[entryId] || []).filter(p => p.id !== photoId) }));
  }

  const sortedByDate = useMemo(() => [...entries].sort((a, b) => b.week_date.localeCompare(a.week_date)), [entries]);
  const withWeight   = useMemo(() => sortedByDate.filter(e => e.weight_lbs != null), [sortedByDate]);
  const currentWeight = withWeight[0]?.weight_lbs ?? null;
  const prevWeight    = withWeight[1]?.weight_lbs ?? null;
  const firstWeight   = withWeight[withWeight.length - 1]?.weight_lbs ?? null;
  const deltaLast  = currentWeight != null && prevWeight != null ? currentWeight - prevWeight : null;
  const deltaTotal = currentWeight != null && firstWeight != null && withWeight.length > 1 ? currentWeight - firstWeight : null;
  const streak = useMemo(() => computeStreak(entries), [entries]);

  function fmtDelta(d: number) { return `${d > 0 ? '+' : ''}${d.toFixed(1)} lbs`; }
  function deltaColor(d: number) { return d < 0 ? '#22c55e' : d > 0 ? '#f87171' : 'var(--text-secondary)'; }

  const inp: React.CSSProperties = {
    width: '100%', padding: '9px 13px', borderRadius: 9, fontSize: 13,
    border: '1px solid var(--border-color)', background: 'var(--bg-input)',
    color: 'var(--text-primary)', boxSizing: 'border-box', outline: 'none',
  };

  return (
    <div>
      {/* Check-in button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button
          onClick={() => { setShowForm(f => !f); setFormErr(''); }}
          style={{
            padding: '9px 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: showForm ? 'var(--bg-soft)' : '#191c1f',
            color: showForm ? 'var(--text-secondary)' : '#fff',
            fontWeight: 600, fontSize: 13,
          }}
        >
          {showForm ? 'Cancel' : '+ Check-in'}
        </button>
      </div>

      {/* Stats */}
      {!loading && entries.length > 0 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <StatCard label="Current Weight" value={currentWeight != null ? `${currentWeight} lbs` : '—'} sub={withWeight[0] ? `as of ${fmtShort(withWeight[0].week_date)}` : 'No weight logged'} />
          <StatCard label="Since Last" value={deltaLast != null ? fmtDelta(deltaLast) : '—'} accent={deltaLast != null ? deltaColor(deltaLast) : undefined} sub={deltaLast != null ? (deltaLast < 0 ? 'Lost' : deltaLast > 0 ? 'Gained' : 'No change') : 'Log 2+ weights'} />
          <StatCard label="Total Change" value={deltaTotal != null ? fmtDelta(deltaTotal) : '—'} accent={deltaTotal != null ? deltaColor(deltaTotal) : undefined} sub={deltaTotal != null ? `over ${withWeight.length} check-ins` : withWeight.length === 1 ? 'Need 2+ weights' : 'No weights logged'} />
          <StatCard label="Streak" value={streak > 0 ? `${streak}w` : '—'} accent={streak >= 4 ? '#f59e0b' : streak >= 2 ? '#3b82f6' : undefined} sub={streak === 0 ? 'Check in weekly' : streak === 1 ? 'This week' : `${streak} weeks running`} />
        </div>
      )}

      {/* Weight chart */}
      {!loading && withWeight.length >= 2 && (
        <div style={{ marginBottom: 12 }}>
          <WeightChart entries={entries} />
        </div>
      )}

      {/* New check-in form */}
      {showForm && (
        <div style={{ background: 'var(--bg-card)', borderRadius: 14, padding: '18px 20px', border: '1px solid var(--border-color)', marginBottom: 12 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, marginTop: 0 }}>New Check-in</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-tertiary)', display: 'block', marginBottom: 5 }}>Week of</label>
              <input type="date" value={weekDate} onChange={e => setWeekDate(e.target.value)} style={inp} />
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-tertiary)', display: 'block', marginBottom: 5 }}>Weight (lbs)</label>
              <input type="number" placeholder="Optional" value={weight} onChange={e => setWeight(e.target.value)} style={inp} />
            </div>
          </div>
          {formErr && <p style={{ color: '#f87171', fontSize: 12, marginBottom: 12, marginTop: -4 }}>{formErr}</p>}
          <button onClick={handleCreate} disabled={saving} style={{ padding: '8px 18px', borderRadius: 9, border: 'none', cursor: saving ? 'not-allowed' : 'pointer', background: saving ? 'var(--bg-soft)' : '#191c1f', color: saving ? 'var(--text-tertiary)' : '#fff', fontWeight: 600, fontSize: 13, opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Saving…' : 'Save Check-in'}
          </button>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 68, borderRadius: 14 }} />)}
        </div>
      ) : entries.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '56px 32px', background: 'var(--bg-card)', borderRadius: 18, border: '1px solid var(--border-color)' }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(59,130,246,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
          </div>
          <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>Start Tracking Your Progress</p>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', maxWidth: 340, margin: '0 auto 22px', lineHeight: 1.65 }}>
            Log your weekly weight and upload progress photos to visualize how your body changes over time.
          </p>
          <button onClick={() => setShowForm(true)} style={{ padding: '9px 22px', borderRadius: 10, border: 'none', cursor: 'pointer', background: '#191c1f', color: '#fff', fontWeight: 600, fontSize: 13 }}>
            Log First Check-in
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sortedByDate.map((entry, idx) => {
            const isOpen = expanded === entry.id;
            const entryPhotos = photos[entry.id];
            const photosAreLoading = photosLoading[entry.id];
            const thisWeightIdx = withWeight.findIndex(e => e.id === entry.id);
            const olderWithWeight = thisWeightIdx !== -1 ? withWeight[thisWeightIdx + 1] : null;
            const delta = entry.weight_lbs != null && olderWithWeight?.weight_lbs != null ? entry.weight_lbs - olderWithWeight.weight_lbs : null;

            return (
              <div key={entry.id} style={{ background: 'var(--bg-card)', borderRadius: 14, border: `1px solid ${isOpen ? 'rgba(59,130,246,0.22)' : 'var(--border-color)'}`, overflow: 'hidden', transition: 'border-color 0.2s' }}>
                <div onClick={() => handleExpand(entry.id)} style={{ display: 'flex', alignItems: 'center', padding: '13px 15px', cursor: 'pointer', gap: 12 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--bg-soft)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-placeholder)' }}>#{sortedByDate.length - idx}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                        {entry.weight_lbs != null ? `${entry.weight_lbs} lbs` : 'No weight logged'}
                      </span>
                      {delta != null && (
                        <span style={{ fontSize: 12, fontWeight: 600, color: delta < 0 ? '#22c55e' : delta > 0 ? '#f87171' : 'var(--text-tertiary)' }}>
                          {delta < 0 ? '↓' : delta > 0 ? '↑' : '→'} {Math.abs(delta).toFixed(1)} lbs
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: 11.5, color: 'var(--text-tertiary)', margin: '2px 0 0', lineHeight: 1 }}>
                      {fmtDate(entry.week_date)}
                      {entryPhotos && entryPhotos.length > 0 && (
                        <span style={{ color: 'var(--text-placeholder)' }}>{` · ${entryPhotos.length} photo${entryPhotos.length !== 1 ? 's' : ''}`}</span>
                      )}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(entry.id); }}
                      style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: 'var(--bg-soft)', color: 'var(--text-placeholder)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#f87171'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-placeholder)'; }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                      </svg>
                    </button>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-placeholder)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </div>
                </div>

                {isOpen && (
                  <div style={{ borderTop: '1px solid var(--border-soft)', padding: '14px 15px' }}>
                    {photosAreLoading ? (
                      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                        {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ width: 76, height: 76, borderRadius: 9, flexShrink: 0 }} />)}
                      </div>
                    ) : entryPhotos && entryPhotos.length > 0 ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))', gap: 8, marginBottom: 12 }}>
                        {entryPhotos.map(photo => (
                          <div key={photo.id} style={{ position: 'relative', borderRadius: 9, overflow: 'hidden', aspectRatio: '1' }}>
                            <img src={photo.url} alt={photo.label || 'Progress photo'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            {photo.label && (
                              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.58)', padding: '3px 6px', fontSize: 9.5, color: '#fff', fontWeight: 600 }}>{photo.label}</div>
                            )}
                            <button
                              onClick={() => handleDeletePhoto(entry.id, photo.id)}
                              style={{ position: 'absolute', top: 4, right: 4, width: 18, height: 18, borderRadius: 5, border: 'none', background: 'rgba(0,0,0,0.52)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {uploadingFor === entry.id ? (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>Label (optional)</label>
                          <input value={photoLabel} onChange={e => setPhotoLabel(e.target.value)} placeholder="Front · Side · Back" style={{ ...inp, padding: '8px 12px', fontSize: 13 }} />
                        </div>
                        <label style={{ padding: '8px 14px', borderRadius: 9, cursor: uploading ? 'not-allowed' : 'pointer', background: 'rgba(59,130,246,0.1)', color: '#3b82f6', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center' }}>
                          {uploading ? 'Uploading…' : 'Choose photo'}
                          <input type="file" accept="image/*" style={{ display: 'none' }} disabled={uploading} onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(entry.id, f); }} />
                        </label>
                        <button onClick={() => { setUploadingFor(null); setPhotoLabel(''); }} style={{ padding: '8px 12px', borderRadius: 9, border: 'none', background: 'var(--bg-soft)', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>Cancel</button>
                      </div>
                    ) : (
                      <div
                        onClick={() => setUploadingFor(entry.id)}
                        style={{ padding: '11px 14px', borderRadius: 10, cursor: 'pointer', border: '1.5px dashed var(--border-color)', display: 'flex', alignItems: 'center', gap: 11 }}
                        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(59,130,246,0.5)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-color)'; }}
                      >
                        <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(59,130,246,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                          </svg>
                        </div>
                        <div>
                          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>Add progress photo</p>
                          <p style={{ fontSize: 11, color: 'var(--text-placeholder)', margin: '2px 0 0' }}>Upload front, side, or back photos to track changes.</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ProgressPage() {
  const [tab, setTab] = useState<'daily' | 'history'>('daily');

  const TABS: { key: 'daily' | 'history'; label: string }[] = [
    { key: 'daily',   label: 'Daily'   },
    { key: 'history', label: 'History' },
  ];

  return (
    <div className="progress-wrap" style={{ maxWidth: 780, margin: '0 auto', padding: '32px 24px' }}>
      <style>{`
        @media (max-width: 640px) {
          .progress-wrap { padding: 18px 14px !important; }
          .progress-stat-grid { grid-template-columns: repeat(2,1fr) !important; }
        }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 16px', letterSpacing: '-0.3px' }}>
          Progress
        </h1>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg-soft)', borderRadius: 11, padding: 4, width: 'fit-content' }}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: '7px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
                background: tab === t.key ? 'var(--bg-card)' : 'transparent',
                color: tab === t.key ? 'var(--text-primary)' : 'var(--text-tertiary)',
                boxShadow: tab === t.key ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'daily'   && <DailyTab />}
      {tab === 'history' && <HistoryTab />}

    </div>
  );
}
