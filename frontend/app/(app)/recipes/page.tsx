'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getRecipes, searchRecipes, createRecipe, updateRecipe, extractRecipeFromText, extractRecipeFromUrl, deleteRecipe, isLoggedIn, getSubscriptionStatus, toggleFavorite, type SubscriptionStatus } from '@/lib/api';
import type { Recipe, NutritionInfo } from '@/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const CATEGORY_COLORS: Record<string, { color: string; bg: string }> = {
  breakfast: { color: '#f59e0b', bg: '#fffbeb' },
  lunch:     { color: '#10b981', bg: '#f0fdf4' },
  dinner:    { color: '#6366f1', bg: '#eef2ff' },
  snack:     { color: '#f43f5e', bg: '#fff1f2' },
  dessert:   { color: '#8b5cf6', bg: '#f5f3ff' },
  packaged:  { color: '#0ea5e9', bg: '#f0f9ff' },
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
    <div style={{ border: '2px solid var(--text-primary)', borderRadius: 10, padding: '12px 14px' }}>
      <p className="font-black text-xl" style={{ color: 'var(--text-primary)', borderBottom: '8px solid var(--text-primary)', paddingBottom: 4, marginBottom: 4 }}>Nutrition Facts</p>
      <p className="text-xs" style={{ color: 'var(--text-primary)', borderBottom: '1px solid #c0c4cc', paddingBottom: 4, marginBottom: 4 }}>Per serving</p>
      {cal != null && (
        <div className="flex items-end justify-between" style={{ borderBottom: '4px solid var(--text-primary)', paddingBottom: 4, marginBottom: 4 }}>
          <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>Calories</span>
          <span className="font-black text-3xl" style={{ color: 'var(--text-primary)' }}>{cal}</span>
        </div>
      )}
      <div className="space-y-1">
        {rows.map(([label, val, unit]) => val != null && (
          <div key={label} className="flex justify-between text-xs" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: 2 }}>
            <span style={{ color: 'var(--text-primary)', paddingLeft: label.startsWith('  ') ? 12 : 0, fontWeight: label.startsWith('  ') ? 400 : 600 }}>{label.trim()}</span>
            <span style={{ color: 'var(--text-primary)' }}><strong>{Math.round(val * 10) / 10}</strong>{unit}</span>
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
  calories: string; protein_g: string;
}

interface PkgForm {
  name: string; brand: string; servings: string; category: string;
  calories: string; protein_g: string; carbs_g: string; fat_g: string; sodium_mg: string;
}

export default function RecipesPage() {
  const router = useRouter();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [query, setQuery] = useState<string>('');
  const [showAdd, setShowAdd] = useState<boolean>(false);
  const [tab, setTab] = useState<string>('manual');
  const [form, setForm] = useState<RecipeForm>({ title: '', description: '', category: '', cuisine: '', prep_time: '', cook_time: '', servings: '', ingredients: '', steps: '', calories: '', protein_g: '' });
  const [pkgForm, setPkgForm] = useState<PkgForm>({ name: '', brand: '', servings: '', category: '', calories: '', protein_g: '', carbs_g: '', fat_g: '', sodium_mg: '' });
  const [scanning, setScanning] = useState<boolean>(false);
  const [aiText, setAiText] = useState<string>('');
  const [aiUrl, setAiUrl] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [selected, setSelected] = useState<Recipe | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<boolean>(false);
  const [modalTop, setModalTop] = useState<number>(0);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [subStatus, setSubStatus] = useState<SubscriptionStatus | null>(null);
  const [favOnly, setFavOnly] = useState<boolean>(false);

  useEffect(() => {
    if (!isLoggedIn()) { router.push('/login'); return; }
    loadRecipes();
    getSubscriptionStatus().then(setSubStatus).catch(() => {});
  }, [router]);

  const isPremiumLocked = subStatus !== null && subStatus.plan_type === 'free';

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

  async function handleToggleFavorite(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    setRecipes(rs => rs.map(r => r.id === id ? { ...r, is_favorite: !r.is_favorite } : r));
    if (selected?.id === id) setSelected(s => s ? { ...s, is_favorite: !s.is_favorite } : s);
    try { await toggleFavorite(id); } catch { loadRecipes(); }
  }

  function parseIngredients(raw: string) {
    return raw.split('\n').map(line => {
      const p = line.trim().split(/\s+/);
      return { name: p.slice(2).join(' ') || line.trim(), quantity: p[0] || '1', unit: p[1] || '' };
    }).filter(i => i.name);
  }

  function openEdit(r: Recipe) {
    setEditingRecipe(r);
    setForm({
      title: r.title ?? '',
      description: r.description ?? '',
      category: r.category ?? '',
      cuisine: r.cuisine ?? '',
      prep_time: r.prep_time != null ? String(r.prep_time) : '',
      cook_time: r.cook_time != null ? String(r.cook_time) : '',
      servings: r.servings != null ? String(r.servings) : '',
      ingredients: r.ingredients?.map(i => `${i.quantity} ${i.unit} ${i.name}`.trim()).join('\n') ?? '',
      steps: r.steps?.join('\n') ?? '',
      calories: r.nutrition?.calories != null ? String(r.nutrition.calories) : '',
      protein_g: r.nutrition?.protein_g != null ? String(r.nutrition.protein_g) : '',
    });
    setSelected(null);
    setTab('manual');
    setError('');
    setShowAdd(true);
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(''); setSaving(true);
    const payload = {
      title: form.title, description: form.description || null,
      category: form.category || null, cuisine: form.cuisine || null,
      prep_time: form.prep_time ? Number(form.prep_time) : null,
      cook_time: form.cook_time ? Number(form.cook_time) : null,
      servings: form.servings ? Number(form.servings) : null,
      ingredients: parseIngredients(form.ingredients),
      steps: form.steps.split('\n').map(s => s.trim()).filter(Boolean),
      nutrition: (form.calories || form.protein_g) ? {
        calories: form.calories ? Number(form.calories) : null,
        protein_g: form.protein_g ? Number(form.protein_g) : null,
      } : null,
    };
    try {
      if (editingRecipe) {
        await updateRecipe(editingRecipe.id, payload);
      } else {
        await createRecipe(payload);
      }
      setShowAdd(false);
      setEditingRecipe(null);
      setForm({ title: '', description: '', category: '', cuisine: '', prep_time: '', cook_time: '', servings: '', ingredients: '', steps: '', calories: '', protein_g: '' });
      loadRecipes();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  async function handlePkgSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      await createRecipe({
        title: pkgForm.name,
        description: pkgForm.brand || null,
        category: pkgForm.category || null,
        servings: pkgForm.servings ? Number(pkgForm.servings) : null,
        ingredients: [], steps: [],
        nutrition: {
          calories: pkgForm.calories ? Number(pkgForm.calories) : null,
          protein_g: pkgForm.protein_g ? Number(pkgForm.protein_g) : null,
          carbs_g: pkgForm.carbs_g ? Number(pkgForm.carbs_g) : null,
          fat_g: pkgForm.fat_g ? Number(pkgForm.fat_g) : null,
          sodium_mg: pkgForm.sodium_mg ? Number(pkgForm.sodium_mg) : null,
        },
      });
      setShowAdd(false);
      setPkgForm({ name: '', brand: '', servings: '', category: '', calories: '', protein_g: '', carbs_g: '', fat_g: '', sodium_mg: '' });
      loadRecipes();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  async function handleScan(file: File) {
    setScanning(true); setError('');
    try {
      const token = localStorage.getItem('token');
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('http://localhost:8000/api/v1/recipes/scan-label', {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body,
      });
      if (!res.ok) throw new Error('Scan failed — try entering values manually.');
      const data = await res.json();
      setPkgForm(f => ({
        ...f,
        name:       data.name      || f.name,
        brand:      data.brand     || f.brand,
        calories:   data.calories   != null ? String(data.calories)   : f.calories,
        protein_g:  data.protein_g  != null ? String(data.protein_g)  : f.protein_g,
        carbs_g:    data.carbs_g    != null ? String(data.carbs_g)    : f.carbs_g,
        fat_g:      data.fat_g      != null ? String(data.fat_g)      : f.fat_g,
        sodium_mg:  data.sodium_mg  != null ? String(data.sodium_mg)  : f.sodium_mg,
      }));
    } catch (e) { setError((e as Error).message); }
    finally { setScanning(false); }
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
    try { await deleteRecipe(id); setSelected(null); setConfirmDelete(false); loadRecipes(); }
    catch (e) { alert((e as Error).message); }
  }

  const inp: React.CSSProperties = { height: 38, padding: '0 12px', border: '1.5px solid var(--border-color)', borderRadius: 9, color: 'var(--text-primary)', background: 'var(--bg-input)', width: '100%', fontSize: 13, outline: 'none' };
  const ta: React.CSSProperties = { padding: '10px 12px', border: '1.5px solid var(--border-color)', borderRadius: 9, color: 'var(--text-primary)', background: 'var(--bg-input)', width: '100%', fontSize: 13, resize: 'vertical', outline: 'none' };

  return (
    <div className="p-6 min-h-full" style={{ background: 'transparent' }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>Recipes</h1>
          <p className="text-base mt-1" style={{ color: 'var(--text-tertiary)' }}>{recipes.length} recipe{recipes.length !== 1 ? 's' : ''} saved</p>
        </div>
        <button onClick={() => { setShowAdd(true); setTab('manual'); setError(''); }}
          className="flex items-center gap-2 text-sm font-semibold text-white transition-all"
          style={{ height: 36, padding: '0 16px', borderRadius: 9, background: '#191c1f' }}
          onMouseEnter={e => e.currentTarget.style.background = '#000'}
          onMouseLeave={e => e.currentTarget.style.background = '#191c1f'}>
          + Add recipe
        </button>
      </div>

      <div className="flex gap-3 mb-5 items-center">
        <div className="relative flex-1">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8d969e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input value={query} onChange={handleSearch} placeholder="Search recipes…"
            className="w-full text-sm focus:outline-none"
            style={{ height: 42, paddingLeft: 38, paddingRight: 12, border: '1.5px solid var(--border-color)', borderRadius: 12, color: 'var(--text-primary)', background: 'var(--bg-input)', fontSize: 13 }}
            onFocus={e => e.currentTarget.style.borderColor = '#191c1f'}
            onBlur={e => e.currentTarget.style.borderColor = '#e2e2e7'}
          />
        </div>
        <button onClick={() => setFavOnly(f => !f)} title="Show favorites"
          style={{ flexShrink: 0, height: 42, padding: '0 14px', borderRadius: 12, border: `1.5px solid ${favOnly ? '#f59e0b' : 'var(--border-color)'}`, background: favOnly ? '#fffbeb' : 'var(--bg-input)', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: favOnly ? '#d97706' : 'var(--text-tertiary)', transition: 'all 0.15s' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill={favOnly ? '#f59e0b' : 'none'} stroke={favOnly ? '#f59e0b' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
          Favorites
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-card)', borderRadius: 18, overflow: 'hidden' }}>
              <div className="skeleton" style={{ height: 72 }} />
              <div className="p-5 space-y-3">
                <div className="skeleton" style={{ height: 20, width: '75%' }} />
                <div className="skeleton" style={{ height: 14, width: '40%' }} />
                <div className="flex gap-3 pt-3" style={{ borderTop: '1px solid var(--border-soft)' }}>
                  {[40, 56, 48].map((w, j) => <div key={j} className="skeleton" style={{ height: 32, width: w }} />)}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : recipes.length === 0 ? (
        <div className="text-center py-32">
          <div className="text-5xl mb-4">—</div>
          <h3 className="font-bold text-lg mb-1" style={{ color: 'var(--text-primary)' }}>No recipes yet</h3>
          <p className="text-sm mb-6" style={{ color: 'var(--text-tertiary)' }}>Add your first recipe manually or paste text and let AI extract it.</p>
          <button onClick={() => { setShowAdd(true); setTab('ai'); }} className="text-sm font-semibold text-white px-5 py-2.5 rounded-xl" style={{ background: '#494fdf' }}>Try AI extraction</button>
        </div>
      ) : (
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
          {(favOnly ? recipes.filter(r => r.is_favorite) : recipes).map(r => {
            const { color, bg } = CATEGORY_COLORS[r.category || ''] || DEFAULT_COLORS;
            return (
              <div key={r.id} className="group relative rounded-2xl overflow-hidden transition-all cursor-pointer"
                style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-card)' }}
                onClick={(e) => { const top = (e.currentTarget as HTMLDivElement).getBoundingClientRect().top; setModalTop(top); setSelected(r); setConfirmDelete(false); }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-card-hover)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-card)'; (e.currentTarget as HTMLDivElement).style.transform = 'none'; }}>

                {/* Gradient header */}
                <div style={{ height: 72, background: `linear-gradient(135deg, ${color}22 0%, ${color}0a 100%)`, borderBottom: `1px solid ${color}18`, padding: '12px 18px', display: 'flex', alignItems: 'flex-end' }}>
                  <CategoryBadge category={r.category} />
                </div>

                {/* Star favorite button */}
                <button
                  onClick={e => handleToggleFavorite(e, r.id)}
                  className={`transition-opacity absolute top-3 left-3 flex items-center justify-center cursor-pointer ${r.is_favorite ? '' : 'opacity-0 group-hover:opacity-100'}`}
                  style={{ width: 28, height: 28, borderRadius: 10, background: r.is_favorite ? '#fffbeb' : 'rgba(255,255,255,0.85)', border: 'none', boxShadow: '0 1px 4px rgba(0,0,0,0.10)' }}
                  title={r.is_favorite ? 'Remove from favorites' : 'Add to favorites'}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill={r.is_favorite ? '#f59e0b' : 'none'} stroke={r.is_favorite ? '#f59e0b' : '#8d969e'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                </button>

                {/* Hover trash button */}
                <button
                  onClick={e => { e.stopPropagation(); setSelected(r); setConfirmDelete(true); }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-3 right-3 flex items-center justify-center cursor-pointer"
                  style={{ width: 28, height: 28, borderRadius: 10, background: 'rgba(255,255,255,0.9)', border: 'none', boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }}
                  title="Delete recipe">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#e23b4a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                  </svg>
                </button>

                <div className="p-5">
                  <h3 className="font-bold leading-snug mb-2" style={{ color: 'var(--text-primary)', fontSize: 14, lineHeight: 1.3 }}>{r.title}</h3>

                  <div className="flex items-center justify-between">
                    {r.cuisine
                      ? <span style={{ color: 'var(--text-tertiary)', fontSize: 14 }}>{r.cuisine}</span>
                      : <span />}
                    {(r.prep_time || r.cook_time) && (
                      <span className="flex items-center gap-1" style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        {(r.prep_time || 0) + (r.cook_time || 0)} min
                      </span>
                    )}
                  </div>

                  {r.nutrition?.calories != null && (
                    <div className="flex gap-2 flex-wrap mt-3 pt-3" style={{ borderTop: `1px solid ${color}15` }}>
                      {([
                        ['Cal', `${Math.round(r.nutrition.calories / 10) * 10}`],
                        r.nutrition.protein_g != null ? ['Pro', `${Math.round(r.nutrition.protein_g)}g`] : null,
                        r.nutrition.carbs_g != null ? ['Carb', `${Math.round(r.nutrition.carbs_g)}g`] : null,
                        r.nutrition.fat_g != null ? ['Fat', `${Math.round(r.nutrition.fat_g)}g`] : null,
                      ].filter(Boolean) as [string, string][]).map(([label, val]) => (
                        <span key={label} style={{ fontSize: 12, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: bg, color }}>
                          {val} <span style={{ fontWeight: 400, opacity: 0.75 }}>{label}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 p-4" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} onClick={() => { setSelected(null); setConfirmDelete(false); }}>
          <div className="w-full max-w-lg flex flex-col" onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: Math.max(16, Math.min(modalTop, window.innerHeight - 520)), left: '50%', transform: 'translateX(-50%)', background: 'var(--bg-card)', borderRadius: 22, maxHeight: '88vh', boxShadow: '0 24px 64px rgba(0,0,0,0.15)' }}>
            <div className="h-1.5 rounded-t-[20px]" style={{ background: (CATEGORY_COLORS[selected.category || ''] || DEFAULT_COLORS).color }} />
            <div className="px-6 pt-4 pb-4 flex items-start justify-between" style={{ borderBottom: '1px solid var(--border-soft)' }}>
              <div>
                <h3 className="font-bold text-lg leading-tight" style={{ color: 'var(--text-primary)' }}>{selected.title}</h3>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <CategoryBadge category={selected.category} />
                  {selected.cuisine && <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{selected.cuisine}</span>}
                  {selected.total_time && <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{selected.total_time} min</span>}
                  {selected.servings && <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{selected.servings} servings</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 ml-4 shrink-0">
                <button onClick={e => handleToggleFavorite(e, selected.id)}
                  style={{ width: 32, height: 32, borderRadius: 10, border: `1.5px solid ${selected.is_favorite ? '#f59e0b' : 'var(--border-color)'}`, background: selected.is_favorite ? '#fffbeb' : 'var(--bg-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                  title={selected.is_favorite ? 'Remove from favorites' : 'Add to favorites'}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill={selected.is_favorite ? '#f59e0b' : 'none'} stroke={selected.is_favorite ? '#f59e0b' : 'var(--text-tertiary)'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                </button>
                <button onClick={() => { setSelected(null); setConfirmDelete(false); }} className="text-lg w-8 h-8 flex items-center justify-center rounded-full cursor-pointer" style={{ color: 'var(--text-tertiary)', background: 'var(--bg-soft)', border: 'none' }}>✕</button>
              </div>
            </div>
            <div className="overflow-y-auto px-6 py-5 space-y-5">
              {selected.nutrition?.calories != null && <NutritionLabel n={selected.nutrition} />}
              {selected.description && <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{selected.description}</p>}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>Ingredients</h4>
                <ul className="space-y-2">
                  {selected.ingredients?.map((ing, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-primary)' }}>
                      <span className="mt-1 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: (CATEGORY_COLORS[selected.category || ''] || DEFAULT_COLORS).color }} />
                      <span><strong>{ing.quantity} {ing.unit}</strong> {ing.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>Steps</h4>
                <ol className="space-y-3">
                  {selected.steps?.map((step, i) => (
                    <li key={i} className="flex gap-3 text-sm" style={{ color: 'var(--text-primary)' }}>
                      <span className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'var(--bg-soft)', color: 'var(--text-secondary)' }}>{i + 1}</span>
                      <span className="pt-0.5">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
            <div className="px-6 py-4" style={{ borderTop: '1px solid var(--border-soft)' }}>
              {confirmDelete ? (
                <div className="rounded-xl px-4 py-3" style={{ background: '#fff1f2', border: '1px solid #fecdd3' }}>
                  <p className="text-sm font-semibold mb-3" style={{ color: '#e23b4a' }}>Delete this recipe? This can't be undone.</p>
                  <div className="flex gap-2">
                    <button onClick={() => setConfirmDelete(false)}
                      className="flex-1 text-sm font-medium cursor-pointer"
                      style={{ height: 38, borderRadius: 12, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-secondary)' }}>
                      Cancel
                    </button>
                    <button onClick={() => handleDelete(selected.id)}
                      className="flex-1 text-sm font-semibold text-white cursor-pointer"
                      style={{ height: 38, borderRadius: 12, border: 'none', background: '#e23b4a' }}>
                      Yes, delete
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => openEdit(selected)}
                    className="flex-1 text-sm font-medium py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    style={{ color: 'var(--text-primary)', border: '1px solid var(--border-color)', background: 'var(--bg-card)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-soft)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-card)'}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    Edit
                  </button>
                  <button onClick={() => setConfirmDelete(true)}
                    className="flex-1 text-sm font-medium py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    style={{ color: '#e23b4a', border: '1px solid #fecdd3', background: 'var(--bg-card)' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#fff1f2'}
                    onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-card)'}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                    </svg>
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 flex items-start justify-center z-50 px-4 pb-4 pt-14" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', overflowY: 'auto' }} onClick={() => { setShowAdd(false); setEditingRecipe(null); }}>
          <div className="w-full max-w-lg flex flex-col" onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', borderRadius: 22, maxHeight: '90vh', boxShadow: '0 24px 64px rgba(0,0,0,0.15)' }}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-soft)' }}>
              <h3 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>{editingRecipe ? 'Edit Recipe' : 'Add Recipe'}</h3>
              <button onClick={() => { setShowAdd(false); setEditingRecipe(null); }} className="w-8 h-8 flex items-center justify-center rounded-full text-lg" style={{ color: 'var(--text-tertiary)', background: 'var(--bg-soft)' }}>✕</button>
            </div>
            {!editingRecipe && (
              <div className="flex gap-1 p-2 mx-6 mt-4 rounded-xl mb-1" style={{ background: 'var(--bg-soft)' }}>
                {([['manual','Manual'],['packaged','Packaged'],['ai','AI Extract'],['url','URL']] as [string,string][]).map(([key, label]) => (
                  <button key={key} onClick={() => { setTab(key); setError(''); }}
                    className="flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all"
                    style={tab === key ? { background: 'var(--bg-card)', color: 'var(--text-primary)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' } : { color: 'var(--text-tertiary)', background: 'transparent' }}>
                    {label}
                  </button>
                ))}
              </div>
            )}
            <div className="overflow-y-auto px-6 py-4">
              {error && <div className="mb-4 text-sm px-4 py-3 rounded-xl" style={{ color: '#e23b4a', background: '#fff1f2', border: '1px solid #fecdd3' }}>{error}</div>}
              {tab === 'manual' ? (
                <form id="manual-form" onSubmit={handleManualSubmit} className="space-y-3">
                  {([{ label: 'Title', key: 'title', placeholder: 'Pasta Carbonara', required: true }, { label: 'Description', key: 'description', placeholder: 'Optional', required: false }] as { label: string; key: keyof RecipeForm; placeholder: string; required: boolean }[]).map(({ label, key, placeholder, required }) => (
                    <div key={key}>
                      <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-tertiary)' }}>{label}</label>
                      <input required={required} value={form[key] as string} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} style={inp} placeholder={placeholder}
                        onFocus={e => e.currentTarget.style.borderColor = '#191c1f'}
                        onBlur={e => e.currentTarget.style.borderColor = '#e2e2e7'} />
                    </div>
                  ))}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-tertiary)' }}>Category</label>
                      <Select value={form.category || undefined} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                        <SelectTrigger size="lg" className="w-full"><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          {['breakfast','lunch','dinner','snack'].map(c => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-tertiary)' }}>Cuisine</label>
                      <input value={form.cuisine} onChange={e => setForm(f => ({ ...f, cuisine: e.target.value }))} style={inp} placeholder="Italian"
                        onFocus={e => e.currentTarget.style.borderColor = '#191c1f'}
                        onBlur={e => e.currentTarget.style.borderColor = '#e2e2e7'} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-tertiary)' }}>Prep (min)</label>
                      <input type="number" min="0" value={form.prep_time} onChange={e => setForm(f => ({ ...f, prep_time: e.target.value }))} style={inp} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-tertiary)' }}>Cook (min)</label>
                      <input type="number" min="0" value={form.cook_time} onChange={e => setForm(f => ({ ...f, cook_time: e.target.value }))} style={inp} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-tertiary)' }}>Ingredients <span className="normal-case font-normal" style={{ color: 'var(--text-placeholder)' }}>(qty unit name, one per line)</span></label>
                    <textarea required value={form.ingredients} onChange={e => setForm(f => ({ ...f, ingredients: e.target.value }))} style={{ ...ta, minHeight: 88 }} placeholder={"400 g spaghetti\n4 whole eggs\n200 g bacon"}
                      onFocus={e => e.currentTarget.style.borderColor = '#191c1f'}
                      onBlur={e => e.currentTarget.style.borderColor = '#e2e2e7'} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-tertiary)' }}>Steps <span className="normal-case font-normal" style={{ color: 'var(--text-placeholder)' }}>(one per line)</span></label>
                    <textarea required value={form.steps} onChange={e => setForm(f => ({ ...f, steps: e.target.value }))} style={{ ...ta, minHeight: 88 }} placeholder={"Boil pasta in salted water\nFry bacon until crispy\nCombine everything"}
                      onFocus={e => e.currentTarget.style.borderColor = '#191c1f'}
                      onBlur={e => e.currentTarget.style.borderColor = '#e2e2e7'} />
                  </div>
                  <div style={{ paddingTop: 4 }}>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>Nutrition <span className="normal-case font-normal" style={{ color: 'var(--text-placeholder)' }}>(optional, per serving)</span></p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-tertiary)' }}>Calories</label>
                        <input type="number" min="0" value={form.calories} onChange={e => setForm(f => ({ ...f, calories: e.target.value }))} style={inp} placeholder="e.g. 450"
                          onFocus={e => e.currentTarget.style.borderColor = '#191c1f'}
                          onBlur={e => e.currentTarget.style.borderColor = '#e2e2e7'} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-tertiary)' }}>Protein (g)</label>
                        <input type="number" min="0" value={form.protein_g} onChange={e => setForm(f => ({ ...f, protein_g: e.target.value }))} style={inp} placeholder="e.g. 28"
                          onFocus={e => e.currentTarget.style.borderColor = '#191c1f'}
                          onBlur={e => e.currentTarget.style.borderColor = '#e2e2e7'} />
                      </div>
                    </div>
                  </div>
                </form>
              ) : tab === 'packaged' ? (
                <form id="pkg-form" onSubmit={handlePkgSubmit} className="space-y-3">
                  {/* Scan label — paywalled */}
                  {isPremiumLocked ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 12, background: 'var(--bg-soft)', border: '1px solid var(--border-color)' }}>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>Scan Nutrition Label</p>
                        <p style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>AI reads any packaged label instantly</p>
                      </div>
                      <a href="/pricing" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px', borderRadius: 9, background: '#3b82f6', color: '#fff', fontSize: 12, fontWeight: 700, textDecoration: 'none', flexShrink: 0 }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                        Unlock
                      </a>
                    </div>
                  ) : (
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Scan Nutrition Label</label>
                      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: 12, border: '1.5px dashed var(--border-color)', background: 'var(--bg-soft)', cursor: scanning ? 'default' : 'pointer', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600 }}>
                        {scanning ? (
                          <>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>
                            Scanning…
                          </>
                        ) : (
                          <>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                            Take photo or upload label
                          </>
                        )}
                        <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={scanning}
                          onChange={e => { const f = e.target.files?.[0]; if (f) handleScan(f); }} />
                      </label>
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-placeholder)', fontSize: 11 }}>
                    <div style={{ flex: 1, height: 1, background: 'var(--border-color)' }} />
                    or enter manually
                    <div style={{ flex: 1, height: 1, background: 'var(--border-color)' }} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-tertiary)' }}>Product Name *</label>
                    <input required value={pkgForm.name} onChange={e => setPkgForm(f => ({ ...f, name: e.target.value }))} style={inp} placeholder="e.g. Greek Yogurt"
                      onFocus={e => e.currentTarget.style.borderColor = '#191c1f'}
                      onBlur={e => e.currentTarget.style.borderColor = '#e2e2e7'} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-tertiary)' }}>Brand</label>
                      <input value={pkgForm.brand} onChange={e => setPkgForm(f => ({ ...f, brand: e.target.value }))} style={inp} placeholder="e.g. Chobani"
                        onFocus={e => e.currentTarget.style.borderColor = '#191c1f'}
                        onBlur={e => e.currentTarget.style.borderColor = '#e2e2e7'} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-tertiary)' }}>Servings</label>
                      <input type="number" min="0" step="0.5" value={pkgForm.servings} onChange={e => setPkgForm(f => ({ ...f, servings: e.target.value }))} style={inp} placeholder="1"
                        onFocus={e => e.currentTarget.style.borderColor = '#191c1f'}
                        onBlur={e => e.currentTarget.style.borderColor = '#e2e2e7'} />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-tertiary)' }}>Meal Category</label>
                      <Select value={pkgForm.category || undefined} onValueChange={v => setPkgForm(f => ({ ...f, category: v }))}>
                        <SelectTrigger size="lg" className="w-full"><SelectValue placeholder="e.g. Snack, Breakfast…" /></SelectTrigger>
                        <SelectContent>
                          {['breakfast','lunch','dinner','snack'].map(c => (
                            <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-wider pt-1" style={{ color: 'var(--text-tertiary)' }}>Nutrition Facts <span className="normal-case font-normal" style={{ color: 'var(--text-placeholder)' }}>(per serving)</span></p>
                  <div className="grid grid-cols-2 gap-3">
                    {([
                      { label: 'Calories', key: 'calories', placeholder: '150' },
                      { label: 'Protein (g)', key: 'protein_g', placeholder: '15' },
                      { label: 'Total Carbs (g)', key: 'carbs_g', placeholder: '12' },
                      { label: 'Total Fat (g)', key: 'fat_g', placeholder: '5' },
                      { label: 'Sodium (mg)', key: 'sodium_mg', placeholder: '65' },
                    ] as { label: string; key: keyof PkgForm; placeholder: string }[]).map(({ label, key, placeholder }) => (
                      <div key={key} className={key === 'sodium_mg' ? 'col-span-2' : ''}>
                        <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-tertiary)' }}>{label}</label>
                        <input type="number" min="0" value={pkgForm[key]} onChange={e => setPkgForm(f => ({ ...f, [key]: e.target.value }))} style={inp} placeholder={placeholder}
                          onFocus={e => e.currentTarget.style.borderColor = '#191c1f'}
                          onBlur={e => e.currentTarget.style.borderColor = '#e2e2e7'} />
                      </div>
                    ))}
                  </div>
                </form>
              ) : tab === 'ai' ? (
                isPremiumLocked ? (
                  <div className="py-8 text-center">
                    <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--bg-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    </div>
                    <h3 style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 8 }}>Premium Feature</h3>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.5 }}>AI recipe extraction requires a paid plan.<br/>Upgrade to extract recipes from any text instantly.</p>
                    <a href="/pricing" style={{ display: 'inline-flex', alignItems: 'center', height: 38, padding: '0 20px', borderRadius: 10, background: '#3b82f6', color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
                      View Plans
                    </a>
                  </div>
                ) : (
                  <form id="ai-form" onSubmit={handleAiSubmit} className="space-y-3">
                    <div className="rounded-xl p-4 text-sm" style={{ background: '#eef2ff', border: '1px solid #c7d2fe', color: '#4338ca' }}>Paste any recipe text — a social media caption, blog snippet, or notes.</div>
                    <textarea required value={aiText} onChange={e => setAiText(e.target.value)} style={{ ...ta, minHeight: 180 }} placeholder="Paste recipe text here…"
                      onFocus={e => e.currentTarget.style.borderColor = '#191c1f'}
                      onBlur={e => e.currentTarget.style.borderColor = '#e2e2e7'} />
                  </form>
                )
              ) : (
                isPremiumLocked ? (
                  <div className="py-8 text-center">
                    <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--bg-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    </div>
                    <h3 style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 8 }}>Premium Feature</h3>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.5 }}>Instagram URL extraction requires a paid plan.<br/>Upgrade to import any Instagram recipe in seconds.</p>
                    <a href="/pricing" style={{ display: 'inline-flex', alignItems: 'center', height: 38, padding: '0 20px', borderRadius: 10, background: '#3b82f6', color: '#fff', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
                      View Plans
                    </a>
                  </div>
                ) : (
                  <form id="url-form" onSubmit={handleUrlSubmit} className="space-y-3">
                    <div className="rounded-xl p-4 text-sm" style={{ background: '#eef2ff', border: '1px solid #c7d2fe', color: '#4338ca' }}>Paste an Instagram post URL with a recipe in the caption.</div>
                    <input required type="url" value={aiUrl} onChange={e => setAiUrl(e.target.value)} placeholder="https://www.instagram.com/p/..." style={inp}
                      onFocus={e => e.currentTarget.style.borderColor = '#191c1f'}
                      onBlur={e => e.currentTarget.style.borderColor = '#e2e2e7'} />
                  </form>
                )
              )}
            </div>
            <div className="px-6 py-4 flex gap-2" style={{ borderTop: '1px solid var(--border-soft)' }}>
              <button onClick={() => setShowAdd(false)} className="flex-1 text-sm font-medium" style={{ height: 40, borderRadius: 10, border: '1px solid var(--border-color)', color: 'var(--text-secondary)', background: 'var(--bg-card)' }}>Cancel</button>
              {!(isPremiumLocked && (tab === 'ai' || tab === 'url')) && (
                <button type="submit"
                  form={tab === 'manual' ? 'manual-form' : tab === 'packaged' ? 'pkg-form' : tab === 'ai' ? 'ai-form' : 'url-form'}
                  disabled={saving || scanning}
                  className="flex-1 text-sm font-semibold text-white disabled:opacity-40"
                  style={{ height: 40, borderRadius: 10, background: tab === 'ai' ? '#3b82f6' : '#191c1f' }}>
                  {saving ? 'Saving…' : editingRecipe ? 'Save changes' : tab === 'manual' ? 'Save recipe' : tab === 'packaged' ? 'Save item' : 'Extract recipe'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
