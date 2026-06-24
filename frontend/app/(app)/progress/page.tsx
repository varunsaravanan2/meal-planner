'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  getProgressEntries, createProgressEntry, deleteProgressEntry,
  uploadProgressPhoto, deleteProgressPhoto, getProgressPhotos,
} from '@/lib/api';
import { isLoggedIn } from '@/lib/api';
import { useRouter } from 'next/navigation';
import type { ProgressEntry, ProgressPhoto } from '@/types';

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
    <div style={{
      background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border-color)',
      padding: '16px 20px 12px',
    }}>
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
              <line x1={pad.l} x2={W - pad.r} y1={y} y2={y}
                stroke="var(--border-color)" strokeWidth="1" strokeDasharray="4 3" opacity="0.55" />
              <text x={pad.l - 7} y={y + 3.5} textAnchor="end" fontSize="9" fill="var(--text-placeholder)"
                fontFamily="system-ui,-apple-system,sans-serif">{v}</text>
            </g>
          );
        })}

        <path d={areaD} fill="url(#wGrad)" clipPath="url(#wClip)" />
        <path d={lineD} fill="none" stroke="#3b82f6" strokeWidth="1.75"
          strokeLinecap="round" strokeLinejoin="round" clipPath="url(#wClip)" />

        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="2.75"
            fill="#3b82f6" stroke="var(--bg-card)" strokeWidth="1.75" />
        ))}

        {pts.map((p, i) => !showX.has(i) ? null : (
          <text key={i} x={p.x} y={H - 3}
            textAnchor={i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle'}
            fontSize="9" fill="var(--text-placeholder)"
            fontFamily="system-ui,-apple-system,sans-serif">
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
    <div style={{
      background: 'var(--bg-card)', borderRadius: 14, padding: '14px 16px',
      border: '1px solid var(--border-color)', flex: 1, minWidth: 0,
    }}>
      <p style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
        color: 'var(--text-tertiary)', margin: '0 0 7px',
      }}>{label}</p>
      <p style={{ fontSize: 20, fontWeight: 700, color: accent || 'var(--text-primary)', lineHeight: 1, margin: 0 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4, marginBottom: 0 }}>{sub}</p>}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ProgressPage() {
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

  // Derived stats
  const sortedByDate = useMemo(
    () => [...entries].sort((a, b) => b.week_date.localeCompare(a.week_date)),
    [entries],
  );
  const withWeight = useMemo(
    () => sortedByDate.filter(e => e.weight_lbs != null),
    [sortedByDate],
  );
  const currentWeight = withWeight[0]?.weight_lbs ?? null;
  const prevWeight = withWeight[1]?.weight_lbs ?? null;
  const firstWeight = withWeight[withWeight.length - 1]?.weight_lbs ?? null;
  const deltaLast = currentWeight != null && prevWeight != null ? currentWeight - prevWeight : null;
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
    <div style={{ maxWidth: 780, margin: '0 auto', padding: '32px 24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.3px' }}>
            Progress
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-tertiary)', marginTop: 4, marginBottom: 0 }}>
            {entries.length > 0
              ? `${entries.length} check-in${entries.length !== 1 ? 's' : ''} recorded`
              : 'Weekly weight and photo tracking'}
          </p>
        </div>
        <button
          onClick={() => { setShowForm(f => !f); setFormErr(''); }}
          style={{
            padding: '9px 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: showForm ? 'var(--bg-soft)' : '#191c1f',
            color: showForm ? 'var(--text-secondary)' : '#fff',
            fontWeight: 600, fontSize: 13, transition: 'background 0.15s',
          }}
        >
          {showForm ? 'Cancel' : '+ Check-in'}
        </button>
      </div>

      {/* Stats row */}
      {!loading && entries.length > 0 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <StatCard
            label="Current Weight"
            value={currentWeight != null ? `${currentWeight} lbs` : '—'}
            sub={withWeight[0] ? `as of ${fmtShort(withWeight[0].week_date)}` : 'No weight logged'}
          />
          <StatCard
            label="Since Last"
            value={deltaLast != null ? fmtDelta(deltaLast) : '—'}
            accent={deltaLast != null ? deltaColor(deltaLast) : undefined}
            sub={deltaLast != null
              ? (deltaLast < 0 ? 'Lost' : deltaLast > 0 ? 'Gained' : 'No change')
              : 'Log 2+ weights'}
          />
          <StatCard
            label="Total Change"
            value={deltaTotal != null ? fmtDelta(deltaTotal) : '—'}
            accent={deltaTotal != null ? deltaColor(deltaTotal) : undefined}
            sub={deltaTotal != null
              ? `over ${withWeight.length} check-ins`
              : withWeight.length === 1 ? 'Need 2+ weights' : 'No weights logged'}
          />
          <StatCard
            label="Streak"
            value={streak > 0 ? `${streak}w` : '—'}
            accent={streak >= 4 ? '#f59e0b' : streak >= 2 ? '#3b82f6' : undefined}
            sub={streak === 0 ? 'Check in weekly' : streak === 1 ? 'This week' : `${streak} weeks running`}
          />
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
        <div style={{
          background: 'var(--bg-card)', borderRadius: 14, padding: '18px 20px',
          border: '1px solid var(--border-color)', marginBottom: 12,
        }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, marginTop: 0 }}>
            New Check-in
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase',
                color: 'var(--text-tertiary)', display: 'block', marginBottom: 5,
              }}>Week of</label>
              <input type="date" value={weekDate} onChange={e => setWeekDate(e.target.value)} style={inp} />
            </div>
            <div>
              <label style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase',
                color: 'var(--text-tertiary)', display: 'block', marginBottom: 5,
              }}>Weight (lbs)</label>
              <input type="number" placeholder="Optional" value={weight}
                onChange={e => setWeight(e.target.value)} style={inp} />
            </div>
          </div>
          {formErr && <p style={{ color: '#f87171', fontSize: 12, marginBottom: 12, marginTop: -4 }}>{formErr}</p>}
          <button
            onClick={handleCreate}
            disabled={saving}
            style={{
              padding: '8px 18px', borderRadius: 9, border: 'none',
              cursor: saving ? 'not-allowed' : 'pointer',
              background: saving ? 'var(--bg-soft)' : '#191c1f',
              color: saving ? 'var(--text-tertiary)' : '#fff',
              fontWeight: 600, fontSize: 13, opacity: saving ? 0.7 : 1,
            }}
          >
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
        /* Empty state */
        <div style={{
          textAlign: 'center', padding: '56px 32px',
          background: 'var(--bg-card)', borderRadius: 18, border: '1px solid var(--border-color)',
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14, background: 'rgba(59,130,246,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
          </div>
          <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>
            Start Tracking Your Progress
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', maxWidth: 340, margin: '0 auto 22px', lineHeight: 1.65 }}>
            Log your weekly weight and upload progress photos to visualize how your body changes over time. Build a streak to stay consistent.
          </p>
          <button
            onClick={() => setShowForm(true)}
            style={{
              padding: '9px 22px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: '#191c1f', color: '#fff', fontWeight: 600, fontSize: 13,
            }}
          >
            Log First Check-in
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sortedByDate.map((entry, idx) => {
            const isOpen = expanded === entry.id;
            const entryPhotos = photos[entry.id];
            const photosAreLoading = photosLoading[entry.id];

            // Weight delta vs previous entry that has weight
            const thisWeightIdx = withWeight.findIndex(e => e.id === entry.id);
            const olderWithWeight = thisWeightIdx !== -1 ? withWeight[thisWeightIdx + 1] : null;
            const delta = entry.weight_lbs != null && olderWithWeight?.weight_lbs != null
              ? entry.weight_lbs - olderWithWeight.weight_lbs
              : null;

            return (
              <div key={entry.id} style={{
                background: 'var(--bg-card)', borderRadius: 14,
                border: `1px solid ${isOpen ? 'rgba(59,130,246,0.22)' : 'var(--border-color)'}`,
                overflow: 'hidden', transition: 'border-color 0.2s',
              }}>
                {/* Row */}
                <div
                  onClick={() => handleExpand(entry.id)}
                  style={{ display: 'flex', alignItems: 'center', padding: '13px 15px', cursor: 'pointer', gap: 12 }}
                >
                  {/* Index badge */}
                  <div style={{
                    width: 34, height: 34, borderRadius: 9, background: 'var(--bg-soft)', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-placeholder)' }}>
                      #{sortedByDate.length - idx}
                    </span>
                  </div>

                  {/* Weight + delta + date */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                        {entry.weight_lbs != null ? `${entry.weight_lbs} lbs` : 'No weight logged'}
                      </span>
                      {delta != null && (
                        <span style={{
                          fontSize: 12, fontWeight: 600,
                          color: delta < 0 ? '#22c55e' : delta > 0 ? '#f87171' : 'var(--text-tertiary)',
                        }}>
                          {delta < 0 ? '↓' : delta > 0 ? '↑' : '→'} {Math.abs(delta).toFixed(1)} lbs
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: 11.5, color: 'var(--text-tertiary)', margin: '2px 0 0', lineHeight: 1 }}>
                      {fmtDate(entry.week_date)}
                      {entryPhotos && entryPhotos.length > 0 && (
                        <span style={{ color: 'var(--text-placeholder)' }}>
                          {` · ${entryPhotos.length} photo${entryPhotos.length !== 1 ? 's' : ''}`}
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(entry.id); }}
                      style={{
                        width: 28, height: 28, borderRadius: 7, border: 'none',
                        background: 'var(--bg-soft)', color: 'var(--text-placeholder)',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'color 0.15s',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#f87171'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-placeholder)'; }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                        <path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                      </svg>
                    </button>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                      stroke="var(--text-placeholder)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </div>
                </div>

                {/* Expanded panel */}
                {isOpen && (
                  <div style={{ borderTop: '1px solid var(--border-soft)', padding: '14px 15px' }}>
                    {/* Photos */}
                    {photosAreLoading ? (
                      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                        {[1, 2, 3].map(i => (
                          <div key={i} className="skeleton" style={{ width: 76, height: 76, borderRadius: 9, flexShrink: 0 }} />
                        ))}
                      </div>
                    ) : entryPhotos && entryPhotos.length > 0 ? (
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))',
                        gap: 8, marginBottom: 12,
                      }}>
                        {entryPhotos.map(photo => (
                          <div key={photo.id} style={{ position: 'relative', borderRadius: 9, overflow: 'hidden', aspectRatio: '1' }}>
                            <img src={photo.url} alt={photo.label || 'Progress photo'}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            {photo.label && (
                              <div style={{
                                position: 'absolute', bottom: 0, left: 0, right: 0,
                                background: 'rgba(0,0,0,0.58)', padding: '3px 6px',
                                fontSize: 9.5, color: '#fff', fontWeight: 600,
                              }}>{photo.label}</div>
                            )}
                            <button
                              onClick={() => handleDeletePhoto(entry.id, photo.id)}
                              style={{
                                position: 'absolute', top: 4, right: 4, width: 18, height: 18,
                                borderRadius: 5, border: 'none', background: 'rgba(0,0,0,0.52)',
                                color: '#fff', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}
                            >
                              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {/* Upload */}
                    {uploadingFor === entry.id ? (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{
                            fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                            color: 'var(--text-tertiary)', display: 'block', marginBottom: 4,
                          }}>Label (optional)</label>
                          <input
                            value={photoLabel}
                            onChange={e => setPhotoLabel(e.target.value)}
                            placeholder="Front · Side · Back"
                            style={{ ...inp, padding: '8px 12px', fontSize: 13 }}
                          />
                        </div>
                        <label style={{
                          padding: '8px 14px', borderRadius: 9, cursor: uploading ? 'not-allowed' : 'pointer',
                          background: 'rgba(59,130,246,0.1)', color: '#3b82f6',
                          fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap',
                          display: 'flex', alignItems: 'center',
                        }}>
                          {uploading ? 'Uploading…' : 'Choose photo'}
                          <input type="file" accept="image/*" style={{ display: 'none' }} disabled={uploading}
                            onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(entry.id, f); }} />
                        </label>
                        <button
                          onClick={() => { setUploadingFor(null); setPhotoLabel(''); }}
                          style={{
                            padding: '8px 12px', borderRadius: 9, border: 'none',
                            background: 'var(--bg-soft)', color: 'var(--text-secondary)',
                            cursor: 'pointer', fontWeight: 600, fontSize: 12,
                          }}
                        >Cancel</button>
                      </div>
                    ) : (
                      <div
                        onClick={() => setUploadingFor(entry.id)}
                        style={{
                          padding: '11px 14px', borderRadius: 10, cursor: 'pointer',
                          border: '1.5px dashed var(--border-color)',
                          display: 'flex', alignItems: 'center', gap: 11, transition: 'border-color 0.15s',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(59,130,246,0.5)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-color)'; }}
                      >
                        <div style={{
                          width: 30, height: 30, borderRadius: 8, background: 'rgba(59,130,246,0.08)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2"/>
                            <circle cx="8.5" cy="8.5" r="1.5"/>
                            <polyline points="21 15 16 10 5 21"/>
                          </svg>
                        </div>
                        <div>
                          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>
                            Add progress photo
                          </p>
                          <p style={{ fontSize: 11, color: 'var(--text-placeholder)', margin: '2px 0 0' }}>
                            Upload front, side, or back photos to track changes over time.
                          </p>
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
