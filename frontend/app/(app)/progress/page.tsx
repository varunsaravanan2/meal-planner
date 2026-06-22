'use client';

import { useState, useEffect } from 'react';
import {
  getProgressEntries, createProgressEntry, deleteProgressEntry,
  uploadProgressPhoto, deleteProgressPhoto,
} from '@/lib/api';
import { isLoggedIn } from '@/lib/api';
import { useRouter } from 'next/navigation';
import type { ProgressEntry, ProgressPhoto } from '@/types';

// ── helpers ────────────────────────────────────────────────────────────────────

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

// ── main component ─────────────────────────────────────────────────────────────

export default function ProgressPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<ProgressEntry[]>([]);
  const [photos, setPhotos] = useState<Record<string, ProgressPhoto[]>>({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  // new entry form
  const [showForm, setShowForm] = useState(false);
  const [weekDate, setWeekDate] = useState(() => { const d = toMonday(new Date()); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; });
  const [weight, setWeight] = useState('');
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState('');

  // photo upload
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

  async function handleCreate() {
    if (!weekDate) { setFormErr('Select a week date.'); return; }
    setSaving(true); setFormErr('');
    try {
      const entry = await createProgressEntry({
        week_date: weekDate,
        weight_lbs: weight ? parseFloat(weight) : undefined,
      });
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

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 24px' }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Progress</h1>
          <p style={{ fontSize: 15, color: 'var(--text-tertiary)', marginTop: 4 }}>Weekly check-ins with weight and photos</p>
        </div>
        <button
          onClick={() => { setShowForm(f => !f); setFormErr(''); }}
          style={{
            padding: '10px 20px', borderRadius: 12, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff',
            fontWeight: 700, fontSize: 15,
          }}
        >
          {showForm ? 'Cancel' : '+ Check-in'}
        </button>
      </div>

      {/* new check-in form */}
      {showForm && (
        <div style={{
          background: 'var(--bg-card)', borderRadius: 16, padding: 24,
          border: '1px solid var(--border-color)', marginBottom: 28,
          boxShadow: 'var(--shadow-md)',
        }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 20 }}>New Check-in</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Week of</label>
              <input
                type="date"
                value={weekDate}
                onChange={e => setWeekDate(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 15,
                  border: '1px solid var(--border-color)', background: 'var(--bg-input)',
                  color: 'var(--text-primary)', boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Weight (lbs)</label>
              <input
                type="number"
                placeholder="Optional"
                value={weight}
                onChange={e => setWeight(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 15,
                  border: '1px solid var(--border-color)', background: 'var(--bg-input)',
                  color: 'var(--text-primary)', boxSizing: 'border-box',
                }}
              />
            </div>
          </div>
          {formErr && <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{formErr}</p>}
          <button
            onClick={handleCreate}
            disabled={saving}
            style={{
              padding: '10px 24px', borderRadius: 10, border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
              background: saving ? 'var(--bg-soft)' : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
              color: saving ? 'var(--text-tertiary)' : '#fff', fontWeight: 700, fontSize: 15,
            }}
          >
            {saving ? 'Saving…' : 'Save Check-in'}
          </button>
        </div>
      )}

      {/* list */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton" style={{ height: 80, borderRadius: 16 }} />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '64px 24px',
          background: 'var(--bg-card)', borderRadius: 20, border: '1px solid var(--border-color)',
        }}>
          <p style={{ fontSize: 17, color: 'var(--text-secondary)', marginBottom: 8 }}>No check-ins yet</p>
          <p style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>Hit "+ Check-in" to log your first week</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {entries.map(entry => {
            const isOpen = expanded === entry.id;
            const entryPhotos = photos[entry.id] || [];
            return (
              <div key={entry.id} style={{
                background: 'var(--bg-card)', borderRadius: 16,
                border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)',
                overflow: 'hidden',
              }}>
                {/* row */}
                <div
                  onClick={() => setExpanded(isOpen ? null : entry.id)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '18px 20px', cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 12, display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      background: 'rgba(99,102,241,0.1)',
                    }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                      </svg>
                    </div>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', margin: 0 }}>
                        Week of {fmtDate(entry.week_date)}
                      </p>
                      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: '2px 0 0' }}>
                        {entry.weight_lbs ? `${entry.weight_lbs} lbs` : 'No weight logged'}
                        {entryPhotos.length > 0 ? ` · ${entryPhotos.length} photo${entryPhotos.length > 1 ? 's' : ''}` : ''}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(entry.id); }}
                      style={{
                        width: 32, height: 32, borderRadius: 8, border: 'none',
                        background: 'var(--bg-soft)', color: 'var(--text-tertiary)',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                      </svg>
                    </button>
                    <svg
                      width="16" height="16" viewBox="0 0 24 24" fill="none"
                      stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: '0.2s' }}
                    >
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </div>
                </div>

                {/* expanded panel */}
                {isOpen && (
                  <div style={{ padding: '0 20px 20px', borderTop: '1px solid var(--border-soft)' }}>
                    {/* photos grid */}
                    {entryPhotos.length > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginTop: 16, marginBottom: 16 }}>
                        {entryPhotos.map(photo => (
                          <div key={photo.id} style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', aspectRatio: '1' }}>
                            <img src={photo.url} alt={photo.label || 'Progress photo'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            {photo.label && (
                              <div style={{
                                position: 'absolute', bottom: 0, left: 0, right: 0,
                                background: 'rgba(0,0,0,0.55)', padding: '4px 8px',
                                fontSize: 11, color: '#fff', fontWeight: 600,
                              }}>{photo.label}</div>
                            )}
                            <button
                              onClick={() => handleDeletePhoto(entry.id, photo.id)}
                              style={{
                                position: 'absolute', top: 6, right: 6,
                                width: 24, height: 24, borderRadius: 6, border: 'none',
                                background: 'rgba(0,0,0,0.5)', color: '#fff',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}
                            >
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* upload area */}
                    {uploadingFor === entry.id ? (
                      <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'block', marginBottom: 4 }}>Label (optional)</label>
                          <input
                            value={photoLabel}
                            onChange={e => setPhotoLabel(e.target.value)}
                            placeholder="e.g. Front, Side"
                            style={{
                              width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 14,
                              border: '1px solid var(--border-color)', background: 'var(--bg-input)',
                              color: 'var(--text-primary)', boxSizing: 'border-box',
                            }}
                          />
                        </div>
                        <label style={{
                          padding: '9px 18px', borderRadius: 8, cursor: uploading ? 'not-allowed' : 'pointer',
                          background: uploading ? 'var(--bg-soft)' : 'rgba(99,102,241,0.12)',
                          color: uploading ? 'var(--text-tertiary)' : '#6366f1',
                          fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap',
                        }}>
                          {uploading ? 'Uploading…' : 'Choose photo'}
                          <input type="file" accept="image/*" style={{ display: 'none' }} disabled={uploading}
                            onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(entry.id, f); }} />
                        </label>
                        <button
                          onClick={() => { setUploadingFor(null); setPhotoLabel(''); }}
                          style={{ padding: '9px 14px', borderRadius: 8, border: 'none', background: 'var(--bg-soft)', color: 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}
                        >Cancel</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setUploadingFor(entry.id)}
                        style={{
                          marginTop: 12, padding: '8px 16px', borderRadius: 8, border: '1px dashed var(--border-color)',
                          background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer',
                          fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                          <polyline points="21 15 16 10 5 21"/>
                        </svg>
                        Add photo
                      </button>
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
