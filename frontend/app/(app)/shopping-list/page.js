'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getWeeklyShoppingList, addInventoryItem, deleteInventoryItem, isLoggedIn } from '@/lib/api';

function isoWeekMonday(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
}
function addDays(d, n) {
  const date = new Date(d);
  date.setDate(date.getDate() + n);
  return date;
}
function toIso(d) { return d.toISOString().split('T')[0]; }

export default function ShoppingListPage() {
  const router = useRouter();
  const [monday, setMonday] = useState(() => isoWeekMonday(new Date()));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [checked, setChecked] = useState({});
  const [addingToPantry, setAddingToPantry] = useState({});
  // Maps ingredient name → inventory item id (so we can delete on uncheck)
  const [inventoryIds, setInventoryIds] = useState({});

  const weekLabel = `${toIso(monday)} – ${toIso(addDays(monday, 6))}`;

  useEffect(() => {
    if (!isLoggedIn()) { router.push('/login'); return; }
    fetchList();
  }, [monday, router]);

  async function toggleCheck(item) {
    const wasChecked = checked[item.ingredient];
    setAddingToPantry(a => ({ ...a, [item.ingredient]: true }));
    try {
      if (!wasChecked) {
        // Add to pantry and store the returned id
        const created = await addInventoryItem({
          item_name: item.ingredient,
          quantity: item.to_buy,
          unit: item.unit || 'whole',
        });
        setInventoryIds(ids => ({ ...ids, [item.ingredient]: created.id }));
        setChecked(c => ({ ...c, [item.ingredient]: true }));
      } else {
        // Remove from pantry
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
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  const toBuy = data?.items_to_buy || [];
  const have = data?.already_have || [];
  const doneCount = toBuy.filter(i => checked[i.ingredient]).length;

  return (
    <div className="min-h-full" style={{ background: '#f7f7f8' }}>
      <div className="max-w-5xl mx-auto px-8 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold" style={{ color: '#191c1f', letterSpacing: '-0.5px' }}>Shopping List</h1>
            <p className="text-base mt-1" style={{ color: '#8d969e' }}>{weekLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            {[
              { label: '←', action: () => setMonday(d => addDays(d, -7)) },
              { label: 'This week', action: () => setMonday(isoWeekMonday(new Date())) },
              { label: '→', action: () => setMonday(d => addDays(d, 7)) },
            ].map(({ label, action }) => (
              <button key={label} onClick={action}
                className="font-medium transition-colors"
                style={{ height: 40, padding: '0 18px', borderRadius: 10, border: '1px solid #e2e2e7', background: '#fff', color: '#191c1f', fontSize: 14 }}
              >{label}</button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-6 px-5 py-4 rounded-2xl" style={{ color: '#e23b4a', background: '#fff1f2', border: '1px solid #fecdd3', fontSize: 15 }}>
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-40" style={{ color: '#8d969e', fontSize: 16 }}>Loading your list…</div>
        ) : toBuy.length === 0 && have.length === 0 ? (
          <div className="text-center py-40">
            <p className="font-bold text-xl mb-2" style={{ color: '#191c1f' }}>No meals planned this week</p>
            <p style={{ color: '#8d969e', fontSize: 15 }}>Add meals on the Weekly Plan page to generate a shopping list.</p>
          </div>
        ) : (
          <div className="grid gap-6" style={{ gridTemplateColumns: '1fr 340px' }}>

            {/* Left — To buy */}
            <div>
              {/* Progress bar */}
              {toBuy.length > 0 && (
                <div className="mb-5 rounded-2xl p-5" style={{ background: '#fff', border: '1px solid #e8e8ec' }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-semibold" style={{ color: '#191c1f', fontSize: 15 }}>{doneCount} of {toBuy.length} items checked</span>
                    <button
                      onClick={() => {
                        const all = toBuy.map(i => i.ingredient);
                        const allDone = all.every(k => checked[k]);
                        const next = {};
                        all.forEach(k => { next[k] = !allDone; });
                        setChecked(c => ({ ...c, ...next }));
                      }}
                      style={{ color: '#494fdf', fontSize: 14, fontWeight: 600 }}
                    >
                      {toBuy.every(i => checked[i.ingredient]) ? 'Uncheck all' : 'Check all'}
                    </button>
                  </div>
                  <div className="rounded-full overflow-hidden" style={{ height: 6, background: '#f0f0f2' }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${toBuy.length ? (doneCount / toBuy.length) * 100 : 0}%`, background: '#191c1f' }}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-xl" style={{ color: '#191c1f' }}>
                  To buy <span className="font-normal text-base" style={{ color: '#8d969e' }}>({toBuy.length})</span>
                </h2>
              </div>

              {toBuy.length === 0 ? (
                <div className="rounded-2xl py-8 text-center font-semibold" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', fontSize: 16 }}>
                  ✓ You have everything for this week!
                </div>
              ) : (
                <ul className="space-y-2.5">
                  {toBuy.map((item, i) => {
                    const done = checked[item.ingredient];
                    return (
                      <li
                        key={i}
                        onClick={() => toggleCheck(item)}
                        className="flex items-center gap-4 cursor-pointer transition-all"
                        style={{
                          background: '#fff', borderRadius: 16, border: '1px solid #e8e8ec',
                          padding: '14px 20px', opacity: done ? 0.4 : 1,
                        }}
                      >
                        {/* Checkbox */}
                        <span
                          className="shrink-0 flex items-center justify-center font-bold transition-all"
                          style={{
                            width: 28, height: 28, borderRadius: 9999, fontSize: 13,
                            border: done ? 'none' : '2px solid #e2e2e7',
                            background: done ? '#191c1f' : 'transparent',
                            color: '#fff',
                          }}
                        >
                          {addingToPantry[item.ingredient] ? (
                            <span style={{ fontSize: 10, opacity: 0.6 }}>...</span>
                          ) : done ? '✓' : ''}
                        </span>

                        {/* Name + quantity */}
                        <div className="flex-1 min-w-0">
                          <span
                            className="font-semibold capitalize"
                            style={{ color: '#191c1f', fontSize: 16, textDecoration: done ? 'line-through' : 'none' }}
                          >{item.ingredient}</span>
                          <span className="ml-2 font-normal" style={{ color: '#8d969e', fontSize: 15 }}>
                            {item.to_buy} {item.unit}
                          </span>
                          {item.used_in?.length > 0 && (
                            <p className="truncate mt-0.5" style={{ color: '#c9c9cd', fontSize: 13 }}>
                              {item.used_in.join(', ')}
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Right — Already have */}
            <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid #e8e8ec', alignSelf: 'start' }}>
              <div className="px-6 py-4" style={{ borderBottom: '1px solid #f0f0f2' }}>
                <h3 className="font-bold" style={{ color: '#191c1f', fontSize: 17 }}>
                  In your pantry
                  <span className="font-normal ml-2" style={{ color: '#8d969e', fontSize: 15 }}>({have.length})</span>
                </h3>
              </div>
              {have.length === 0 ? (
                <p className="text-center py-10" style={{ color: '#c9c9cd', fontSize: 15 }}>Nothing tracked yet</p>
              ) : (
                <ul>
                  {have.map((item, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-3 px-6 py-3.5"
                      style={{ borderBottom: i < have.length - 1 ? '1px solid #f7f7f8' : 'none' }}
                    >
                      <span className="font-bold" style={{ color: '#16a34a', fontSize: 14 }}>✓</span>
                      <span className="flex-1 capitalize" style={{ color: '#505a63', fontSize: 15 }}>{item.ingredient}</span>
                      <span className="shrink-0" style={{ color: '#c9c9cd', fontSize: 13 }}>
                        {item.have_in_inventory} {item.unit}
                      </span>
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
