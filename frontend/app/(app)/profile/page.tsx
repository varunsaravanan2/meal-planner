'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getProfile, saveProfile, generateMealPlan } from '@/lib/api';
import type { UserProfile } from '@/types';

const GOALS:      [string, string][] = [['lose_weight','Lose weight'],['maintain','Maintain'],['build_muscle','Build muscle'],['eat_healthier','Eat healthier'],['improve_performance','Improve performance']];
const TIMELINES:  [string, string][] = [['no_rush','No rush'],['3_months','3 months'],['6_months','6 months']];
const ACTIVITY:   [string, string][] = [['sedentary','Sedentary'],['lightly_active','Lightly active'],['moderately_active','Moderately active'],['very_active','Very active']];
const FITNESS:    [string, string][] = [['beginner','Beginner'],['intermediate','Intermediate'],['advanced','Advanced']];
const EQUIPMENT:  [string, string][] = [['none','Bodyweight only'],['dumbbells','Dumbbells'],['barbell','Barbell + rack'],['home_gym','Home gym'],['gym_membership','Gym membership']];
const WTYPES:     [string, string][] = [['strength','Strength'],['cardio','Cardio'],['hiit','HIIT'],['yoga','Yoga'],['running','Running']];
const DIETS:      [string, string][] = [['omnivore','Omnivore'],['vegetarian','Vegetarian'],['vegan','Vegan'],['pescatarian','Pescatarian'],['keto','Keto'],['paleo','Paleo']];
const ALLERGIES:  [string, string][] = [['none','None'],['nuts','Nuts'],['gluten','Gluten'],['dairy','Dairy'],['eggs','Eggs'],['shellfish','Shellfish'],['soy','Soy']];
const CUISINES:   [string, string][] = [['italian','Italian'],['asian','Asian'],['mexican','Mexican'],['mediterranean','Mediterranean'],['american','American'],['indian','Indian']];
const COOK_TIMES: [string, string][] = [['<15','< 15 min'],['15-30','15–30 min'],['30-60','30–60 min'],['60+','60+ min']];

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: '#8d969e' }}>{children}</h2>
      <div className="flex-1 h-px" style={{ background: '#f0f0f2' }} />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#8d969e' }}>{label}</label>
      {children}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, numeric }: { value: string | number | null; onChange: (v: string) => void; placeholder: string; numeric?: boolean }) {
  return (
    <input
      type="text" inputMode={numeric ? 'numeric' : 'text'}
      value={value ?? ''} placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      className="w-full text-sm focus:outline-none"
      style={{ height: 44, padding: '0 14px', border: '1.5px solid #e2e2e7', borderRadius: 10, color: '#191c1f', background: '#fff' }}
      onFocus={e => e.currentTarget.style.borderColor = '#494fdf'}
      onBlur={e => e.currentTarget.style.borderColor = '#e2e2e7'}
    />
  );
}

function Radio({ options, value, onChange }: { options: [string, string][]; value: string | null; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([v, label]) => (
        <button key={v} type="button" onClick={() => onChange(v)}
          className="px-3.5 py-2 rounded-xl text-sm font-semibold transition-all"
          style={value === v
            ? { background: '#191c1f', color: '#fff', border: '1.5px solid #191c1f' }
            : { background: '#fff', color: '#505a63', border: '1.5px solid #e2e2e7' }}>
          {label}
        </button>
      ))}
    </div>
  );
}

function Chips({ options, value = [], onChange }: { options: [string, string][]; value: string[]; onChange: (v: string[]) => void }) {
  function toggle(v: string) {
    onChange(value.includes(v) ? value.filter(x => x !== v) : [...value, v]);
  }
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([v, label]) => (
        <button key={v} type="button" onClick={() => toggle(v)}
          className="px-3.5 py-2 rounded-xl text-sm font-semibold transition-all"
          style={value.includes(v)
            ? { background: '#494fdf', color: '#fff', border: '1.5px solid #494fdf' }
            : { background: '#fff', color: '#505a63', border: '1.5px solid #e2e2e7' }}>
          {label}
        </button>
      ))}
    </div>
  );
}

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

export default function ProfilePage() {
  const router = useRouter();
  const [form, setForm] = useState<ProfileForm>(EMPTY);
  const [saving, setSaving] = useState<boolean>(false);
  const [saved, setSaved] = useState<boolean>(false);
  const [generating, setGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    getProfile().then(p => {
      if (p) setForm(f => ({ ...f, ...(p as unknown as ProfileForm) }));
    }).catch(() => {});
  }, []);

  function set<K extends keyof ProfileForm>(k: K, v: ProfileForm[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setSaved(false); setError('');
    try {
      await saveProfile(form as unknown as Partial<UserProfile>);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) { setError((err as Error).message); }
    finally { setSaving(false); }
  }

  async function handleGenerate() {
    setGenerating(true); setError('');
    try {
      const result = await generateMealPlan();
      router.push(`/dashboard?generated=${result.meals_created}`);
    } catch (err) { setError((err as Error).message || 'Generation failed'); }
    finally { setGenerating(false); }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black" style={{ color: '#191c1f', letterSpacing: '-0.5px' }}>Profile settings</h1>
          <p className="text-sm mt-1" style={{ color: '#8d969e' }}>Personalizes your meal plan and workouts.</p>
        </div>
        <button type="button" onClick={handleGenerate} disabled={generating || saving}
          className="flex items-center gap-2 font-semibold text-white disabled:opacity-50 text-sm px-4"
          style={{ height: 40, borderRadius: 10, background: '#494fdf', whiteSpace: 'nowrap' }}>
          {generating ? 'Generating…' : '✦ Regenerate plan'}
        </button>
      </div>

      {error && (
        <div className="mb-5 text-sm px-4 py-3 rounded-xl" style={{ color: '#e23b4a', background: '#fff1f2', border: '1px solid #fecdd3' }}>{error}</div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e8e8ec', padding: '24px 28px' }}>
          <SectionTitle>Personal</SectionTitle>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Age"><TextInput numeric value={form.age} onChange={v => set('age', v)} placeholder="25" /></Field>
            <Field label="Sex"><Radio options={[['male','Male'],['female','Female'],['other','Other']]} value={form.sex} onChange={v => set('sex', v)} /></Field>
          </div>
          <Field label="Height">
            <div className="flex items-center gap-2">
              <TextInput numeric value={form.height_ft} onChange={v => set('height_ft', v)} placeholder="5" />
              <span className="text-sm font-medium shrink-0" style={{ color: '#8d969e' }}>ft</span>
              <TextInput numeric value={form.height_in} onChange={v => set('height_in', v)} placeholder="10" />
              <span className="text-sm font-medium shrink-0" style={{ color: '#8d969e' }}>in</span>
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Weight (lbs)"><TextInput numeric value={form.weight_lbs} onChange={v => set('weight_lbs', v)} placeholder="170" /></Field>
            <Field label="Target weight (lbs)"><TextInput numeric value={form.target_weight_lbs} onChange={v => set('target_weight_lbs', v)} placeholder="160" /></Field>
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e8e8ec', padding: '24px 28px' }}>
          <SectionTitle>Goals</SectionTitle>
          <Field label="Primary goal"><Radio options={GOALS} value={form.primary_goal} onChange={v => set('primary_goal', v)} /></Field>
          <Field label="Timeline"><Radio options={TIMELINES} value={form.timeline} onChange={v => set('timeline', v)} /></Field>
        </div>

        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e8e8ec', padding: '24px 28px' }}>
          <SectionTitle>Activity & Fitness</SectionTitle>
          <Field label="Activity level"><Radio options={ACTIVITY} value={form.activity_level} onChange={v => set('activity_level', v)} /></Field>
          <Field label="Fitness level"><Radio options={FITNESS} value={form.fitness_level} onChange={v => set('fitness_level', v)} /></Field>
          <Field label="Workouts per week"><TextInput numeric value={form.workouts_per_week} onChange={v => set('workouts_per_week', v)} placeholder="3" /></Field>
          <Field label="Equipment available"><Chips options={EQUIPMENT} value={form.equipment} onChange={v => set('equipment', v)} /></Field>
          <Field label="Workout types"><Chips options={WTYPES} value={form.workout_types} onChange={v => set('workout_types', v)} /></Field>
          <Field label="Injuries or limitations (optional)"><TextInput value={form.injuries} onChange={v => set('injuries', v)} placeholder="e.g. bad knees, lower back" /></Field>
        </div>

        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e8e8ec', padding: '24px 28px' }}>
          <SectionTitle>Diet</SectionTitle>
          <Field label="Diet type">
            <Chips options={DIETS} value={form.diet_type ? [form.diet_type] : []} onChange={v => set('diet_type', v[v.length - 1] || '')} />
          </Field>
          <Field label="Allergies">
            <Chips options={ALLERGIES} value={form.allergies}
              onChange={v => {
                const last = v[v.length - 1];
                set('allergies', last === 'none' ? ['none'] : v.filter(x => x !== 'none'));
              }} />
          </Field>
          <Field label="Cuisine preferences"><Chips options={CUISINES} value={form.cuisine_preferences} onChange={v => set('cuisine_preferences', v)} /></Field>
          <Field label="Foods you dislike (optional)"><TextInput value={form.disliked_foods} onChange={v => set('disliked_foods', v)} placeholder="e.g. olives, blue cheese" /></Field>
        </div>

        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e8e8ec', padding: '24px 28px' }}>
          <SectionTitle>Cooking</SectionTitle>
          <Field label="Cooking skill"><Radio options={FITNESS} value={form.cooking_skill} onChange={v => set('cooking_skill', v)} /></Field>
          <Field label="Max time to cook"><Radio options={COOK_TIMES} value={form.max_cook_time} onChange={v => set('max_cook_time', v)} /></Field>
          <Field label="Weekly food budget (optional)"><TextInput numeric value={form.weekly_budget} onChange={v => set('weekly_budget', v)} placeholder="100" /></Field>
        </div>

        <button type="submit" disabled={saving || generating}
          className="w-full font-bold text-white disabled:opacity-50"
          style={{ height: 52, borderRadius: 12, background: '#191c1f', fontSize: 15 }}>
          {saving ? 'Saving…' : saved ? 'Saved!' : 'Save changes'}
        </button>
      </form>
      <div className="h-10" />
    </div>
  );
}
