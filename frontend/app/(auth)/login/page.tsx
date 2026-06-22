'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { login } from '@/lib/api';
import { SparklesCore } from '@/components/ui/sparkles';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">

      {/* ── Left branding panel ── */}
      <div className="hidden lg:flex flex-col justify-between w-[46%] p-14 relative overflow-hidden"
        style={{ background: 'linear-gradient(145deg, #08080f 0%, #0f0f1e 40%, #0a0f1a 100%)' }}>

        {/* Sparkles background */}
        <SparklesCore
          id="login-sparkles"
          background="transparent"
          minSize={0.4}
          maxSize={1.2}
          particleDensity={80}
          particleColor="#818cf8"
          speed={1.2}
          className="absolute inset-0 w-full h-full"
        />

        {/* Decorative orbs */}
        <div style={{ position: 'absolute', top: -80, right: -40, width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.2) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: 60, left: -60, width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(20,184,166,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -40, right: 80, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div style={{ width: 34, height: 34, borderRadius: 12, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(99,102,241,0.4)' }}>
            <span style={{ color: '#fff', fontWeight: 900, fontSize: 17, letterSpacing: '-0.5px' }}>M</span>
          </div>
          <span style={{ color: 'rgba(255,255,255,0.65)', fontWeight: 700, fontSize: 18, letterSpacing: '-0.3px' }}>MealPlan</span>
        </div>

        {/* Headline */}
        <div className="relative">
          <p className="font-bold leading-tight" style={{ fontSize: 66, letterSpacing: '-1.5px', color: '#fff', lineHeight: 1.08 }}>
            Plan your week,<br />
            <span style={{ background: 'linear-gradient(90deg, #818cf8, #34d399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              eat better.
            </span>
          </p>
          <p className="mt-5 text-lg leading-relaxed" style={{ color: 'rgba(255,255,255,0.38)', maxWidth: 360 }}>
            Save recipes from anywhere, plan your meals, and get a shopping list generated automatically.
          </p>

          <div className="mt-10 space-y-4">
            {[
              { text: 'Save recipes with AI extraction',    color: '#6366f1' },
              { text: 'Plan meals on a weekly calendar',    color: '#14b8a6' },
              { text: 'Auto-generate shopping lists',       color: '#8b5cf6' },
            ].map(({ text, color }) => (
              <div key={text} className="flex items-center gap-4">
                <span style={{ width: 22, height: 22, borderRadius: '50%', background: `${color}22`, border: `1.5px solid ${color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <polyline points="1.5,6 4.5,9 10.5,3" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 17 }}>{text}</span>
              </div>
            ))}
          </div>
        </div>

        <p style={{ color: 'rgba(255,255,255,0.15)', fontSize: 14, position: 'relative' }}>© 2026 MealPlan</p>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex items-center justify-center p-8"
        style={{ background: 'var(--auth-panel-bg)' }}>
        <div className="w-full max-w-sm">

          <div className="mb-9">
            <h2 className="font-bold" style={{ fontSize: 42, color: 'var(--text-primary)', letterSpacing: '-1px' }}>Welcome back</h2>
            <p className="mt-2 text-base" style={{ color: 'var(--text-tertiary)' }}>Sign in to your account</p>
          </div>

          {error && (
            <div className="mb-5 text-sm px-4 py-3 rounded-xl flex items-center gap-2" style={{ color: '#e23b4a', background: '#fff1f2', border: '1px solid #fecdd3' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-tertiary)' }}>Email</label>
              <input
                type="email" required value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full text-sm transition-all focus:outline-none"
                placeholder="you@example.com"
                style={{ height: 58, padding: '0 18px', border: '1.5px solid var(--border-color)', borderRadius: 14, color: 'var(--text-primary)', background: 'var(--bg-input)', fontSize: 16 }}
                onFocus={e => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#e8e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-tertiary)' }}>Password</label>
              <input
                type="password" required value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full text-sm transition-all focus:outline-none"
                placeholder="••••••••"
                style={{ height: 58, padding: '0 18px', border: '1.5px solid var(--border-color)', borderRadius: 14, color: 'var(--text-primary)', background: 'var(--bg-input)', fontSize: 16 }}
                onFocus={e => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#e8e8f0'; e.currentTarget.style.boxShadow = 'none'; }}
              />
            </div>
            <button
              type="submit" disabled={loading}
              className="w-full font-semibold text-base text-white disabled:opacity-50 transition-all"
              style={{ height: 58, borderRadius: 14, background: 'linear-gradient(135deg, #5557e8, #7c3aed)', boxShadow: '0 4px 16px rgba(99,102,241,0.35)', border: 'none', cursor: 'pointer', marginTop: 10 }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 6px 24px rgba(99,102,241,0.5)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(99,102,241,0.35)'}
            >
              {loading ? 'Signing in…' : 'Sign in →'}
            </button>
          </form>

          <p className="text-center mt-7 text-base" style={{ color: 'var(--text-tertiary)' }}>
            No account?{' '}
            <Link href="/register" className="font-semibold" style={{ color: '#6366f1', textDecoration: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
              onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}>
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
