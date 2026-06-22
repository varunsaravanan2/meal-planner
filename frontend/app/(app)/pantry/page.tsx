'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getInventory, addInventoryItem, deleteInventoryItem, isLoggedIn } from '@/lib/api';
import type { InventoryItem } from '@/types';

const CATEGORIES = ['dairy','protein','vegetables','fruits','grains','spices','condiments','snacks','beverages','other'];
const LOCATIONS  = ['fridge','freezer','pantry','counter'];
const UNITS      = ['g','kg','ml','l','cup','tbsp','tsp','oz','lb','whole','slice','piece'];

const CATEGORY_COLORS: Record<string, string> = {
  dairy: '#3b82f6', protein: '#ef4444', vegetables: '#22c55e', fruits: '#f97316',
  grains: '#eab308', spices: '#a855f7', condiments: '#ec4899', snacks: '#f59e0b',
  beverages: '#06b6d4', other: '#8d969e',
};

const inp: React.CSSProperties = { height: 38, padding: '0 12px', border: '1.5px solid var(--border-color)', borderRadius: 9, color: 'var(--text-primary)', background: 'var(--bg-input)', width: '100%', fontSize: 13, outline: 'none' };

interface PantryForm { item_name: string; quantity: string; unit: string; category: string; location: string; notes: string; }
const EMPTY_FORM: PantryForm = { item_name: '', quantity: '', unit: 'g', category: '', location: 'pantry', notes: '' };

export default function PantryPage() {
  const router = useRouter();
  const [items, setItems]         = useState<InventoryItem[]>([]);
  const [loading, setLoading]     = useState<boolean>(true);
  const [showAdd, setShowAdd]     = useState<boolean>(false);
  const [form, setForm]           = useState<PantryForm>(EMPTY_FORM);
  const [saving, setSaving]       = useState<boolean>(false);
  const [error, setError]         = useState<string>('');
  const [search, setSearch]       = useState<string>('');
  const [filterCat, setFilterCat] = useState<string>('');

  useEffect(() => {
    if (!isLoggedIn()) { router.push('/login'); return; }
    load();
  }, [router]);

  async function load() {
    setLoading(true);
    try { setItems((await getInventory())?.items || []); }
    catch { if (!isLoggedIn()) router.push('/login'); }
    finally { setLoading(false); }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.item_name.trim() || !form.quantity) return;
    setSaving(true); setError('');
    try {
      await addInventoryItem({
        item_name: form.item_name.trim(),
        quantity: parseFloat(form.quantity),
        unit: form.unit,
        category: form.category || null,
        location: form.location || null,
        notes: form.notes || null,
      });
      setShowAdd(false); setForm(EMPTY_FORM); load();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this item from your pantry?')) return;
    try { await deleteInventoryItem(id); load(); }
    catch (e) { alert((e as Error).message); }
  }

  const filtered = items.filter(it => {
    const matchSearch = !search || it.item_name.toLowerCase().includes(search.toLowerCase());
    const matchCat    = !filterCat || it.category === filterCat;
    return matchSearch && matchCat;
  });

  const grouped = filtered.reduce<Record<string, InventoryItem[]>>((acc, item) => {
    const cat = item.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const categories = Object.keys(grouped).sort();

  return (
    <div className="min-h-full" style={{ background: 'transparent' }}>
      <div className="max-w-5xl mx-auto px-5 py-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>Pantry</h1>
            <p className="text-base mt-1" style={{ color: 'var(--text-tertiary)' }}>{items.length} item{items.length !== 1 ? 's' : ''} stored</p>
          </div>
          <button onClick={() => { setShowAdd(true); setForm(EMPTY_FORM); setError(''); }}
            className="font-semibold text-white transition-all"
            style={{ height: 36, padding: '0 16px', borderRadius: 9, background: '#191c1f', fontSize: 13 }}
            onMouseEnter={e => e.currentTarget.style.background = '#000'}
            onMouseLeave={e => e.currentTarget.style.background = '#191c1f'}>
            + Add item
          </button>
        </div>

        <div className="flex gap-3 mb-6">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search pantry…"
            className="flex-1 focus:outline-none"
            style={{ ...inp, height: 38, fontSize: 13 }}
            onFocus={e => e.currentTarget.style.borderColor = '#191c1f'}
            onBlur={e => e.currentTarget.style.borderColor = '#e2e2e7'} />
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={{ ...inp, width: 160 }}>
            <option value="">All categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="space-y-6">
            {[3, 4].map((count, gi) => (
              <div key={gi}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="skeleton" style={{ width: 10, height: 10, borderRadius: '50%' }} />
                  <div className="skeleton" style={{ height: 14, width: 80 }} />
                </div>
                <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
                  {Array.from({ length: count }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 rounded-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', padding: '11px 14px' }}>
                      <div className="skeleton shrink-0" style={{ width: 8, height: 36, borderRadius: 4 }} />
                      <div className="flex-1 space-y-2">
                        <div className="skeleton" style={{ height: 15, width: '65%' }} />
                        <div className="skeleton" style={{ height: 13, width: '45%' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-40">
            <p className="font-bold text-xl mb-2" style={{ color: 'var(--text-primary)' }}>Your pantry is empty</p>
            <p className="mb-6" style={{ color: 'var(--text-tertiary)', fontSize: 16 }}>Add ingredients you have at home to track your stock.</p>
            <button onClick={() => setShowAdd(true)} className="font-semibold text-white" style={{ height: 36, padding: '0 18px', borderRadius: 9, background: '#3b82f6', fontSize: 13 }}>Add your first item</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20" style={{ color: 'var(--text-tertiary)', fontSize: 16 }}>No items match your search.</div>
        ) : (
          <div className="space-y-6">
            {categories.map(cat => (
              <div key={cat}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: CATEGORY_COLORS[cat] || '#8d969e' }} />
                  <h2 className="font-bold text-sm uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    <span className="ml-2 font-normal normal-case" style={{ color: 'var(--text-placeholder)' }}>({grouped[cat].length})</span>
                  </h2>
                </div>
                <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
                  {grouped[cat].map(item => {
                    const itemColor = CATEGORY_COLORS[item.category || ''] || '#8d969e';
                    return (
                    <div key={item.id} className="group flex items-center gap-4 rounded-2xl transition-all cursor-default"
                      style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-card)', padding: '11px 14px' }}>
                      <span className="shrink-0 rounded-lg" style={{ width: 8, height: 40, background: `linear-gradient(180deg, ${itemColor} 0%, ${itemColor}88 100%)` }} />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold capitalize truncate" style={{ color: 'var(--text-primary)', fontSize: 16 }}>{item.item_name}</p>
                        <p style={{ color: 'var(--text-tertiary)', fontSize: 14, marginTop: 3 }}>
                          {item.quantity} {item.unit}
                          {item.location && <span style={{ color: 'var(--text-placeholder)' }}> · {item.location}</span>}
                        </p>
                      </div>
                      <button onClick={() => handleDelete(item.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 cursor-pointer"
                        style={{ color: 'var(--text-placeholder)', fontSize: 19, lineHeight: '1', padding: 4, background: 'none', border: 'none' }}
                        onMouseEnter={e => e.currentTarget.style.color = '#e23b4a'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-placeholder)'}
                        title="Remove">×</button>
                    </div>
                  )})}

                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAdd && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-md flex flex-col" style={{ background: 'var(--bg-card)', borderRadius: 22, boxShadow: '0 24px 64px rgba(0,0,0,0.15)' }}>
            <div className="px-6 py-5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-soft)' }}>
              <h3 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>Add pantry item</h3>
              <button onClick={() => setShowAdd(false)} className="w-8 h-8 flex items-center justify-center rounded-full text-lg" style={{ color: 'var(--text-tertiary)', background: 'var(--bg-soft)' }}>×</button>
            </div>
            <form onSubmit={handleAdd} className="px-6 py-5 space-y-4">
              {error && <div className="text-sm px-4 py-3 rounded-xl" style={{ color: '#e23b4a', background: '#fff1f2', border: '1px solid #fecdd3' }}>{error}</div>}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-tertiary)' }}>Item name</label>
                <input required value={form.item_name} onChange={e => setForm(f => ({ ...f, item_name: e.target.value }))} style={inp} placeholder="e.g. chicken breast"
                  onFocus={e => e.currentTarget.style.borderColor = '#191c1f'}
                  onBlur={e => e.currentTarget.style.borderColor = '#e2e2e7'} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-tertiary)' }}>Quantity</label>
                  <input required type="number" min="0" step="any" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} style={inp} placeholder="500"
                    onFocus={e => e.currentTarget.style.borderColor = '#191c1f'}
                    onBlur={e => e.currentTarget.style.borderColor = '#e2e2e7'} />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-tertiary)' }}>Unit</label>
                  <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} style={inp}>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-tertiary)' }}>Category</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={inp}>
                    <option value="">—</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-tertiary)' }}>Location</label>
                  <select value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} style={inp}>
                    {LOCATIONS.map(l => <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-tertiary)' }}>Notes <span className="normal-case font-normal" style={{ color: 'var(--text-placeholder)' }}>(optional)</span></label>
                <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={inp} placeholder="e.g. organic, from Whole Foods"
                  onFocus={e => e.currentTarget.style.borderColor = '#191c1f'}
                  onBlur={e => e.currentTarget.style.borderColor = '#e2e2e7'} />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowAdd(false)} className="flex-1 font-medium" style={{ height: 38, borderRadius: 9, border: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: 13 }}>Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 font-semibold text-white disabled:opacity-40" style={{ height: 38, borderRadius: 9, background: '#191c1f', fontSize: 13 }}>
                  {saving ? 'Adding…' : 'Add to pantry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
