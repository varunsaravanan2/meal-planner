'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getProfile, saveProfile, generateMealPlan } from '@/lib/api';
import type { UserProfile } from '@/types';

// ── Option sets ───────────────────────────────────────────────────────────────

const GOALS:      [string, string][] = [['lose_weight','Lose weight'],['maintain','Maintain'],['build_muscle','Build muscle'],['eat_healthier','Eat healthier'],['improve_performance','Improve performance']];
const TIMELINES:  [string, string][] = [['no_rush','No rush'],['3_months','3 months'],['6_months','6 months']];
const ACTIVITY:   [string, string][] = [['sedentary','Sedentary'],['lightly_active','Lightly active'],['moderately_active','Moderately active'],['very_active','Very active']];
const FITNESS:    [string, string][] = [['beginner','Beginner'],['intermediate','Intermediate'],['advanced','Advanced']];
const EQUIPMENT:  [string, string][] = [['none','Bodyweight only'],['dumbbells','Dumbbells'],['barbell','Barbell + rack'],['home_gym','Home gym'],['gym_membership','Full gym']];
const WTYPES:     [string, string][] = [['strength','Strength'],['cardio','Cardio'],['hiit','HIIT'],['yoga','Yoga'],['running','Running'],['cycling','Cycling'],['pilates','Pilates']];
const DIETS:      [string, string][] = [['omnivore','Omnivore'],['vegetarian','Vegetarian'],['vegan','Vegan'],['pescatarian','Pescatarian'],['keto','Keto'],['paleo','Paleo'],['gluten_free','Gluten-free']];
const ALLERGIES:  [string, string][] = [['none','None'],['nuts','Nuts'],['gluten','Gluten'],['dairy','Dairy'],['eggs','Eggs'],['shellfish','Shellfish'],['soy','Soy'],['fish','Fish']];
const CUISINES:   [string, string][] = [['italian','Italian'],['asian','Asian'],['mexican','Mexican'],['mediterranean','Mediterranean'],['american','American'],['indian','Indian'],['middle_eastern','Middle Eastern'],['japanese','Japanese'],['thai','Thai']];
const COOK_TIMES: [string, string][] = [['<15','< 15 min'],['15-30','15–30 min'],['30-60','30–60 min'],['60+','60+ min']];
const COOKING_SKILL: [string, string][] = [['beginner','Beginner'],['intermediate','Intermediate'],['advanced','Advanced']];

// ── Form type ─────────────────────────────────────────────────────────────────

type ProfileForm = {
  age: string; sex: string; height_ft: string; height_in: string;
  weight_lbs: string; target_weight_lbs: string;
  primary_goal: string; timeline: string;
  activity_level: string; fitness_level: string; workouts_per_week: string;
  equipment: string[]; workout_types: string[]; injuries: string;
  diet_type: string; allergies: string[]; cuisine_preferences: string[]; disliked_foods: string;
  cooking_skill: string; max_cook_time: string; weekly_budget: string;
};

const EMPTY: ProfileForm = {
  age: '', sex: '', height_ft: '', height_in: '', weight_lbs: '', target_weight_lbs: '',
  primary_goal: '', timeline: '',
  activity_level: '', fitness_level: '', workouts_per_week: '', equipment: [], workout_types: [], injuries: '',
  diet_type: '', allergies: [], cuisine_preferences: [], disliked_foods: '',
  cooking_skill: '', max_cook_time: '', weekly_budget: '',
};

// ── Shared input style ────────────────────────────────────────────────────────

const BASE_INPUT: React.CSSProperties = {
  width: '100%', height: 38, padding: '0 12px',
  border: '1.5px solid var(--border-color)', borderRadius: 9,
  color: 'var(--text-primary)', background: 'var(--bg-input)',
  fontSize: 13, outline: 'none', boxSizing: 'border-box',
};

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
      <h2 style={{
        fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em',
        color: 'var(--text-secondary)', margin: 0, whiteSpace: 'nowrap',
      }}>{children}</h2>
      <div style={{ flex: 1, height: 1, background: 'var(--border-soft)' }} />
    </div>
  );
}

function Field({
  label, hint, optional, children,
}: { label: string; hint?: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <label style={{
          fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.07em', color: 'var(--text-tertiary)',
        }}>
          {label}
          {optional && <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, marginLeft: 5, color: 'var(--text-placeholder)', fontSize: 11 }}>optional</span>}
        </label>
        {hint && <span style={{ fontSize: 11, color: 'var(--text-placeholder)' }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function TextInput({
  value, onChange, placeholder, numeric, after,
}: { value: string | number | null; onChange: (v: string) => void; placeholder: string; numeric?: boolean; after?: string }) {
  return (
    <div style={{ position: 'relative' }}>
      <input
        type="text" inputMode={numeric ? 'numeric' : 'text'}
        value={value ?? ''} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        style={{ ...BASE_INPUT, paddingRight: after ? 36 : 12 }}
        onFocus={e => e.currentTarget.style.borderColor = '#3b82f6'}
        onBlur={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
      />
      {after && (
        <span style={{
          position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)',
          fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', pointerEvents: 'none',
        }}>{after}</span>
      )}
    </div>
  );
}

function HeightInput({
  ft, inches, onFtChange, onInChange,
}: { ft: string; inches: string; onFtChange: (v: string) => void; onInChange: (v: string) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      <div style={{ position: 'relative' }}>
        <input
          type="text" inputMode="numeric" value={ft} placeholder="5"
          onChange={e => onFtChange(e.target.value)}
          style={{ ...BASE_INPUT, paddingRight: 32 }}
          onFocus={e => e.currentTarget.style.borderColor = '#3b82f6'}
          onBlur={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
        />
        <span style={{
          position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
          fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', pointerEvents: 'none',
        }}>ft</span>
      </div>
      <div style={{ position: 'relative' }}>
        <input
          type="text" inputMode="numeric" value={inches} placeholder="10"
          onChange={e => onInChange(e.target.value)}
          style={{ ...BASE_INPUT, paddingRight: 32 }}
          onFocus={e => e.currentTarget.style.borderColor = '#3b82f6'}
          onBlur={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
        />
        <span style={{
          position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
          fontSize: 12, fontWeight: 700, color: 'var(--text-tertiary)', pointerEvents: 'none',
        }}>in</span>
      </div>
    </div>
  );
}

function Radio({ options, value, onChange }: { options: [string, string][]; value: string | null; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
      {options.map(([v, label]) => (
        <button key={v} type="button" onClick={() => onChange(v)}
          style={{
            padding: '6px 13px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            cursor: 'pointer', transition: 'all 0.15s', border: '1.5px solid',
            ...(value === v
              ? { background: '#3b82f6', color: '#fff', borderColor: '#3b82f6' }
              : { background: 'var(--bg-card)', color: 'var(--text-secondary)', borderColor: 'var(--border-color)' }),
          }}>
          {label}
        </button>
      ))}
    </div>
  );
}

function Chips({
  options, value, onChange, label,
}: { options: [string, string][]; value: string[] | null | undefined; onChange: (v: string[]) => void; label?: string }) {
  const safe = value ?? [];
  const selectedCount = safe.length;

  function toggle(v: string) {
    onChange(safe.includes(v) ? safe.filter(x => x !== v) : [...safe, v]);
  }

  return (
    <div>
      {selectedCount > 1 && (
        <p style={{ fontSize: 11, color: 'var(--text-placeholder)', marginBottom: 7, marginTop: 0 }}>
          {selectedCount} selected
        </p>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
        {options.map(([v, lbl]) => (
          <button key={v} type="button" onClick={() => toggle(v)}
            style={{
              padding: '6px 13px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.15s', border: '1.5px solid',
              ...(safe.includes(v)
                ? { background: '#3b82f6', color: '#fff', borderColor: '#3b82f6' }
                : { background: 'var(--bg-card)', color: 'var(--text-secondary)', borderColor: 'var(--border-color)' }),
            }}>
            {lbl}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Profile summary card ──────────────────────────────────────────────────────

function ProfileSummary({ form, lastUpdated }: { form: ProfileForm; lastUpdated: string | null }) {
  const hasData = !!(form.primary_goal || form.weight_lbs || form.diet_type);
  if (!hasData) return null;

  const goal = GOALS.find(([v]) => v === form.primary_goal)?.[1] ?? '—';
  const diet = DIETS.find(([v]) => v === form.diet_type)?.[1] ?? '—';
  const updated = lastUpdated
    ? new Date(lastUpdated).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Not saved';

  const items: [string, string][] = [
    ['Goal',        goal],
    ['Weight',      form.weight_lbs ? `${form.weight_lbs} lbs` : '—'],
    ['Target',      form.target_weight_lbs ? `${form.target_weight_lbs} lbs` : '—'],
    ['Workouts',    form.workouts_per_week ? `${form.workouts_per_week}×/week` : '—'],
    ['Diet',        diet],
    ['Last saved',  updated],
  ];

  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border-color)',
      padding: '16px 20px', marginBottom: 18,
    }}>
      <p style={{
        fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
        color: 'var(--text-tertiary)', margin: '0 0 14px',
      }}>Current Profile</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px 0' }}>
        {items.map(([label, value]) => (
          <div key={label}>
            <p style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-placeholder)', margin: '0 0 2px' }}>{label}</p>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const router = useRouter();
  const [form, setForm] = useState<ProfileForm>(EMPTY);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getProfile().then(p => {
      if (!p) return;
      setForm(f => ({ ...f, ...(p as unknown as ProfileForm) }));
      const ua = (p as unknown as { updated_at?: string }).updated_at;
      if (ua) setLastUpdated(ua);
    }).catch(() => {});
  }, []);

  function set<K extends keyof ProfileForm>(k: K, v: ProfileForm[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  async function handleSave(e?: React.FormEvent) {
    e?.preventDefault();
    setSaving(true); setSaved(false); setError('');
    try {
      await saveProfile(form as unknown as Partial<UserProfile>);
      setSaved(true);
      setLastUpdated(new Date().toISOString());
      setTimeout(() => setSaved(false), 3000);
    } catch (err) { setError((err as Error).message); }
    finally { setSaving(false); }
  }

  async function handleSaveAndGenerate() {
    setSaving(true); setError('');
    try {
      await saveProfile(form as unknown as Partial<UserProfile>);
      setLastUpdated(new Date().toISOString());
      setGenerating(true);
      const result = await generateMealPlan();
      router.push(`/dashboard?generated=${result.meals_created}`);
    } catch (err) { setError((err as Error).message || 'Generation failed'); }
    finally { setSaving(false); setGenerating(false); }
  }

  const busy = saving || generating;
  const card: React.CSSProperties = {
    background: 'var(--bg-card)', borderRadius: 14,
    boxShadow: 'var(--shadow-card)', padding: '20px 22px',
  };

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '28px 20px 48px' }}>

      {/* Header */}
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.4px' }}>
          Profile Settings
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 5, marginBottom: 0 }}>
          Personalizes your meal plan, nutrition targets, and workout suggestions.
        </p>
      </div>

      {/* Summary card */}
      <ProfileSummary form={form} lastUpdated={lastUpdated} />

      {/* Error */}
      {error && (
        <div style={{
          marginBottom: 16, fontSize: 13, padding: '10px 14px', borderRadius: 10,
          color: '#e23b4a', background: 'rgba(226,59,74,0.06)', border: '1px solid rgba(226,59,74,0.2)',
        }}>{error}</div>
      )}

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* ── Personal ── */}
        <div style={card}>
          <SectionTitle>Personal</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
            <Field label="Age" hint="years">
              <TextInput numeric value={form.age} onChange={v => set('age', v)} placeholder="25" />
            </Field>
            <Field label="Sex">
              <Radio options={[['male','Male'],['female','Female'],['other','Other']]} value={form.sex} onChange={v => set('sex', v)} />
            </Field>
          </div>
          <Field label="Height">
            <HeightInput
              ft={form.height_ft} inches={form.height_in}
              onFtChange={v => set('height_ft', v)} onInChange={v => set('height_in', v)}
            />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
            <Field label="Weight" hint="lbs · 80–400">
              <TextInput numeric value={form.weight_lbs} onChange={v => set('weight_lbs', v)} placeholder="170" after="lbs" />
            </Field>
            <Field label="Target weight" hint="lbs">
              <TextInput numeric value={form.target_weight_lbs} onChange={v => set('target_weight_lbs', v)} placeholder="160" after="lbs" />
            </Field>
          </div>
        </div>

        {/* ── Goals ── */}
        <div style={card}>
          <SectionTitle>Goals</SectionTitle>
          <Field label="Primary goal">
            <Radio options={GOALS} value={form.primary_goal} onChange={v => set('primary_goal', v)} />
          </Field>
          <Field label="Timeline">
            <Radio options={TIMELINES} value={form.timeline} onChange={v => set('timeline', v)} />
          </Field>
        </div>

        {/* ── Activity & Fitness ── */}
        <div style={card}>
          <SectionTitle>Activity & Fitness</SectionTitle>
          <Field label="Activity level">
            <Radio options={ACTIVITY} value={form.activity_level} onChange={v => set('activity_level', v)} />
          </Field>
          <Field label="Fitness level">
            <Radio options={FITNESS} value={form.fitness_level} onChange={v => set('fitness_level', v)} />
          </Field>
          <Field label="Workouts per week" hint="1–7">
            <TextInput numeric value={form.workouts_per_week} onChange={v => set('workouts_per_week', v)} placeholder="3" after="days" />
          </Field>
          <Field label="Equipment available">
            <Chips options={EQUIPMENT} value={form.equipment} onChange={v => set('equipment', v)} />
          </Field>
          <Field label="Workout types">
            <Chips options={WTYPES} value={form.workout_types} onChange={v => set('workout_types', v)} />
          </Field>
          <Field label="Injuries or limitations" optional>
            <TextInput value={form.injuries} onChange={v => set('injuries', v)} placeholder="e.g. bad knees, lower back pain" />
          </Field>
        </div>

        {/* ── Diet ── */}
        <div style={card}>
          <SectionTitle>Diet</SectionTitle>
          <Field label="Diet type">
            <Chips
              options={DIETS}
              value={form.diet_type ? [form.diet_type] : []}
              onChange={v => set('diet_type', v[v.length - 1] || '')}
            />
          </Field>
          <Field label="Allergies & intolerances">
            <Chips
              options={ALLERGIES}
              value={form.allergies}
              onChange={v => {
                const last = v[v.length - 1];
                set('allergies', last === 'none' ? ['none'] : v.filter(x => x !== 'none'));
              }}
            />
          </Field>
          <Field label="Cuisine preferences">
            <Chips options={CUISINES} value={form.cuisine_preferences} onChange={v => set('cuisine_preferences', v)} />
          </Field>
          <Field label="Foods you dislike" optional>
            <TextInput value={form.disliked_foods} onChange={v => set('disliked_foods', v)} placeholder="e.g. olives, blue cheese, cilantro" />
          </Field>
        </div>

        {/* ── Cooking ── */}
        <div style={card}>
          <SectionTitle>Cooking</SectionTitle>
          <Field label="Cooking skill">
            <Radio options={COOKING_SKILL} value={form.cooking_skill} onChange={v => set('cooking_skill', v)} />
          </Field>
          <Field label="Max time to cook">
            <Radio options={COOK_TIMES} value={form.max_cook_time} onChange={v => set('max_cook_time', v)} />
          </Field>
          <Field label="Weekly food budget" optional hint="per week">
            <TextInput numeric value={form.weekly_budget} onChange={v => set('weekly_budget', v)} placeholder="100" after="$" />
          </Field>
        </div>

        {/* ── Bottom CTA ── */}
        <div style={{
          background: 'var(--bg-card)', borderRadius: 14,
          boxShadow: 'var(--shadow-card)', padding: '18px 22px',
        }}>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '0 0 14px', lineHeight: 1.5 }}>
            Changes will affect future meal plans and workouts. Existing plans are not modified.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="submit"
              disabled={busy}
              style={{
                flex: 1, minWidth: 140, height: 40, borderRadius: 10, border: '1.5px solid var(--border-color)',
                background: saved ? 'rgba(34,197,94,0.08)' : 'var(--bg-soft)',
                color: saved ? '#22c55e' : 'var(--text-primary)',
                fontWeight: 600, fontSize: 13, cursor: busy ? 'not-allowed' : 'pointer',
                opacity: busy && !saved ? 0.65 : 1, transition: 'all 0.15s',
              }}
            >
              {saving && !generating ? 'Saving…' : saved ? '✓ Saved' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={handleSaveAndGenerate}
              disabled={busy}
              style={{
                flex: 1, minWidth: 200, height: 40, borderRadius: 10, border: 'none',
                background: '#191c1f',
                color: '#fff',
                fontWeight: 600, fontSize: 13, cursor: busy ? 'not-allowed' : 'pointer',
                opacity: busy ? 0.65 : 1, transition: 'opacity 0.15s',
              }}
            >
              {generating ? 'Generating plan…' : 'Save & Regenerate Plan'}
            </button>
          </div>
        </div>

      </form>
    </div>
  );
}
