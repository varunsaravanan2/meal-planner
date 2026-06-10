'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveProfile, generateMealPlan } from '@/lib/api';

const STEPS = [
  { title: "What's your main goal?",    sub: "We'll build your meal and workout plan around this." },
  { title: "Tell us about yourself",     sub: "Used to calculate your daily calorie targets." },
  { title: "How active are you?",        sub: "Be honest — we'll calibrate your plan to match." },
  { title: "How do you train?",          sub: "We'll design workouts around what you have." },
  { title: "Your diet preferences",      sub: "We'll only suggest meals you'll actually eat." },
  { title: "In the kitchen",            sub: "So we don't recommend 2-hour recipes on a weeknight." },
];

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

const INPUT: React.CSSProperties = {
  height: 52, padding: '0 16px', background: '#141414',
  border: '1.5px solid #252525', borderRadius: 12,
  color: '#fff', fontSize: 15, width: '100%', outline: 'none', boxSizing: 'border-box',
};

interface RadioProps { options: [string, string][]; value: string; onChange: (v: string) => void; }
function Radio({ options, value, onChange }: RadioProps) {
  return (
    <div className="flex flex-col gap-2">
      {options.map(([v, label]) => (
        <button key={v} type="button" onClick={() => onChange(v)}
          className="text-left px-5 py-4 rounded-2xl font-semibold text-base transition-all"
          style={value === v
            ? { background: '#494fdf', color: '#fff', border: '1.5px solid #494fdf' }
            : { background: '#141414', color: 'rgba(255,255,255,0.7)', border: '1.5px solid #252525' }}>
          {label}
        </button>
      ))}
    </div>
  );
}

interface ChipsProps { options: [string, string][]; value: string[]; onChange: (v: string[]) => void; exclusive?: string; }
function Chips({ options, value = [], onChange, exclusive }: ChipsProps) {
  function toggle(v: string) {
    if (exclusive === v) { onChange([v]); return; }
    const next = value.includes(v) ? value.filter(x => x !== v) : [...value.filter(x => x !== exclusive), v];
    onChange(next);
  }
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([v, label]) => (
        <button key={v} type="button" onClick={() => toggle(v)}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={value.includes(v)
            ? { background: '#494fdf', color: '#fff', border: '1.5px solid #494fdf' }
            : { background: '#141414', color: 'rgba(255,255,255,0.6)', border: '1.5px solid #252525' }}>
          {label}
        </button>
      ))}
    </div>
  );
}

interface TextInputProps { value: string; onChange: (v: string) => void; placeholder: string; numeric?: boolean; }
function TextInput({ value, onChange, placeholder, numeric }: TextInputProps) {
  return (
    <input
      type="text" inputMode={numeric ? 'numeric' : 'text'}
      value={value ?? ''} placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      style={INPUT}
      onFocus={e => e.currentTarget.style.borderColor = '#494fdf'}
      onBlur={e => e.currentTarget.style.borderColor = '#252525'}
    />
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.35)' }}>{children}</p>;
}

interface OnboardingForm {
  primary_goal: string; timeline: string;
  age: string; sex: string; height_ft: string; height_in: string; weight_lbs: string; target_weight_lbs: string;
  activity_level: string; fitness_level: string; workouts_per_week: string;
  equipment: string[]; workout_types: string[]; injuries: string;
  diet_type: string; allergies: string[]; cuisine_preferences: string[]; disliked_foods: string;
  cooking_skill: string; max_cook_time: string; weekly_budget: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<number>(0);
  const [saving, setSaving] = useState<boolean>(false);
  const [generating, setGenerating] = useState<boolean>(false);
  const [done, setDone] = useState<boolean>(false);
  const [form, setForm] = useState<OnboardingForm>({
    primary_goal: '', timeline: '',
    age: '', sex: '', height_ft: '', height_in: '', weight_lbs: '', target_weight_lbs: '',
    activity_level: '', fitness_level: '', workouts_per_week: '',
    equipment: [], workout_types: [], injuries: '',
    diet_type: '', allergies: [], cuisine_preferences: [], disliked_foods: '',
    cooking_skill: '', max_cook_time: '', weekly_budget: '',
  });

  function set<K extends keyof OnboardingForm>(k: K, v: OnboardingForm[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  async function handleContinue() {
    if (step < STEPS.length - 1) { setStep(s => s + 1); return; }
    setSaving(true);
    try { await saveProfile(form as any); setDone(true); }
    catch {}
    finally { setSaving(false); }
  }

  async function handleGenerate() {
    setGenerating(true);
    try { await generateMealPlan(); router.push('/dashboard'); }
    catch { router.push('/dashboard'); }
  }

  const progress = ((step + 1) / STEPS.length) * 100;

  if (done) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8" style={{ background: '#0a0a0a' }}>
        <div className="w-full max-w-md text-center">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: '#1a1a2e', border: '2px solid #494fdf' }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#494fdf" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <h1 className="text-4xl font-black mb-3" style={{ color: '#fff', letterSpacing: '-1px' }}>You're all set.</h1>
          <p className="text-base mb-10" style={{ color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
            Want us to generate a personalized meal and workout plan for this week right now?
          </p>
          <button onClick={handleGenerate} disabled={generating}
            className="w-full font-bold text-white mb-3 disabled:opacity-50"
            style={{ height: 56, borderRadius: 14, background: '#494fdf', fontSize: 16 }}>
            {generating ? 'Generating your plan…' : 'Generate my plan now →'}
          </button>
          <button onClick={() => router.push('/dashboard')}
            className="w-full font-semibold"
            style={{ height: 48, borderRadius: 14, background: 'transparent', color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>
            Skip for now
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0a0a0a' }}>
      <div className="flex items-center justify-between px-8 py-5">
        <div className="w-8 h-8 flex items-center justify-center rounded-lg font-black text-white text-base" style={{ background: '#494fdf' }}>M</div>
        <span className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.3)' }}>Step {step + 1} of {STEPS.length}</span>
      </div>

      <div className="w-full h-0.5" style={{ background: '#1a1a1a' }}>
        <div className="h-full transition-all duration-300" style={{ width: `${progress}%`, background: '#494fdf' }} />
      </div>

      <div className="flex-1 flex flex-col px-8 py-10 max-w-lg w-full mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-black mb-2" style={{ color: '#fff', letterSpacing: '-0.5px', lineHeight: 1.2 }}>{STEPS[step].title}</h1>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>{STEPS[step].sub}</p>
        </div>

        <div className="flex-1 space-y-5">
          {step === 0 && <>
            <div><Label>Primary goal</Label><Radio options={GOALS} value={form.primary_goal} onChange={v => set('primary_goal', v)} /></div>
            <div><Label>Timeline</Label><Radio options={TIMELINES} value={form.timeline} onChange={v => set('timeline', v)} /></div>
          </>}

          {step === 1 && <>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Age</Label><TextInput numeric value={form.age} onChange={v => set('age', v)} placeholder="25" /></div>
              <div>
                <Label>Sex</Label>
                <div className="flex gap-2">
                  {([['male','Male'],['female','Female'],['other','Other']] as [string,string][]).map(([v,l]) => (
                    <button key={v} type="button" onClick={() => set('sex', v)}
                      className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all"
                      style={form.sex === v ? { background: '#494fdf', color: '#fff', border: '1.5px solid #494fdf' } : { background: '#141414', color: 'rgba(255,255,255,0.6)', border: '1.5px solid #252525' }}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <Label>Height</Label>
              <div className="flex items-center gap-2">
                <TextInput numeric value={form.height_ft} onChange={v => set('height_ft', v)} placeholder="5" />
                <span className="text-sm font-semibold shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }}>ft</span>
                <TextInput numeric value={form.height_in} onChange={v => set('height_in', v)} placeholder="10" />
                <span className="text-sm font-semibold shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }}>in</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Weight (lbs)</Label><TextInput numeric value={form.weight_lbs} onChange={v => set('weight_lbs', v)} placeholder="170" /></div>
              <div><Label>Target weight (lbs)</Label><TextInput numeric value={form.target_weight_lbs} onChange={v => set('target_weight_lbs', v)} placeholder="160" /></div>
            </div>
          </>}

          {step === 2 && <>
            <div><Label>Activity level</Label><Radio options={ACTIVITY} value={form.activity_level} onChange={v => set('activity_level', v)} /></div>
            <div><Label>Fitness level</Label><Radio options={FITNESS} value={form.fitness_level} onChange={v => set('fitness_level', v)} /></div>
            <div><Label>Workouts per week</Label><TextInput numeric value={form.workouts_per_week} onChange={v => set('workouts_per_week', v)} placeholder="3" /></div>
          </>}

          {step === 3 && <>
            <div><Label>Equipment available</Label><Chips options={EQUIPMENT} value={form.equipment} exclusive="none" onChange={v => set('equipment', v)} /></div>
            <div><Label>Workout types</Label><Chips options={WTYPES} value={form.workout_types} onChange={v => set('workout_types', v)} /></div>
            <div><Label>Injuries or limitations (optional)</Label><TextInput value={form.injuries} onChange={v => set('injuries', v)} placeholder="e.g. bad knees, lower back" /></div>
          </>}

          {step === 4 && <>
            <div><Label>Diet type</Label>
              <Chips options={DIETS} value={form.diet_type ? [form.diet_type] : []}
                onChange={v => set('diet_type', v[v.length - 1] || '')} /></div>
            <div><Label>Allergies</Label>
              <Chips options={ALLERGIES} value={form.allergies} exclusive="none"
                onChange={v => {
                  const last = v[v.length - 1];
                  set('allergies', last === 'none' ? ['none'] : v.filter(x => x !== 'none'));
                }} /></div>
            <div><Label>Cuisine preferences</Label><Chips options={CUISINES} value={form.cuisine_preferences} onChange={v => set('cuisine_preferences', v)} /></div>
            <div><Label>Foods you dislike (optional)</Label><TextInput value={form.disliked_foods} onChange={v => set('disliked_foods', v)} placeholder="e.g. olives, blue cheese" /></div>
          </>}

          {step === 5 && <>
            <div><Label>Cooking skill</Label><Radio options={FITNESS} value={form.cooking_skill} onChange={v => set('cooking_skill', v)} /></div>
            <div><Label>Max time to cook</Label>
              <Chips options={COOK_TIMES} value={form.max_cook_time ? [form.max_cook_time] : []}
                onChange={v => set('max_cook_time', v[v.length - 1] || '')} /></div>
            <div><Label>Weekly food budget (optional)</Label><TextInput numeric value={form.weekly_budget} onChange={v => set('weekly_budget', v)} placeholder="$100" /></div>
          </>}
        </div>

        <div className="mt-10 flex flex-col gap-3">
          <button onClick={handleContinue} disabled={saving}
            className="w-full font-bold text-white disabled:opacity-50"
            style={{ height: 56, borderRadius: 14, background: '#494fdf', fontSize: 16 }}>
            {saving ? 'Saving…' : step === STEPS.length - 1 ? 'Finish →' : 'Continue →'}
          </button>
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)}
              className="w-full font-semibold"
              style={{ height: 44, borderRadius: 14, background: 'transparent', color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>
              Back
            </button>
          )}
          {step === 0 && (
            <button onClick={() => router.push('/dashboard')}
              className="w-full font-semibold"
              style={{ height: 44, borderRadius: 14, background: 'transparent', color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>
              Skip for now
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
