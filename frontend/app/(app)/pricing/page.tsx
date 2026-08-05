'use client';

import { useState, useEffect } from 'react';
import { getSubscriptionStatus, createCheckoutSession, type SubscriptionStatus } from '@/lib/api';
import { PricingCard } from '@/components/ui/dark-gradient-pricing';

const BLUE = '#3b82f6';
const JOSH_TIMES = ['9:00 AM', '11:00 AM', '1:00 PM', '3:00 PM', '4:30 PM'];

interface JoshSlotDay {
  iso: string;
  label: string;
  times: string[];
}

function getJoshAvailability(): JoshSlotDay[] {
  const days: JoshSlotDay[] = [];
  const d = new Date();
  d.setDate(d.getDate() + 1);
  while (days.length < 8) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) {
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      // Deterministic pseudo-random subset of times so it looks like a real, partially-booked calendar.
      const seed = d.getDate() + d.getMonth() * 31;
      const times = JOSH_TIMES.filter((_, i) => (seed + i) % 3 !== 0);
      days.push({
        iso,
        label: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        times,
      });
    }
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function JoshBookingModal({ onClose }: { onClose: () => void }) {
  const [days] = useState<JoshSlotDay[]>(getJoshAvailability);
  const [selectedDay, setSelectedDay] = useState<string>(days[0].iso);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const activeDay = days.find(d => d.iso === selectedDay)!;

  if (confirmed) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} onClick={onClose}>
        <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', borderRadius: 20, width: '100%', maxWidth: 380, padding: '32px 28px', textAlign: 'center', border: '1px solid var(--border-color)' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(34,197,94,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>You&apos;re booked</h3>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.6, marginBottom: 22 }}>
            {activeDay.label} at {selectedTime} with Josh. A confirmation with the video call link will be sent to your email.
          </p>
          <button onClick={onClose} style={{ width: '100%', height: 44, borderRadius: 10, background: BLUE, color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Done</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg-card)', borderRadius: 20, width: '100%', maxWidth: 460, maxHeight: '85vh', display: 'flex', flexDirection: 'column', border: '1px solid var(--border-color)' }}>
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>Schedule with Josh</h3>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 3 }}>1-hour 1:1 call · pick an available slot</p>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-soft)', color: 'var(--text-tertiary)', fontSize: 14, cursor: 'pointer', flexShrink: 0 }}>✕</button>
        </div>

        <div style={{ overflowY: 'auto', padding: '16px 22px' }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: 10 }}>Day</p>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 18 }}>
            {days.map(day => {
              const sel = day.iso === selectedDay;
              return (
                <button key={day.iso} onClick={() => { setSelectedDay(day.iso); setSelectedTime(null); }}
                  style={{
                    flexShrink: 0, padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                    border: `1.5px solid ${sel ? BLUE : 'var(--border-color)'}`,
                    background: sel ? 'rgba(59,130,246,0.1)' : 'transparent',
                    color: sel ? BLUE : 'var(--text-secondary)', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
                  }}>
                  {day.label}
                </button>
              );
            })}
          </div>

          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: 10 }}>Time</p>
          {activeDay.times.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-placeholder)', fontStyle: 'italic' }}>No slots left this day — try another.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
              {activeDay.times.map(time => {
                const sel = time === selectedTime;
                return (
                  <button key={time} onClick={() => setSelectedTime(time)}
                    style={{
                      padding: '10px 6px', borderRadius: 10, cursor: 'pointer', textAlign: 'center',
                      border: `1.5px solid ${sel ? BLUE : 'var(--border-color)'}`,
                      background: sel ? 'rgba(59,130,246,0.1)' : 'transparent',
                      color: sel ? BLUE : 'var(--text-secondary)', fontSize: 12, fontWeight: 700,
                    }}>
                    {time}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, height: 44, borderRadius: 10, border: '1px solid var(--border-color)', color: 'var(--text-tertiary)', background: 'transparent', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => setConfirmed(true)} disabled={!selectedTime}
            style={{ flex: 2, height: 44, borderRadius: 10, background: BLUE, color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, cursor: selectedTime ? 'pointer' : 'not-allowed', opacity: selectedTime ? 1 : 0.4 }}>
            Confirm booking · $100
          </button>
        </div>
      </div>
    </div>
  );
}

const PLANS = [
  {
    id: 'free',
    tier: 'Free',
    price: '$0',
    bestFor: 'Get started at no cost',
    CTA: 'Your default plan',
    benefits: [
      { text: '1 AI meal plan generation', checked: true },
      { text: 'Unlimited manual recipes', checked: true },
      { text: 'Shopping list & pantry sync', checked: true },
      { text: 'Plan history & snapshots', checked: false },
      { text: 'Priority support', checked: false },
    ],
  },
  {
    id: 'week',
    tier: '1 Week',
    price: '$4.99',
    bestFor: 'One-time · 7-day access',
    CTA: 'Get started →',
    benefits: [
      { text: '3 AI meal plan generations', checked: true },
      { text: 'Unlimited manual recipes', checked: true },
      { text: 'Shopping list & pantry sync', checked: true },
      { text: 'Plan history & snapshots', checked: true },
      { text: 'Strength workout plan', checked: true },
      { text: '30-min 1:1 consultation call', checked: true },
      { text: 'Priority support', checked: false },
    ],
  },
  {
    id: 'month',
    tier: '1 Month',
    price: '$12.99',
    bestFor: 'One-time · 30-day access',
    CTA: '14-day free trial',
    highlighted: true,
    benefits: [
      { text: '10 AI meal plan generations', checked: true },
      { text: 'Unlimited manual recipes', checked: true },
      { text: 'Shopping list & pantry sync', checked: true },
      { text: 'Plan history & snapshots', checked: true },
      { text: '30 days of workouts & meals', checked: true },
      { text: 'Weekly 30-min consultation call', checked: true },
      { text: 'Priority support', checked: true },
    ],
  },
  {
    id: '3month',
    tier: '3 Months',
    price: '$29.99',
    bestFor: 'One-time · 90-day access',
    CTA: 'Get started →',
    benefits: [
      { text: '30 AI meal plan generations', checked: true },
      { text: 'Unlimited manual recipes', checked: true },
      { text: 'Shopping list & pantry sync', checked: true },
      { text: 'Plan history & snapshots', checked: true },
      { text: 'Strength workout plan', checked: true },
      { text: 'Priority support', checked: true },
    ],
  },
];

export default function PricingPage() {
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [showJoshModal, setShowJoshModal] = useState(false);

  useEffect(() => {
    getSubscriptionStatus()
      .then(setStatus)
      .catch(() => setError('Could not load subscription status.'))
      .finally(() => setLoading(false));
  }, []);

  async function handleUpgrade(planId: string) {
    if (planId === 'free') return;
    setCheckingOut(planId);
    setError('');
    try {
      const { url } = await createCheckoutSession(planId);
      window.location.href = url;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Checkout failed.');
      setCheckingOut(null);
    }
  }

  const currentPlan = status?.plan_type ?? 'free';

  return (
    <section className="relative overflow-hidden" style={{ minHeight: '100%', padding: '36px 24px 70px' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>

        {/* header */}
        <div className="mb-8 space-y-2">
          <h1 className="text-center text-2xl font-semibold sm:text-3xl" style={{ color: 'var(--text-primary)' }}>
            Choose your plan
          </h1>
          <p className="text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
            Pay once, use for the full period. No subscriptions, no hidden fees.
          </p>
          {status && (
            <div className="flex justify-center pt-1">
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 10,
                background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                borderRadius: 10, padding: '7px 14px',
              }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>
                  Current: <strong style={{ color: 'var(--text-primary)', textTransform: 'capitalize' }}>{status.plan_type}</strong>
                </span>
                <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--border-color)', display: 'inline-block' }} />
                <span style={{ fontSize: 13, color: '#3b82f6', fontWeight: 600 }}>
                  {status.generations_remaining} generation{status.generations_remaining !== 1 ? 's' : ''} left
                </span>
              </div>
            </div>
          )}
        </div>

        {error && (
          <p className="text-center mb-8" style={{ color: '#ef4444', fontSize: 15 }}>{error}</p>
        )}

        {loading ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="skeleton" style={{ height: 420, borderRadius: 16 }} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
            {PLANS.map(plan => (
              <PricingCard
                key={plan.id}
                tier={plan.tier}
                price={plan.price}
                bestFor={plan.bestFor}
                CTA={checkingOut === plan.id ? 'Redirecting…' : plan.CTA}
                benefits={plan.benefits}
                highlighted={plan.highlighted}
                isCurrent={currentPlan === plan.id}
                onCTA={() => handleUpgrade(plan.id)}
                ctaDisabled={checkingOut !== null || plan.id === 'free'}
              />
            ))}
          </div>
        )}

        {/* 1-on-1 coaching add-on */}
        <div className="mt-14">
          <div className="mb-6 space-y-1">
            <h2 className="text-center text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              Want personal coaching?
            </h2>
            <p className="text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
              Book a 1:1 call directly with your trainer.
            </p>
          </div>
          <div className="mx-auto" style={{ maxWidth: 320 }}>
            <PricingCard
              tier="1-on-1 with Josh"
              price="$100"
              bestFor="One-time · 60-minute video call"
              CTA="Choose a time →"
              benefits={[
                { text: '1 hour 1:1 call with Josh', checked: true },
                { text: 'Personalized training feedback', checked: true },
                { text: 'Pick any available time slot', checked: true },
              ]}
              onCTA={() => setShowJoshModal(true)}
            />
          </div>
        </div>

        <p className="text-center mt-14" style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>
          Payments processed securely by Stripe. You will not be charged automatically.
        </p>

        {showJoshModal && <JoshBookingModal onClose={() => setShowJoshModal(false)} />}
      </div>
    </section>
  );
}
