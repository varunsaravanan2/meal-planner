'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { login } from '@/lib/api';

const BLUE = '#3b82f6';

// ── Main page ──────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      router.push('/home');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">

      {/* ── Left panel ── */}
      <div className="hidden lg:flex flex-col justify-between w-[52%] p-14 relative overflow-hidden"
        style={{ background: 'linear-gradient(155deg, #060d1c 0%, #0a1628 50%, #0c1e35 100%)' }}>

        {/* Ambient glows */}
        <div style={{ position: 'absolute', top: -120, right: -90, width: 440, height: 440, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: 40, left: -110, width: 360, height: 360, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />

        {/* Logo */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontWeight: 900, fontSize: 16 }}>M</span>
          </div>
          <span style={{ color: 'rgba(255,255,255,0.55)', fontWeight: 700, fontSize: 16, letterSpacing: '-0.3px' }}>MealPlan</span>
        </div>

        {/* Headline */}
        <div style={{ position: 'relative' }}>
          <h1 style={{ position: 'relative', fontFamily: 'var(--font-inter), -apple-system, sans-serif', fontWeight: 700, fontSize: 46, color: '#fff', letterSpacing: '-1.2px', lineHeight: 1.15, marginBottom: 18, maxWidth: 380 }}>
            Your week, planned.
          </h1>
          <p style={{ position: 'relative', fontSize: 15, color: 'rgba(255,255,255,0.37)', lineHeight: 1.65, maxWidth: 340 }}>
            A calm, organized place for your meals, workouts, and progress.
          </p>
        </div>

        <p style={{ color: 'rgba(255,255,255,0.14)', fontSize: 13, position: 'relative' }}>© 2026 MealPlan</p>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex items-center justify-center p-8"
        style={{ background: 'var(--auth-panel-bg)' }}>
        <div className="w-full max-w-sm">

          <div style={{ marginBottom: 36 }}>
            <h2 style={{ fontSize: 36, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.8px', lineHeight: 1.1 }}>Welcome back.</h2>
            <p style={{ marginTop: 8, fontSize: 15, color: 'var(--text-tertiary)' }}>Sign in to your account to continue.</p>
          </div>

          {error && (
            <div style={{ marginBottom: 20, fontSize: 13, padding: '12px 16px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 8, color: '#f87171', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--text-tertiary)', marginBottom: 8 }}>Email</label>
              <input
                type="email" required value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={{ width: '100%', height: 52, padding: '0 16px', border: '1.5px solid var(--border-color)', borderRadius: 12, color: 'var(--text-primary)', background: 'var(--bg-input)', fontSize: 15, outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => { e.currentTarget.style.borderColor = BLUE; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.boxShadow = 'none'; }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--text-tertiary)', marginBottom: 8 }}>Password</label>
              <input
                type="password" required value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                style={{ width: '100%', height: 52, padding: '0 16px', border: '1.5px solid var(--border-color)', borderRadius: 12, color: 'var(--text-primary)', background: 'var(--bg-input)', fontSize: 15, outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => { e.currentTarget.style.borderColor = BLUE; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.boxShadow = 'none'; }}
              />
            </div>
            <button
              type="submit" disabled={loading}
              style={{ height: 52, borderRadius: 12, background: BLUE, color: '#fff', fontWeight: 700, fontSize: 15, border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, transition: 'background 0.15s', marginTop: 4 }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#2563eb'; }}
              onMouseLeave={e => { e.currentTarget.style.background = BLUE; }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 28, fontSize: 14, color: 'var(--text-tertiary)' }}>
            No account?{' '}
            <Link href="/register" style={{ color: BLUE, fontWeight: 600, textDecoration: 'none' }}
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
