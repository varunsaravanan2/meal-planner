'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { login } from '@/lib/api';

const BLUE = '#3b82f6';
const CARD_W = 185;

// ── Pillar cards composition ───────────────────────────────────────────────────

function PillarCards() {
  const cards = [
    {
      label: 'Planning', sub: 'Schedule',
      accent: '#3b82f6',
      rotate: '-2deg', top: 0, left: 0, z: 2,
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      ),
      geo: (
        <svg width="36" height="30" viewBox="0 0 36 30" fill="none" style={{ position: 'absolute' as const, bottom: 12, right: 14, opacity: 0.2 }}>
          {([0,1,2] as number[]).flatMap(row => ([0,1,2] as number[]).map(col => (
            <circle key={`${row}-${col}`} cx={col * 11 + 5} cy={row * 11 + 5} r="2" fill="#3b82f6" />
          )))}
        </svg>
      ),
    },
    {
      label: 'Nutrition', sub: 'Macros',
      accent: '#a78bfa',
      rotate: '1.8deg', top: 22, left: 168, z: 4,
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 6v6l3 2"/>
        </svg>
      ),
      geo: (
        <div style={{ position: 'absolute' as const, bottom: 13, right: 14, display: 'flex', flexDirection: 'column' as const, gap: 3.5, opacity: 0.22 }}>
          {[26, 18, 22].map((w, i) => (
            <div key={i} style={{ height: 2.5, width: w, borderRadius: 2, background: '#a78bfa' }} />
          ))}
        </div>
      ),
    },
    {
      label: 'Workouts', sub: 'Training',
      accent: '#34d399',
      rotate: '-1.5deg', top: 114, left: 14, z: 1,
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
      ),
      geo: (
        <svg width="48" height="22" viewBox="0 0 48 22" fill="none" style={{ position: 'absolute' as const, bottom: 11, right: 12, opacity: 0.2 }}>
          <polyline points="2,16 10,7 18,11 26,4 34,9 46,2" stroke="#34d399" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
    },
    {
      label: 'Progress', sub: 'Growth',
      accent: '#fb923c',
      rotate: '2.2deg', top: 136, left: 178, z: 3,
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fb923c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>
        </svg>
      ),
      geo: (
        <svg width="38" height="30" viewBox="0 0 38 30" fill="none" style={{ position: 'absolute' as const, bottom: 10, right: 12, opacity: 0.2 }}>
          <line x1="4" y1="26" x2="34" y2="4" stroke="#fb923c" strokeWidth="1.8" strokeLinecap="round"/>
          <circle cx="34" cy="4" r="2.8" fill="#fb923c"/>
        </svg>
      ),
    },
  ];

  return (
    <div style={{ position: 'relative', height: 222 }}>
      {/* Central ambient glow */}
      <div style={{
        position: 'absolute', top: '48%', left: '44%',
        width: 200, height: 200, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(59,130,246,0.14) 0%, transparent 68%)',
        transform: 'translate(-50%, -50%)', pointerEvents: 'none',
      }} />

      {cards.map(({ label, sub, accent, rotate, top, left, z, icon, geo }) => (
        <div key={label} style={{
          position: 'absolute', width: CARD_W,
          top, left, zIndex: z,
          transform: `rotate(${rotate})`,
          background: 'rgba(255,255,255,0.046)',
          border: '1px solid rgba(255,255,255,0.092)',
          borderRadius: 14,
          padding: '13px 15px',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          boxShadow: '0 10px 32px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.07)',
        }}>
          {/* Accent line */}
          <div style={{ width: 24, height: 2.5, borderRadius: 2, background: accent, marginBottom: 10 }} />

          {/* Label row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            {icon}
            <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.84)', letterSpacing: '-0.2px' }}>
              {label}
            </span>
          </div>

          {/* Sub */}
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.26)', marginTop: 5, letterSpacing: '0.02em' }}>
            {sub}
          </p>

          {/* Geometric decoration */}
          {geo}
        </div>
      ))}
    </div>
  );
}

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
      router.push('/dashboard');
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

        {/* Headline + cards */}
        <div style={{ position: 'relative' }}>
          <h1 style={{ fontSize: 40, fontWeight: 800, color: '#fff', letterSpacing: '-0.9px', lineHeight: 1.12, marginBottom: 10 }}>
            Everything you need<br />to plan your week.
          </h1>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.37)', lineHeight: 1.65, marginBottom: 36, maxWidth: 370 }}>
            Organize meals, track nutrition, and stay on top of your health goals — all in one place.
          </p>
          <PillarCards />
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
            <div style={{ marginBottom: 20, fontSize: 13, padding: '12px 16px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 8, color: '#e23b4a', background: '#fff1f2', border: '1px solid #fecdd3' }}>
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
                placeholder="••••••••"
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
              {loading ? 'Signing in…' : 'Sign in →'}
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
