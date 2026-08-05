'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getWeeklyShoppingList, addInventoryItem, deleteInventoryItem, isLoggedIn } from '@/lib/api';
import type { ShoppingIngredient, ShoppingList } from '@/types';

function isoWeekMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
}
function addDays(d: Date, n: number): Date { const date = new Date(d); date.setDate(date.getDate() + n); return date; }
function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function ShoppingListPage() {
  const router = useRouter();
  const [monday, setMonday] = useState<Date>(() => isoWeekMonday(new Date()));
  const [data, setData] = useState<ShoppingList | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [addingToPantry, setAddingToPantry] = useState<Record<string, boolean>>({});
  const [inventoryIds, setInventoryIds] = useState<Record<string, string>>({});

  const weekLabel = `${toIso(monday)} – ${toIso(addDays(monday, 6))}`;

  useEffect(() => {
    if (!isLoggedIn()) { router.push('/login'); return; }
    fetchList();
  }, [monday, router]);

  async function toggleCheck(item: ShoppingIngredient) {
    const wasChecked = checked[item.ingredient];
    setAddingToPantry(a => ({ ...a, [item.ingredient]: true }));
    try {
      if (!wasChecked) {
        const created = await addInventoryItem({ item_name: item.ingredient, quantity: item.to_buy, unit: item.unit || 'whole' });
        setInventoryIds(ids => ({ ...ids, [item.ingredient]: created.id }));
        setChecked(c => ({ ...c, [item.ingredient]: true }));
      } else {
        const id = inventoryIds[item.ingredient];
        if (id) await deleteInventoryItem(id);
        setInventoryIds(ids => { const next = { ...ids }; delete next[item.ingredient]; return next; });
        setChecked(c => ({ ...c, [item.ingredient]: false }));
      }
      setData(await getWeeklyShoppingList(toIso(monday)));
    } catch {}
    finally { setAddingToPantry(a => ({ ...a, [item.ingredient]: false })); }
  }

  async function fetchList() {
    setLoading(true); setError(''); setChecked({}); setAddingToPantry({}); setInventoryIds({});
    try { setData(await getWeeklyShoppingList(toIso(monday))); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  const toBuy = data?.items_to_buy || [];
  const have = data?.already_have || [];
  const sessionDone = Object.keys(inventoryIds).length;
  const doneCount = toBuy.filter(i => checked[i.ingredient]).length + sessionDone;
  const totalCount = toBuy.length + sessionDone;

  return (
    <div className="min-h-full" style={{ background: 'transparent' }}>
      <div className="max-w-5xl mx-auto px-5 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>Shopping List</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>{weekLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            {([{ label: '←', action: () => setMonday(d => addDays(d, -7)) }, { label: 'This week', action: () => setMonday(isoWeekMonday(new Date())) }, { label: '→', action: () => setMonday(d => addDays(d, 7)) }]).map(({ label, action }) => (
              <button key={label} onClick={action}
                className="font-medium transition-colors"
                style={{ height: 36, padding: '0 14px', borderRadius: 9, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 13 }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {error && <div className="mb-4 px-4 py-3 rounded-xl" style={{ color: '#e23b4a', background: '#fff1f2', border: '1px solid #fecdd3', fontSize: 13 }}>{error}</div>}

        {loading ? (
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-[1fr_300px]">
            <div className="space-y-2">
              <div className="mb-4 rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                <div className="skeleton" style={{ height: 14, width: '40%', marginBottom: 12 }} />
                <div className="skeleton" style={{ height: 5, borderRadius: 999 }} />
              </div>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3" style={{ background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border-color)', padding: '12px 16px' }}>
                  <div className="skeleton shrink-0" style={{ width: 22, height: 22, borderRadius: '50%' }} />
                  <div className="flex-1 space-y-1.5">
                    <div className="skeleton" style={{ height: 14, width: '55%' }} />
                    <div className="skeleton" style={{ height: 11, width: '30%' }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', alignSelf: 'start' }}>
              <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-soft)' }}>
                <div className="skeleton" style={{ height: 14, width: '60%' }} />
              </div>
              <div className="p-4 space-y-2">
                {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 13 }} />)}
              </div>
            </div>
          </div>
        ) : toBuy.length === 0 && have.length === 0 ? (
          <div className="text-center py-32">
            <p className="font-bold text-lg mb-2" style={{ color: 'var(--text-primary)' }}>No meals planned this week</p>
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Add meals on the Weekly Plan page to generate a shopping list.</p>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-[1fr_300px]">
            <div>
              {toBuy.length > 0 && (
                <div className="mb-4 rounded-xl p-4" style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-card)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{doneCount} of {totalCount} items</span>
                      <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}> · {Math.round(totalCount ? (doneCount / totalCount) * 100 : 0)}% done</span>
                    </div>
                    <button
                      onClick={() => {
                        const all = toBuy.map(i => i.ingredient);
                        const allDone = all.every(k => checked[k]);
                        const next: Record<string, boolean> = {};
                        all.forEach(k => { next[k] = !allDone; });
                        setChecked(c => ({ ...c, ...next }));
                      }}
                      className="cursor-pointer"
                      style={{ color: '#3b82f6', fontSize: 12, fontWeight: 700, background: '#eff6ff', border: 'none', padding: '4px 10px', borderRadius: 8 }}>
                      {toBuy.every(i => checked[i.ingredient]) ? 'Uncheck all' : 'Check all'}
                    </button>
                  </div>
                  <div className="rounded-full overflow-hidden" style={{ height: 5, background: 'var(--bg-soft)' }}>
                    <div className="h-full rounded-full" style={{ width: `${totalCount ? (doneCount / totalCount) * 100 : 0}%`, background: '#3b82f6', transition: 'width 0.4s ease' }} />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
                  To buy <span className="font-normal text-sm" style={{ color: 'var(--text-tertiary)' }}>({toBuy.length})</span>
                </h2>
              </div>

              {toBuy.length === 0 ? (
                <div className="rounded-xl py-6 text-center font-semibold text-sm" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534' }}>✓ You have everything for this week!</div>
              ) : (
                <ul className="space-y-2">
                  {toBuy.map((item, i) => {
                    const done = checked[item.ingredient];
                    return (
                      <li key={i} onClick={() => toggleCheck(item)} className="flex items-center gap-3 cursor-pointer transition-all"
                        style={{ background: 'var(--bg-card)', borderRadius: 14, boxShadow: 'var(--shadow-card)', padding: '12px 16px', opacity: done ? 0.45 : 1, transition: 'opacity 0.2s ease' }}>
                        <span className="shrink-0 flex items-center justify-center font-bold"
                          style={{ width: 22, height: 22, borderRadius: 9999, fontSize: 12, border: done ? 'none' : '2px solid var(--border-color)', background: done ? '#3b82f6' : 'transparent', color: '#fff' }}>
                          {addingToPantry[item.ingredient] ? <span style={{ fontSize: 9, opacity: 0.6 }}>…</span> : done ? '✓' : ''}
                        </span>
                        <div className="flex-1 min-w-0">
                          <span className="font-semibold capitalize text-sm" style={{ color: 'var(--text-primary)', textDecoration: done ? 'line-through' : 'none' }}>{item.ingredient}</span>
                          <span className="ml-1.5 text-sm" style={{ color: 'var(--text-tertiary)' }}>{item.to_buy} {item.unit}</span>
                          {item.used_in?.length > 0 && <p className="truncate mt-0.5 text-xs" style={{ color: 'var(--text-placeholder)' }}>{item.used_in.join(', ')}</p>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-card)', alignSelf: 'start' }}>
              <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border-soft)', background: 'linear-gradient(135deg, #f0fdf4, #f8fffb)' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                <h3 className="font-bold text-sm" style={{ color: '#15803d' }}>
                  Already have <span className="font-normal ml-1" style={{ color: '#86efac', fontSize: 12 }}>({have.length})</span>
                </h3>
              </div>
              {have.length === 0 ? (
                <p className="text-center py-8 text-xs" style={{ color: 'var(--text-placeholder)' }}>Nothing in pantry yet</p>
              ) : (
                <ul>
                  {have.map((item, i) => (
                    <li key={i} className="flex items-center gap-2 px-4 py-2.5"
                      style={{ borderBottom: i < have.length - 1 ? '1px solid var(--bg-muted)' : 'none' }}>
                      <span className="shrink-0 flex items-center justify-center" style={{ width: 16, height: 16, borderRadius: '50%', background: '#dcfce7' }}>
                        <svg width="8" height="8" viewBox="0 0 12 12" fill="none"><polyline points="1.5,6 4.5,9 10.5,3" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </span>
                      <span className="flex-1 capitalize text-sm" style={{ color: 'var(--text-secondary)' }}>{item.ingredient}</span>
                      <span className="shrink-0 text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{item.have_in_inventory} {item.unit}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
