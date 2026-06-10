'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getInventory, addInventoryItem, deleteInventoryItem, isLoggedIn } from '@/lib/api';

const CATEGORIES = ['dairy', 'protein', 'vegetables', 'fruits', 'grains', 'spices', 'condiments', 'snacks', 'beverages', 'other'];
const LOCATIONS  = ['fridge', 'freezer', 'pantry', 'counter'];
const UNITS      = ['g', 'kg', 'ml', 'l', 'cup', 'tbsp', 'tsp', 'oz', 'lb', 'whole', 'slice', 'piece'];

const CATEGORY_COLORS = {
  dairy:       '#3b82f6',
  protein:     '#ef4444',
  vegetables:  '#22c55e',
  fruits:      '#f97316',
  grains:      '#eab308',
  spices:      '#a855f7',
  condiments:  '#ec4899',
  snacks:      '#f59e0b',
  beverages:   '#06b6d4',
  other:       '#8d969e',
};

const inp = {
  height: 44, padding: '0 14px', border: '1.5px solid #e2e2e7',
  borderRadius: 10, color: '#191c1f', background: '#fff', width: '100%', fontSize: 14, outline: 'none',
};

const EMPTY_FORM = { item_name: '', quantity: '', unit: 'g', category: '', location: 'pantry', notes: '' };

export default function PantryPage() {
  const router = useRouter();
  const [items, setItems]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showAdd, setShowAdd]   = useState(false);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [search, setSearch]     = useState('');
  const [filterCat, setFilterCat] = useState('');

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

  async function handleAdd(e) {
    e.preventDefault();
    if (!form.item_name.trim() || !form.quantity) return;
    setSaving(true); setError('');
    try {
      await addInventoryItem({
        item_name: form.item_name.trim(),
        quantity:  parseFloat(form.quantity),
        unit:      form.unit,
        category:  form.category || null,
        location:  form.location || null,
        notes:     form.notes || null,
      });
      setShowAdd(false);
      setForm(EMPTY_FORM);
      load();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function handleDelete(id) {
    if (!confirm('Remove this item from your pantry?')) return;
    try { await deleteInventoryItem(id); load(); }
    catch (e) { alert(e.message); }
  }

  const filtered = items.filter(it => {
    const matchSearch = !search || it.item_name.toLowerCase().includes(search.toLowerCase());
    const matchCat    = !filterCat || it.category === filterCat;
    return matchSearch && matchCat;
  });

  // Group by category
  const grouped = filtered.reduce((acc, item) => {
    const cat = item.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const categories = Object.keys(grouped).sort();

  return (
    <div className="min-h-full" style={{ background: '#f7f7f8' }}>
      <div className="max-w-5xl mx-auto px-8 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold" style={{ color: '#191c1f', letterSpacing: '-0.5px' }}>Pantry</h1>
            <p className="text-base mt-1" style={{ color: '#8d969e' }}>{items.length} item{items.length !== 1 ? 's' : ''} stored</p>
          </div>
          <button
            onClick={() => { setShowAdd(true); setForm(EMPTY_FORM); setError(''); }}
            className="font-semibold text-white transition-all"
            style={{ height: 44, padding: '0 20px', borderRadius: 10, background: '#191c1f', fontSize: 14 }}
            onMouseEnter={e => e.currentTarget.style.background = '#000'}
            onMouseLeave={e => e.currentTarget.style.background = '#191c1f'}
          >
            + Add item
          </button>
        </div>

        {/* Search + filter */}
        <div className="flex gap-3 mb-6">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search pantry…"
            className="flex-1 focus:outline-none"
            style={{ ...inp, height: 44, fontSize: 15 }}
            onFocus={e => e.target.style.borderColor = '#191c1f'}
            onBlur={e => e.target.style.borderColor = '#e2e2e7'}
          />
          <select
            value={filterCat}
            onChange={e => setFilterCat(e.target.value)}
            style={{ ...inp, width: 160 }}
          >
            <option value="">All categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="text-center py-40" style={{ color: '#8d969e', fontSize: 16 }}>Loading pantry…</div>
        ) : items.length === 0 ? (
          <div className="text-center py-40">
            <p className="font-bold text-xl mb-2" style={{ color: '#191c1f' }}>Your pantry is empty</p>
            <p className="mb-6" style={{ color: '#8d969e', fontSize: 15 }}>Add ingredients you have at home to track your stock.</p>
            <button
              onClick={() => setShowAdd(true)}
              className="font-semibold text-white"
              style={{ height: 44, padding: '0 24px', borderRadius: 10, background: '#494fdf', fontSize: 14 }}
            >
              Add your first item
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20" style={{ color: '#8d969e', fontSize: 15 }}>No items match your search.</div>
        ) : (
          <div className="space-y-6">
            {categories.map(cat => (
              <div key={cat}>
                {/* Category header */}
                <div className="flex items-center gap-3 mb-3">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: CATEGORY_COLORS[cat] || '#8d969e' }}
                  />
                  <h2 className="font-bold text-sm uppercase tracking-wider" style={{ color: '#505a63' }}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    <span className="ml-2 font-normal normal-case" style={{ color: '#c9c9cd' }}>({grouped[cat].length})</span>
                  </h2>
                </div>

                {/* Items grid */}
                <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
                  {grouped[cat].map(item => (
                    <div
                      key={item.id}
                      className="group flex items-center gap-4 rounded-2xl transition-all"
                      style={{ background: '#fff', border: '1px solid #e8e8ec', padding: '16px 20px' }}
                    >
                      {/* Color dot */}
                      <span
                        className="shrink-0 w-2 rounded-full"
                        style={{ height: 36, background: CATEGORY_COLORS[item.category] || '#e2e2e7' }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold capitalize truncate" style={{ color: '#191c1f', fontSize: 15 }}>{item.item_name}</p>
                        <p style={{ color: '#8d969e', fontSize: 13 }}>
                          {item.quantity} {item.unit}
                          {item.location && <span style={{ color: '#c9c9cd' }}> · {item.location}</span>}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                        style={{ color: '#c9c9cd', fontSize: 18, lineHeight: 1, padding: 4 }}
                        onMouseEnter={e => e.currentTarget.style.color = '#e23b4a'}
                        onMouseLeave={e => e.currentTarget.style.color = '#c9c9cd'}
                        title="Remove"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add item modal */}
      {showAdd && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-md flex flex-col" style={{ background: '#fff', borderRadius: 20, boxShadow: '0 24px 64px rgba(0,0,0,0.15)' }}>
            <div className="px-6 py-5 flex items-center justify-between" style={{ borderBottom: '1px solid #f0f0f2' }}>
              <h3 className="font-bold text-lg" style={{ color: '#191c1f' }}>Add pantry item</h3>
              <button onClick={() => setShowAdd(false)} className="w-8 h-8 flex items-center justify-center rounded-full text-lg" style={{ color: '#8d969e', background: '#f4f4f4' }}>×</button>
            </div>

            <form onSubmit={handleAdd} className="px-6 py-5 space-y-4">
              {error && (
                <div className="text-sm px-4 py-3 rounded-xl" style={{ color: '#e23b4a', background: '#fff1f2', border: '1px solid #fecdd3' }}>{error}</div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#8d969e' }}>Item name</label>
                <input
                  required value={form.item_name}
                  onChange={e => setForm(f => ({ ...f, item_name: e.target.value }))}
                  style={inp} placeholder="e.g. chicken breast"
                  onFocus={e => e.target.style.borderColor = '#191c1f'}
                  onBlur={e => e.target.style.borderColor = '#e2e2e7'}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#8d969e' }}>Quantity</label>
                  <input
                    required type="number" min="0" step="any"
                    value={form.quantity}
                    onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                    style={inp} placeholder="500"
                    onFocus={e => e.target.style.borderColor = '#191c1f'}
                    onBlur={e => e.target.style.borderColor = '#e2e2e7'}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#8d969e' }}>Unit</label>
                  <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} style={inp}>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#8d969e' }}>Category</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={inp}>
                    <option value="">—</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#8d969e' }}>Location</label>
                  <select value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} style={inp}>
                    {LOCATIONS.map(l => <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#8d969e' }}>Notes <span className="normal-case font-normal" style={{ color: '#c9c9cd' }}>(optional)</span></label>
                <input
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  style={inp} placeholder="e.g. organic, from Whole Foods"
                  onFocus={e => e.target.style.borderColor = '#191c1f'}
                  onBlur={e => e.target.style.borderColor = '#e2e2e7'}
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowAdd(false)} className="flex-1 font-medium" style={{ height: 44, borderRadius: 12, border: '1px solid #e2e2e7', color: '#505a63', fontSize: 14 }}>
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="flex-1 font-semibold text-white disabled:opacity-40" style={{ height: 44, borderRadius: 12, background: '#191c1f', fontSize: 14 }}>
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
