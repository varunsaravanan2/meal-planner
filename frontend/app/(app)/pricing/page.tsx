'use client';

import { useState, useEffect } from 'react';
import { getSubscriptionStatus, createCheckoutSession, type SubscriptionStatus } from '@/lib/api';
import { PricingCard } from '@/components/ui/dark-gradient-pricing';

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
      { text: 'Priority support', checked: true },
    ],
  },
];

export default function PricingPage() {
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [error, setError] = useState('');

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

        <p className="text-center mt-14" style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>
          Payments processed securely by Stripe. You will not be charged automatically.
        </p>
      </div>
    </section>
  );
}
