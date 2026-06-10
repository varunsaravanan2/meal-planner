'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getRecipes, searchRecipes, createRecipe, extractRecipeFromText, extractRecipeFromUrl, deleteRecipe, isLoggedIn } from '@/lib/api';
import type { Recipe, NutritionInfo } from '@/types';

const CATEGORY_COLORS: Record<string, { color: string; bg: string }> = {
  breakfast: { color: '#f59e0b', bg: '#fffbeb' },
  lunch:     { color: '#10b981', bg: '#f0fdf4' },
  dinner:    { color: '#6366f1', bg: '#eef2ff' },
  snack:     { color: '#f43f5e', bg: '#fff1f2' },
  dessert:   { color: '#8b5cf6', bg: '#f5f3ff' },
};
const DEFAULT_COLORS = { color: '#8d969e', bg: '#f4f4f4' };

function NutritionLabel({ n }: { n: NutritionInfo }) {
  const cal = n.calories != null ? Math.round(n.calories / 10) * 10 : null;
  const rows: [string, number | null, string][] = [
    ['Total Fat', n.fat_g, 'g'],
    ['  Saturated Fat', n.saturated_fat_g, 'g'],
    ['Cholesterol', n.cholesterol_mg, 'mg'],
    ['Sodium', n.sodium_mg, 'mg'],
    ['Total Carbohydrate', n.carbs_g, 'g'],
    ['  Dietary Fiber', n.fiber_g, 'g'],
    ['  Total Sugars', n.sugar_g, 'g'],
    ['Protein', n.protein_g, 'g'],
  ];
  return (
    <div style={{ border: '2px solid #191c1f', borderRadius: 8, padding: '10px 12px' }}>
      <p className="font-black text-xl" style={{ color: '#191c1f', borderBottom: '8px solid #191c1f', paddingBottom: 4, marginBottom: 4 }}>Nutrition Facts</p>
      <p className="text-xs" style={{ color: '#191c1f', borderBottom: '1px solid #c0c4cc', paddingBottom: 4, marginBottom: 4 }}>Per serving</p>
      {cal != null && (
        <div className="flex items-end justify-between" style={{ borderBottom: '4px solid #191c1f', paddingBottom: 4, marginBottom: 4 }}>
          <span className="text-xs font-bold" style={{ color: '#191c1f' }}>Calories</span>
          <span className="font-black text-3xl" style={{ color: '#191c1f' }}>{cal}</span>
        </div>
      )}
      <div className="space-y-1">
        {rows.map(([label, val, unit]) => val != null && (
          <div key={label} className="flex justify-between text-xs" style={{ borderBottom: '1px solid #e2e2e7', paddingBottom: 2 }}>
            <span style={{ color: '#191c1f', paddingLeft: label.startsWith('  ') ? 12 : 0, fontWeight: label.startsWith('  ') ? 400 : 600 }}>{label.trim()}</span>
            <span style={{ color: '#191c1f' }}><strong>{Math.round(val * 10) / 10}</strong>{unit}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CategoryBadge({ category }: { category: string | null }) {
  if (!category) return null;
  const { color, bg } = CATEGORY_COLORS[category] || DEFAULT_COLORS;
  return <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize" style={{ color, background: bg }}>{category}</span>;
}

interface RecipeForm {
  title: string; description: string; category: string; cuisine: string;
  prep_time: string; cook_time: string; servings: string; ingredients: string; steps: string;
}

export default function RecipesPage() {
  const router = useRouter();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [query, setQuery] = useState<string>('');
  const [showAdd, setShowAdd] = useState<boolean>(false);
  const [tab, setTab] = useState<string>('manual');
  const [form, setForm] = useState<RecipeForm>({ title: '', description: '', category: '', cuisine: '', prep_time: '', cook_time: '', servings: '', ingredients: '', steps: '' });
  const [aiText, setAiText] = useState<string>('');
  const [aiUrl, setAiUrl] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [selected, setSelected] = useState<Recipe | null>(null);

  useEffect(() => { if (!isLoggedIn()) { router.push('/login'); return; } loadRecipes(); }, [router]);

  async function loadRecipes() {
    setLoading(true);
    try { setRecipes((await getRecipes({ page_size: 50 }))?.recipes || []); }
    catch { if (!isLoggedIn()) router.push('/login'); }
    finally { setLoading(false); }
  }

  async function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value; setQuery(q);
    if (!q.trim()) { loadRecipes(); return; }
    try { setRecipes((await searchRecipes(q)) || []); } catch {}
  }

  function parseIngredients(raw: string) {
    return raw.split('\n').map(line => {
      const p = line.trim().split(/\s+/);
      return { name: p.slice(2).join(' ') || line.trim(), quantity: p[0] || '1', unit: p[1] || '' };
    }).filter(i => i.name);
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      await createRecipe({
        title: form.title, description: form.description || null,
        category: form.category || null, cuisine: form.cuisine || null,
        prep_time: form.prep_time ? Number(form.prep_time) : null,
        cook_time: form.cook_time ? Number(form.cook_time) : null,
        servings: form.servings ? Number(form.servings) : null,
        ingredients: parseIngredients(form.ingredients),
        steps: form.steps.split('\n').map(s => s.trim()).filter(Boolean),
      });
      setShowAdd(false);
      setForm({ title: '', description: '', category: '', cuisine: '', prep_time: '', cook_time: '', servings: '', ingredients: '', steps: '' });
      loadRecipes();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  async function handleAiSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(''); setSaving(true);
    try { await extractRecipeFromText(aiText); setShowAdd(false); setAiText(''); loadRecipes(); }
    catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  async function handleUrlSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(''); setSaving(true);
    try { await extractRecipeFromUrl(aiUrl); setShowAdd(false); setAiUrl(''); loadRecipes(); }
    catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this recipe?')) return;
    try { await deleteRecipe(id); setSelected(null); loadRecipes(); } catch (e) { alert((e as Error).message); }
  }

  const inp: React.CSSProperties = { height: 44, padding: '0 14px', border: '1.5px solid #e2e2e7', borderRadius: 10, color: '#191c1f', background: '#fff', width: '100%', fontSize: 14, outline: 'none' };
  const ta: React.CSSProperties = { padding: '12px 14px', border: '1.5px solid #e2e2e7', borderRadius: 10, color: '#191c1f', background: '#fff', width: '100%', fontSize: 14, resize: 'vertical', outline: 'none' };

  return (
    <div className="p-6 min-h-full" style={{ background: '#f7f7f8' }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: '#191c1f', letterSpacing: '-0.5px' }}>Recipes</h1>
          <p className="text-base mt-1" style={{ color: '#8d969e' }}>{recipes.length} recipe{recipes.length !== 1 ? 's' : ''} saved</p>
        </div>
        <button onClick={() => { setShowAdd(true); setTab('manual'); setError(''); }}
          className="flex items-center gap-2 text-sm font-semibold text-white transition-all"
          style={{ height: 40, padding: '0 18px', borderRadius: 10, background: '#191c1f' }}
          onMouseEnter={e => e.currentTarget.style.background = '#000'}
          onMouseLeave={e => e.currentTarget.style.background = '#191c1f'}>
          + Add recipe
        </button>
      </div>

      <div className="relative mb-5">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#8d969e' }}>🔍</span>
        <input value={query} onChange={handleSearch} placeholder="Search recipes…"
          className="w-full text-sm focus:outline-none"
          style={{ height: 52, paddingLeft: 42, paddingRight: 16, border: '1.5px solid #e2e2e7', borderRadius: 14, color: '#191c1f', background: '#fff', fontSize: 15 }}
          onFocus={e => e.currentTarget.style.borderColor = '#191c1f'}
          onBlur={e => e.currentTarget.style.borderColor = '#e2e2e7'}
        />
      </div>

      {loading ? (
        <div className="text-center py-32 text-sm" style={{ color: '#8d969e' }}>Loading recipes…</div>
      ) : recipes.length === 0 ? (
        <div className="text-center py-32">
          <div className="text-5xl mb-4">—</div>
          <h3 className="font-bold text-lg mb-1" style={{ color: '#191c1f' }}>No recipes yet</h3>
          <p className="text-sm mb-6" style={{ color: '#8d969e' }}>Add your first recipe manually or paste text and let AI extract it.</p>
          <button onClick={() => { setShowAdd(true); setTab('ai'); }} className="text-sm font-semibold text-white px-5 py-2.5 rounded-xl" style={{ background: '#494fdf' }}>Try AI extraction</button>
        </div>
      ) : (
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
          {recipes.map(r => {
            const { color } = CATEGORY_COLORS[r.category || ''] || DEFAULT_COLORS;
            return (
              <button key={r.id} onClick={() => setSelected(r)}
                className="text-left rounded-2xl overflow-hidden transition-all"
                style={{ background: '#fff', border: '1px solid #e8e8ec', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.1)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'; e.currentTarget.style.transform = 'none'; }}>
                <div className="h-2" style={{ background: color }} />
                <div className="p-5">
                  <h3 className="font-bold leading-snug mb-3" style={{ color: '#191c1f', fontSize: 16 }}>{r.title}</h3>
                  <div className="flex items-center justify-between">
                    <CategoryBadge category={r.category} />
                    {(r.prep_time || r.cook_time) && <span style={{ color: '#8d969e', fontSize: 13 }}>⏱ {(r.prep_time || 0) + (r.cook_time || 0)} min</span>}
                  </div>
                  {r.cuisine && <p className="mt-2" style={{ color: '#8d969e', fontSize: 13 }}>{r.cuisine}</p>}
                  {r.nutrition?.calories != null && (
                    <div className="flex gap-3 mt-3 pt-3" style={{ borderTop: '1px solid #f0f0f2' }}>
                      {([
                        ['Cal', Math.round(r.nutrition.calories / 10) * 10] as [string, number],
                        r.nutrition.protein_g != null ? ['Protein', `${Math.round(r.nutrition.protein_g)}g`] as [string, string] : null,
                        r.nutrition.carbs_g != null ? ['Carbs', `${Math.round(r.nutrition.carbs_g)}g`] as [string, string] : null,
                        r.nutrition.fat_g != null ? ['Fat', `${Math.round(r.nutrition.fat_g)}g`] as [string, string] : null,
                      ].filter(Boolean) as [string, string | number][]).map(([label, val]) => (
                        <div key={label}>
                          <p className="font-bold" style={{ color: '#191c1f', fontSize: 13 }}>{val}</p>
                          <p style={{ color: '#8d969e', fontSize: 11 }}>{label}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-lg flex flex-col" style={{ background: '#fff', borderRadius: 20, maxHeight: '88vh', boxShadow: '0 24px 64px rgba(0,0,0,0.15)' }}>
            <div className="h-1.5 rounded-t-[20px]" style={{ background: (CATEGORY_COLORS[selected.category || ''] || DEFAULT_COLORS).color }} />
            <div className="px-6 pt-4 pb-4 flex items-start justify-between" style={{ borderBottom: '1px solid #f0f0f2' }}>
              <div>
                <h3 className="font-bold text-lg leading-tight" style={{ color: '#191c1f' }}>{selected.title}</h3>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <CategoryBadge category={selected.category} />
                  {selected.cuisine && <span className="text-xs" style={{ color: '#8d969e' }}>{selected.cuisine}</span>}
                  {selected.total_time && <span className="text-xs" style={{ color: '#8d969e' }}>⏱ {selected.total_time} min</span>}
                  {selected.servings && <span className="text-xs" style={{ color: '#8d969e' }}>{selected.servings} servings</span>}
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="text-lg ml-4 w-8 h-8 flex items-center justify-center rounded-full" style={{ color: '#8d969e', background: '#f4f4f4' }}>✕</button>
            </div>
            <div className="overflow-y-auto px-6 py-5 space-y-5">
              {selected.nutrition?.calories != null && <NutritionLabel n={selected.nutrition} />}
              {selected.description && <p className="text-sm" style={{ color: '#505a63' }}>{selected.description}</p>}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#8d969e' }}>Ingredients</h4>
                <ul className="space-y-2">
                  {selected.ingredients?.map((ing, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm" style={{ color: '#191c1f' }}>
                      <span className="mt-1 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: (CATEGORY_COLORS[selected.category || ''] || DEFAULT_COLORS).color }} />
                      <span><strong>{ing.quantity} {ing.unit}</strong> {ing.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: '#8d969e' }}>Steps</h4>
                <ol className="space-y-3">
                  {selected.steps?.map((step, i) => (
                    <li key={i} className="flex gap-3 text-sm" style={{ color: '#191c1f' }}>
                      <span className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: '#f4f4f4', color: '#505a63' }}>{i + 1}</span>
                      <span className="pt-0.5">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
            <div className="px-6 py-4" style={{ borderTop: '1px solid #f0f0f2' }}>
              <button onClick={() => handleDelete(selected.id)} className="w-full text-sm font-medium py-2.5 rounded-xl transition-colors" style={{ color: '#e23b4a', border: '1px solid #fecdd3', background: '#fff' }}
                onMouseEnter={e => e.currentTarget.style.background = '#fff1f2'}
                onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
                Delete recipe
              </button>
            </div>
          </div>
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-lg flex flex-col" style={{ background: '#fff', borderRadius: 20, maxHeight: '90vh', boxShadow: '0 24px 64px rgba(0,0,0,0.15)' }}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #f0f0f2' }}>
              <h3 className="font-bold text-lg" style={{ color: '#191c1f' }}>Add Recipe</h3>
              <button onClick={() => setShowAdd(false)} className="w-8 h-8 flex items-center justify-center rounded-full text-lg" style={{ color: '#8d969e', background: '#f4f4f4' }}>✕</button>
            </div>
            <div className="flex gap-1 p-2 mx-6 mt-4 rounded-xl mb-1" style={{ background: '#f4f4f4' }}>
              {([['manual','Manual'],['ai','AI Extract'],['url','Instagram URL']] as [string,string][]).map(([key, label]) => (
                <button key={key} onClick={() => { setTab(key); setError(''); }}
                  className="flex-1 py-2 text-sm font-semibold rounded-lg transition-all"
                  style={tab === key ? { background: '#fff', color: '#191c1f', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' } : { color: '#8d969e', background: 'transparent' }}>
                  {label}
                </button>
              ))}
            </div>
            <div className="overflow-y-auto px-6 py-4">
              {error && <div className="mb-4 text-sm px-4 py-3 rounded-xl" style={{ color: '#e23b4a', background: '#fff1f2', border: '1px solid #fecdd3' }}>{error}</div>}
              {tab === 'manual' ? (
                <form id="manual-form" onSubmit={handleManualSubmit} className="space-y-3">
                  {([{ label: 'Title', key: 'title', placeholder: 'Pasta Carbonara', required: true }, { label: 'Description', key: 'description', placeholder: 'Optional', required: false }] as { label: string; key: keyof RecipeForm; placeholder: string; required: boolean }[]).map(({ label, key, placeholder, required }) => (
                    <div key={key}>
                      <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#8d969e' }}>{label}</label>
                      <input required={required} value={form[key] as string} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} style={inp} placeholder={placeholder}
                        onFocus={e => e.currentTarget.style.borderColor = '#191c1f'}
                        onBlur={e => e.currentTarget.style.borderColor = '#e2e2e7'} />
                    </div>
                  ))}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#8d969e' }}>Category</label>
                      <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={inp}>
                        <option value="">—</option>
                        {['breakfast','lunch','dinner','snack','dessert'].map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#8d969e' }}>Cuisine</label>
                      <input value={form.cuisine} onChange={e => setForm(f => ({ ...f, cuisine: e.target.value }))} style={inp} placeholder="Italian"
                        onFocus={e => e.currentTarget.style.borderColor = '#191c1f'}
                        onBlur={e => e.currentTarget.style.borderColor = '#e2e2e7'} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#8d969e' }}>Prep (min)</label>
                      <input type="number" min="0" value={form.prep_time} onChange={e => setForm(f => ({ ...f, prep_time: e.target.value }))} style={inp} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#8d969e' }}>Cook (min)</label>
                      <input type="number" min="0" value={form.cook_time} onChange={e => setForm(f => ({ ...f, cook_time: e.target.value }))} style={inp} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#8d969e' }}>Ingredients <span className="normal-case font-normal" style={{ color: '#c9c9cd' }}>(qty unit name, one per line)</span></label>
                    <textarea required value={form.ingredients} onChange={e => setForm(f => ({ ...f, ingredients: e.target.value }))} style={{ ...ta, minHeight: 88 }} placeholder={"400 g spaghetti\n4 whole eggs\n200 g bacon"}
                      onFocus={e => e.currentTarget.style.borderColor = '#191c1f'}
                      onBlur={e => e.currentTarget.style.borderColor = '#e2e2e7'} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#8d969e' }}>Steps <span className="normal-case font-normal" style={{ color: '#c9c9cd' }}>(one per line)</span></label>
                    <textarea required value={form.steps} onChange={e => setForm(f => ({ ...f, steps: e.target.value }))} style={{ ...ta, minHeight: 88 }} placeholder={"Boil pasta in salted water\nFry bacon until crispy\nCombine everything"}
                      onFocus={e => e.currentTarget.style.borderColor = '#191c1f'}
                      onBlur={e => e.currentTarget.style.borderColor = '#e2e2e7'} />
                  </div>
                </form>
              ) : tab === 'ai' ? (
                <form id="ai-form" onSubmit={handleAiSubmit} className="space-y-3">
                  <div className="rounded-xl p-4 text-sm" style={{ background: '#eef2ff', border: '1px solid #c7d2fe', color: '#4338ca' }}>Paste any recipe text — a social media caption, blog snippet, or notes.</div>
                  <textarea required value={aiText} onChange={e => setAiText(e.target.value)} style={{ ...ta, minHeight: 180 }} placeholder="Paste recipe text here…"
                    onFocus={e => e.currentTarget.style.borderColor = '#191c1f'}
                    onBlur={e => e.currentTarget.style.borderColor = '#e2e2e7'} />
                </form>
              ) : (
                <form id="url-form" onSubmit={handleUrlSubmit} className="space-y-3">
                  <div className="rounded-xl p-4 text-sm" style={{ background: '#eef2ff', border: '1px solid #c7d2fe', color: '#4338ca' }}>Paste an Instagram post URL with a recipe in the caption.</div>
                  <input required type="url" value={aiUrl} onChange={e => setAiUrl(e.target.value)} placeholder="https://www.instagram.com/p/..." style={inp}
                    onFocus={e => e.currentTarget.style.borderColor = '#191c1f'}
                    onBlur={e => e.currentTarget.style.borderColor = '#e2e2e7'} />
                </form>
              )}
            </div>
            <div className="px-6 py-4 flex gap-2" style={{ borderTop: '1px solid #f0f0f2' }}>
              <button onClick={() => setShowAdd(false)} className="flex-1 text-sm font-medium" style={{ height: 44, borderRadius: 12, border: '1px solid #e2e2e7', color: '#505a63', background: '#fff' }}>Cancel</button>
              <button type="submit" form={tab === 'manual' ? 'manual-form' : tab === 'ai' ? 'ai-form' : 'url-form'} disabled={saving} className="flex-1 text-sm font-semibold text-white disabled:opacity-40" style={{ height: 44, borderRadius: 12, background: tab === 'ai' ? '#494fdf' : '#191c1f' }}>
                {saving ? 'Extracting…' : tab === 'manual' ? 'Save recipe' : 'Extract recipe'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
