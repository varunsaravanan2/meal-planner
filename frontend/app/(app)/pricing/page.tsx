'use client';

import { useState, useEffect } from 'react';
import { getSubscriptionStatus, createCheckoutSession, type SubscriptionStatus } from '@/lib/api';

interface Plan {
  id: string;
  label: string;
  price: string;
  period: string;
  generations: number;
  features: string[];
  color: string;
  highlight?: boolean;
}

const PLANS: Plan[] = [
  {
    id: 'free',
    label: 'Free',
    price: '$0',
    period: 'forever',
    generations: 1,
    color: '#64748b',
    features: [
      '1 AI meal plan generation',
      'Unlimited manual recipes',
      'Manual workout logging',
      'Shopping list & pantry sync',
      'Nutrition tracking',
    ],
  },
  {
    id: 'week',
    label: '1 Week',
    price: '$4.99',
    period: 'one-time',
    generations: 3,
    color: '#10b981',
    features: [
      '3 AI meal plan generations',
      'Everything in Free',
      'Revert to previous 3 plans',
      '7-day access',
    ],
  },
  {
    id: 'month',
    label: '1 Month',
    price: '$12.99',
    period: 'one-time',
    generations: 10,
    color: '#6366f1',
    highlight: true,
    features: [
      '10 AI meal plan generations',
      'Everything in Free',
      'Revert to previous 3 plans',
      '30-day access',
    ],
  },
  {
    id: '3month',
    label: '3 Months',
    price: '$29.99',
    period: 'one-time',
    generations: 30,
    color: '#8b5cf6',
    features: [
      '30 AI meal plan generations',
      'Everything in Free',
      'Revert to previous 3 plans',
      '90-day access',
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
    <div style={{ minHeight: '100%', background: '#edf1f7', padding: '48px 32px 80px' }}>
      <style>{`
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .plan-card { transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .plan-card:hover { transform: translateY(-4px) !important; box-shadow: 0 16px 48px rgba(15,23,42,0.14) !important; }
        .upgrade-btn { transition: opacity 0.15s ease, transform 0.15s ease; }
        .upgrade-btn:hover:not(:disabled) { opacity: 0.9; transform: scale(1.02); }
      `}</style>

      <div style={{ maxWidth: 960, margin: '0 auto' }}>

        {/* header */}
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
            borderRadius: 100, padding: '6px 16px', marginBottom: 20,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#6366f1', display: 'inline-block', boxShadow: '0 0 0 3px rgba(99,102,241,0.25)' }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: '#6366f1' }}>Simple, one-time pricing</span>
          </div>
          <h1 style={{ fontSize: 52, fontWeight: 800, color: '#0f172a', letterSpacing: '-1.5px', lineHeight: 1.1, marginBottom: 16 }}>
            Choose your plan
          </h1>
          <p style={{ fontSize: 19, color: '#64748b', maxWidth: 480, margin: '0 auto' }}>
            Pay once, use for the full period. No subscriptions, no hidden fees.
          </p>
          {status && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginTop: 24, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '10px 20px' }}>
              <span style={{ fontSize: 15, color: '#475569', fontWeight: 500 }}>
                Current: <strong style={{ color: '#0f172a', textTransform: 'capitalize' }}>{status.plan_type}</strong>
              </span>
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#cbd5e1', display: 'inline-block' }} />
              <span style={{ fontSize: 15, color: '#6366f1', fontWeight: 600 }}>
                {status.generations_remaining} AI generation{status.generations_remaining !== 1 ? 's' : ''} left
              </span>
            </div>
          )}
        </div>

        {error && (
          <div style={{ textAlign: 'center', color: '#ef4444', fontSize: 15, marginBottom: 24, background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 12, padding: '12px 20px' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 20 }}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{ height: 420, borderRadius: 24, background: 'linear-gradient(90deg,#e8edf5 25%,#f1f5fb 50%,#e8edf5 75%)', backgroundSize: '400px 100%', animation: 'shimmer 1.4s infinite linear' }} />
            ))}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 20 }}>
            {PLANS.map((plan, i) => {
              const isCurrent = currentPlan === plan.id;
              return (
                <div
                  key={plan.id}
                  className="plan-card"
                  style={{
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    background: plan.highlight ? `linear-gradient(160deg,${plan.color}08,#fff 40%)` : '#fff',
                    border: plan.highlight ? `2px solid ${plan.color}` : '1px solid #e2e8f0',
                    borderRadius: 24,
                    overflow: 'hidden',
                    boxShadow: plan.highlight ? `0 8px 32px ${plan.color}25` : '0 2px 12px rgba(15,23,42,0.06)',
                    animation: `cardIn 0.5s ease ${i * 80}ms both`,
                  }}
                >
                  {/* top color bar */}
                  <div style={{ height: 5, background: plan.color, opacity: plan.highlight ? 1 : 0.5 }} />

                  {plan.highlight && (
                    <div style={{
                      position: 'absolute', top: 16, right: 16,
                      background: plan.color, color: '#fff',
                      fontSize: 12, fontWeight: 700, letterSpacing: '0.05em',
                      padding: '4px 12px', borderRadius: 100,
                    }}>
                      POPULAR
                    </div>
                  )}

                  <div style={{ padding: '28px 28px 0' }}>
                    <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>{plan.label}</h2>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, marginBottom: 6 }}>
                      <span style={{ fontSize: 48, fontWeight: 800, color: '#0f172a', letterSpacing: '-2px', lineHeight: 1 }}>{plan.price}</span>
                      <span style={{ fontSize: 15, color: '#94a3b8', marginBottom: 6, fontWeight: 500 }}>{plan.period}</span>
                    </div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: `${plan.color}12`, border: `1px solid ${plan.color}25`, borderRadius: 8, padding: '5px 12px', marginBottom: 24 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: plan.color }}>
                        {plan.generations} AI generation{plan.generations !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  <ul style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, padding: '0 28px 24px', listStyle: 'none', margin: 0 }}>
                    {plan.features.map((f) => (
                      <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 15, color: '#475569', lineHeight: 1.4 }}>
                        <svg style={{ width: 18, height: 18, color: plan.color, flexShrink: 0, marginTop: 1 }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        {f}
                      </li>
                    ))}
                  </ul>

                  <div style={{ padding: '0 28px 28px' }}>
                    {isCurrent ? (
                      <div style={{ width: '100%', textAlign: 'center', fontSize: 15, fontWeight: 600, color: plan.color, border: `1.5px solid ${plan.color}40`, borderRadius: 14, padding: '13px 0', background: `${plan.color}08` }}>
                        ✓ Current plan
                      </div>
                    ) : plan.id === 'free' ? (
                      <div style={{ width: '100%', textAlign: 'center', fontSize: 15, fontWeight: 500, color: '#94a3b8', border: '1.5px solid #e2e8f0', borderRadius: 14, padding: '13px 0', background: '#f8fafc' }}>
                        Default
                      </div>
                    ) : (
                      <button
                        className="upgrade-btn"
                        onClick={() => handleUpgrade(plan.id)}
                        disabled={checkingOut !== null}
                        style={{
                          width: '100%',
                          padding: '14px 0',
                          borderRadius: 14,
                          border: plan.highlight ? 'none' : `2px solid ${plan.color}`,
                          fontSize: 16,
                          fontWeight: 700,
                          cursor: checkingOut !== null ? 'not-allowed' : 'pointer',
                          opacity: checkingOut !== null ? 0.5 : 1,
                          background: plan.highlight
                            ? `linear-gradient(135deg, ${plan.color}, ${plan.color}cc)`
                            : 'transparent',
                          color: plan.highlight ? '#fff' : plan.color,
                          boxShadow: plan.highlight ? `0 4px 16px ${plan.color}40` : 'none',
                        } as React.CSSProperties}
                      >
                        {checkingOut === plan.id ? 'Redirecting…' : 'Get started →'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p style={{ textAlign: 'center', fontSize: 14, color: '#94a3b8', marginTop: 48 }}>
          Payments are processed securely by Stripe. You will not be charged automatically.
        </p>
      </div>
    </div>
  );
}
