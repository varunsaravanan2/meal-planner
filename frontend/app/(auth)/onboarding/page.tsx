'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { saveProfile, generateMealPlan } from '@/lib/api';

const GEN_STEPS = [
  { label: 'Analyzing your profile',        duration: 3  },
  { label: 'Crafting your meal plan',        duration: 14 },
  { label: 'Planning your workouts',         duration: 8  },
  { label: 'Calculating nutrition targets',  duration: 4  },
  { label: 'Finalizing everything',          duration: 4  },
];
const TOTAL_SECONDS = GEN_STEPS.reduce((s, x) => s + x.duration, 0);

function GeneratingScreen() {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setElapsed(e => e + 0.1), 100);
    return () => clearInterval(id);
  }, []);

  let acc = 0;
  let activeStep = GEN_STEPS.length - 1;
  for (let i = 0; i < GEN_STEPS.length; i++) {
    if (elapsed < acc + GEN_STEPS[i].duration) { activeStep = i; break; }
    acc += GEN_STEPS[i].duration;
  }

  const progress = Math.min((elapsed / TOTAL_SECONDS) * 100, 96);
  const remaining = Math.max(0, Math.round(TOTAL_SECONDS - elapsed));

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8" style={{ background: '#0a0a0a' }}>
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-10">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full" style={{ background: '#494fdf22', animation: 'ping 1.5s cubic-bezier(0,0,0.2,1) infinite' }} />
            <div className="relative w-16 h-16 rounded-full flex items-center justify-center font-black text-white text-xl" style={{ background: '#494fdf' }}>M</div>
          </div>
        </div>
        <h1 className="text-2xl font-black text-center mb-1" style={{ color: '#fff', letterSpacing: '-0.5px' }}>Building your plan</h1>
        <p className="text-sm text-center mb-8" style={{ color: 'rgba(255,255,255,0.35)' }}>
          {remaining > 0 ? `About ${remaining}s remaining` : 'Almost done…'}
        </p>
        <div className="rounded-full overflow-hidden mb-8" style={{ height: 4, background: '#1a1a1a' }}>
          <div className="h-full rounded-full transition-all duration-100" style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #494fdf, #7c7fef)' }} />
        </div>
        <div className="space-y-3">
          {GEN_STEPS.map((s, i) => {
            let stepAcc = 0;
            for (let j = 0; j < i; j++) stepAcc += GEN_STEPS[j].duration;
            const done = elapsed >= stepAcc + s.duration;
            const active = i === activeStep;
            return (
              <div key={i} className="flex items-center gap-3">
                <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                  style={done
                    ? { background: '#494fdf', color: '#fff' }
                    : active
                      ? { background: '#1a1a2e', border: '2px solid #494fdf', color: '#494fdf' }
                      : { background: '#111', border: '1px solid #222', color: '#333' }}>
                  {done ? '✓' : active ? <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', fontSize: 11 }}>◌</span> : ''}
                </span>
                <span className="text-sm font-medium transition-all" style={{ color: done ? 'rgba(255,255,255,0.7)' : active ? '#fff' : 'rgba(255,255,255,0.2)' }}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <style>{`
        @keyframes ping { 75%, 100% { transform: scale(2); opacity: 0; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

const STEPS = [
  { title: "What's your main goal?",   sub: "We'll build your meal and workout plan around this." },
  { title: "Tell us about yourself",   sub: "Used to calculate your daily calorie and macro targets." },
  { title: "Food & fitness basics",    sub: "The essentials — you can add more detail in your profile anytime." },
];

const GOALS:     [string, string][] = [['lose_weight','Lose weight'],['maintain','Maintain'],['build_muscle','Build muscle'],['eat_healthier','Eat healthier'],['improve_performance','Improve performance']];
const TIMELINES: [string, string][] = [['no_rush','No rush'],['3_months','3 months'],['6_months','6 months']];
const ACTIVITY:  [string, string][] = [['sedentary','Sedentary'],['lightly_active','Lightly active'],['moderately_active','Moderately active'],['very_active','Very active']];
const DIETS:     [string, string][] = [['omnivore','Omnivore'],['vegetarian','Vegetarian'],['vegan','Vegan'],['pescatarian','Pescatarian'],['keto','Keto'],['paleo','Paleo']];
const ALLERGIES: [string, string][] = [['none','None'],['nuts','Nuts'],['gluten','Gluten'],['dairy','Dairy'],['eggs','Eggs'],['shellfish','Shellfish'],['soy','Soy']];
const EQUIPMENT: [string, string][] = [['none','Bodyweight only'],['dumbbells','Dumbbells'],['barbell','Barbell + rack'],['home_gym','Home gym'],['gym_membership','Gym membership']];
const COOK_TIMES:[string, string][] = [['<15','< 15 min'],['15-30','15–30 min'],['30-60','30–60 min'],['60+','60+ min']];

const INPUT: React.CSSProperties = {
  height: 58, padding: '0 18px', background: '#141414',
  border: '1.5px solid #252525', borderRadius: 14,
  color: '#fff', fontSize: 16, width: '100%', outline: 'none', boxSizing: 'border-box',
};

interface RadioProps { options: [string, string][]; value: string; onChange: (v: string) => void; }
function Radio({ options, value, onChange }: RadioProps) {
  return (
    <div className="flex flex-col gap-2">
      {options.map(([v, label]) => (
        <button key={v} type="button" onClick={() => onChange(v)}
          className="text-left px-5 py-4 rounded-2xl font-semibold text-base transition-all cursor-pointer"
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
  const safe = value ?? [];
  function toggle(v: string) {
    if (exclusive === v) { onChange([v]); return; }
    const next = safe.includes(v) ? safe.filter(x => x !== v) : [...safe.filter(x => x !== exclusive), v];
    onChange(next);
  }
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([v, label]) => (
        <button key={v} type="button" onClick={() => toggle(v)}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer"
          style={safe.includes(v)
            ? { background: '#494fdf', color: '#fff', border: '1.5px solid #494fdf' }
            : { background: '#141414', color: 'rgba(255,255,255,0.6)', border: '1.5px solid #252525' }}>
          {label}
        </button>
      ))}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, numeric }: { value: string; onChange: (v: string) => void; placeholder: string; numeric?: boolean }) {
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

function Label({ children, optional }: { children: React.ReactNode; optional?: boolean }) {
  return (
    <p className="text-sm font-semibold uppercase tracking-wider mb-2 flex items-center gap-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
      {children}
      {optional && <span className="normal-case font-normal text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>optional</span>}
    </p>
  );
}

interface OnboardingForm {
  primary_goal: string; timeline: string;
  age: string; sex: string; height_ft: string; height_in: string; weight_lbs: string;
  activity_level: string;
  diet_type: string; allergies: string[];
  equipment: string[]; max_cook_time: string;
}

function stepIsValid(step: number, form: OnboardingForm): boolean {
  switch (step) {
    case 0: return !!form.primary_goal;
    case 1: return !!form.age && !!form.sex && !!form.activity_level;
    case 2: return !!form.diet_type && form.allergies.length > 0 && form.equipment.length > 0;
    default: return true;
  }
}

function stepHint(step: number): string {
  switch (step) {
    case 0: return 'Select a goal to continue.';
    case 1: return 'Enter your age, select a sex, and pick your activity level.';
    case 2: return 'Select a diet type, an allergy option, and equipment.';
    default: return '';
  }
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<number>(0);
  const [saving, setSaving] = useState<boolean>(false);
  const [generating, setGenerating] = useState<boolean>(false);
  const [done, setDone] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string>('');
  const [showHint, setShowHint] = useState<boolean>(false);
  const [form, setForm] = useState<OnboardingForm>({
    primary_goal: '', timeline: '',
    age: '', sex: '', height_ft: '', height_in: '', weight_lbs: '',
    activity_level: '',
    diet_type: '', allergies: [],
    equipment: [], max_cook_time: '',
  });

  function set<K extends keyof OnboardingForm>(k: K, v: OnboardingForm[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  async function handleSkip() {
    try { await saveProfile({}); } catch {}
    router.push('/dashboard');
  }

  async function handleContinue() {
    if (!stepIsValid(step, form)) { setShowHint(true); return; }
    setShowHint(false);
    if (step < STEPS.length - 1) { setStep(s => s + 1); return; }
    setSaving(true); setSaveError('');
    try { await saveProfile(form as any); }
    catch (e) { setSaveError((e as Error).message || 'Could not save profile — you can update it later in settings.'); }
    finally { setSaving(false); }
    setDone(true);
  }

  async function handleGenerate() {
    setGenerating(true);
    try { await generateMealPlan(); }
    catch {}
    router.push('/dashboard');
  }

  const progress = ((step + 1) / STEPS.length) * 100;

  if (done && generating) return <GeneratingScreen />;

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
          {saveError ? (
            <p className="text-sm mb-6 px-4 py-3 rounded-xl" style={{ color: '#fca5a5', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>{saveError}</p>
          ) : (
            <p className="text-base mb-3" style={{ color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
              Want us to generate a personalized meal and workout plan for this week right now?
            </p>
          )}
          <p className="text-sm mb-8" style={{ color: 'rgba(255,255,255,0.25)' }}>
            You can add more preferences — cuisines, workout types, budget, and more — anytime from your Profile.
          </p>
          <button onClick={handleGenerate}
            className="w-full font-bold text-white mb-3 cursor-pointer"
            style={{ height: 62, borderRadius: 16, background: 'linear-gradient(135deg, #494fdf, #7c3aed)', border: 'none', fontSize: 17, boxShadow: '0 4px 16px rgba(99,102,241,0.35)' }}>
            Generate my plan now →
          </button>
          <button onClick={handleSkip}
            className="w-full font-semibold cursor-pointer"
            style={{ height: 54, borderRadius: 16, background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 15 }}>
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
        <div className="h-full transition-all duration-300" style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #494fdf, #7c7fef)' }} />
      </div>

      <div className="flex-1 flex flex-col px-8 py-10 max-w-lg w-full mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-black mb-2" style={{ color: '#fff', letterSpacing: '-0.5px', lineHeight: 1.2 }}>{STEPS[step].title}</h1>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>{STEPS[step].sub}</p>
        </div>

        <div className="flex-1 space-y-6">
          {step === 0 && <>
            <div>
              <Label>Primary goal</Label>
              <Radio options={GOALS} value={form.primary_goal} onChange={v => { set('primary_goal', v); setShowHint(false); }} />
            </div>
            <div>
              <Label optional>Timeline</Label>
              <div className="flex flex-wrap gap-2">
                {TIMELINES.map(([v, label]) => (
                  <button key={v} type="button" onClick={() => set('timeline', v)}
                    className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer"
                    style={form.timeline === v
                      ? { background: '#494fdf', color: '#fff', border: '1.5px solid #494fdf' }
                      : { background: '#141414', color: 'rgba(255,255,255,0.6)', border: '1.5px solid #252525' }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </>}

          {step === 1 && <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Age</Label>
                <TextInput numeric value={form.age} onChange={v => { set('age', v); setShowHint(false); }} placeholder="25" />
              </div>
              <div>
                <Label>Sex</Label>
                <div className="flex gap-2">
                  {([['male','Male'],['female','Female'],['other','Other']] as [string,string][]).map(([v,l]) => (
                    <button key={v} type="button" onClick={() => { set('sex', v); setShowHint(false); }}
                      className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer"
                      style={form.sex === v ? { background: '#494fdf', color: '#fff', border: '1.5px solid #494fdf' } : { background: '#141414', color: 'rgba(255,255,255,0.6)', border: '1.5px solid #252525' }}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <Label optional>Height</Label>
              <div className="flex items-center gap-2">
                <TextInput numeric value={form.height_ft} onChange={v => set('height_ft', v)} placeholder="5" />
                <span className="text-sm font-semibold shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }}>ft</span>
                <TextInput numeric value={form.height_in} onChange={v => set('height_in', v)} placeholder="10" />
                <span className="text-sm font-semibold shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }}>in</span>
              </div>
            </div>
            <div>
              <Label optional>Weight</Label>
              <div className="flex items-center gap-2">
                <TextInput numeric value={form.weight_lbs} onChange={v => set('weight_lbs', v)} placeholder="170" />
                <span className="text-sm font-semibold shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }}>lbs</span>
              </div>
            </div>
            <div>
              <Label>Activity level</Label>
              <div className="flex flex-col gap-2">
                {ACTIVITY.map(([v, label]) => (
                  <button key={v} type="button" onClick={() => { set('activity_level', v); setShowHint(false); }}
                    className="text-left px-5 py-3.5 rounded-2xl font-semibold text-sm transition-all cursor-pointer"
                    style={form.activity_level === v
                      ? { background: '#494fdf', color: '#fff', border: '1.5px solid #494fdf' }
                      : { background: '#141414', color: 'rgba(255,255,255,0.7)', border: '1.5px solid #252525' }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </>}

          {step === 2 && <>
            <div>
              <Label>Diet type</Label>
              <Chips options={DIETS} value={form.diet_type ? [form.diet_type] : []}
                onChange={v => { set('diet_type', v[v.length - 1] || ''); setShowHint(false); }} />
            </div>
            <div>
              <Label>Allergies</Label>
              <Chips options={ALLERGIES} value={form.allergies} exclusive="none"
                onChange={v => {
                  const last = v[v.length - 1];
                  set('allergies', last === 'none' ? ['none'] : v.filter(x => x !== 'none'));
                  setShowHint(false);
                }} />
            </div>
            <div>
              <Label>Equipment available</Label>
              <Chips options={EQUIPMENT} value={form.equipment} exclusive="none"
                onChange={v => { set('equipment', v); setShowHint(false); }} />
            </div>
            <div>
              <Label optional>Max time to cook</Label>
              <Chips options={COOK_TIMES} value={form.max_cook_time ? [form.max_cook_time] : []}
                onChange={v => set('max_cook_time', v[v.length - 1] || '')} />
            </div>
            <div className="rounded-2xl px-4 py-3 flex items-start gap-3" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(99,102,241,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: 1, flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.35)' }}>
                You can add more preferences — cuisines, workout types, cooking skill, and budget — anytime from your <span style={{ color: 'rgba(99,102,241,0.8)' }}>Profile</span>.
              </p>
            </div>
          </>}
        </div>

        <div className="mt-10 flex flex-col gap-3">
          {showHint && (
            <p className="text-sm text-center px-4 py-3 rounded-xl" style={{ color: '#fca5a5', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
              {stepHint(step)}
            </p>
          )}
          <button onClick={handleContinue} disabled={saving}
            className="w-full font-bold text-white disabled:opacity-50 cursor-pointer"
            style={{ height: 62, borderRadius: 16, background: 'linear-gradient(135deg, #494fdf, #7c3aed)', border: 'none', fontSize: 17, boxShadow: '0 4px 16px rgba(99,102,241,0.3)' }}>
            {saving ? 'Saving…' : step === STEPS.length - 1 ? 'Finish →' : 'Continue →'}
          </button>
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)}
              className="w-full font-semibold cursor-pointer"
              style={{ height: 50, borderRadius: 16, background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 15 }}>
              Back
            </button>
          )}
          {step === 0 && (
            <button onClick={handleSkip}
              className="w-full font-semibold cursor-pointer"
              style={{ height: 50, borderRadius: 16, background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 15 }}>
              Skip for now
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
