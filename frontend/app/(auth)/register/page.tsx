'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { register, login } from '@/lib/api';

const BLUE = '#3b82f6';

export default function RegisterPage() {
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
      await register(email, password);
      await login(email, password);
      router.push('/onboarding');
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

        {/* Ambient glows */}
        <div style={{ position: 'absolute', top: -60, left: -40, width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: 80, right: -60, width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div style={{ width: 34, height: 34, borderRadius: 12, background: BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontWeight: 900, fontSize: 17, letterSpacing: '-0.5px' }}>M</span>
          </div>
          <span style={{ color: 'rgba(255,255,255,0.65)', fontWeight: 700, fontSize: 18, letterSpacing: '-0.3px' }}>MealPlan</span>
        </div>

        {/* Headline */}
        <div className="relative">
          <p className="font-bold leading-tight" style={{ fontSize: 46, letterSpacing: '-1.2px', color: '#fff', lineHeight: 1.15 }}>
            Your kitchen, organized.
          </p>
          <p className="mt-4 text-base leading-relaxed" style={{ color: 'rgba(255,255,255,0.37)', maxWidth: 340 }}>
            Stop wondering what to cook. Plan smarter with AI-powered meal planning.
          </p>
        </div>

        <p style={{ color: 'rgba(255,255,255,0.15)', fontSize: 14, position: 'relative' }}>© 2026 MealPlan</p>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex items-center justify-center p-8"
        style={{ background: 'var(--auth-panel-bg)' }}>
        <div className="w-full max-w-sm">

          <div className="mb-9">
            <h2 className="font-bold" style={{ fontSize: 40, color: 'var(--text-primary)', letterSpacing: '-1px' }}>Create your account</h2>
            <p className="mt-2 text-base" style={{ color: 'var(--text-tertiary)' }}>Start planning better meals today</p>
          </div>

          {error && (
            <div className="mb-5 text-sm px-4 py-3 rounded-xl flex items-center gap-2" style={{ color: '#f87171', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)' }}>
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
                onFocus={e => { e.currentTarget.style.borderColor = BLUE; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.boxShadow = 'none'; }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-tertiary)' }}>Password</label>
              <input
                type="password" required minLength={8} value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full text-sm transition-all focus:outline-none"
                placeholder="At least 8 characters"
                style={{ height: 58, padding: '0 18px', border: '1.5px solid var(--border-color)', borderRadius: 14, color: 'var(--text-primary)', background: 'var(--bg-input)', fontSize: 16 }}
                onFocus={e => { e.currentTarget.style.borderColor = BLUE; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.boxShadow = 'none'; }}
              />
            </div>
            <button
              type="submit" disabled={loading}
              className="w-full font-semibold text-base text-white disabled:opacity-50 transition-all"
              style={{ height: 58, borderRadius: 14, background: BLUE, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', marginTop: 10, transition: 'background 0.15s' }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#2563eb'; }}
              onMouseLeave={e => { e.currentTarget.style.background = BLUE; }}
            >
              {loading ? 'Creating account…' : 'Get started'}
            </button>
          </form>

          <p className="text-center mt-7 text-base" style={{ color: 'var(--text-tertiary)' }}>
            Already have an account?{' '}
            <Link href="/login" className="font-semibold" style={{ color: BLUE, textDecoration: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
              onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
