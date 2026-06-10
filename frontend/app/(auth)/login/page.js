'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { login } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] p-12" style={{ background: '#0a0a0a' }}>
        <span className="text-white font-bold text-lg tracking-tight">Meal Planner</span>
        <div>
          <p className="text-white font-bold leading-tight" style={{ fontSize: 68, letterSpacing: '-1px' }}>
            Plan your week,<br />eat better.
          </p>
          <p className="mt-4 text-base" style={{ color: 'rgba(255,255,255,0.45)', lineHeight: 1.6, fontSize: 40}}>
            Save recipes from anywhere, plan<br />
            your meals, and get a shopping list<br />
            generated automatically.
          </p>
          <div className="mt-10 space-y-3">
            {['Save recipes with AI extraction', 'Plan meals on a weekly calendar', 'Auto-generate shopping lists'].map(f => (
              <div key={f} className="flex items-center gap-3">
                <span className="flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold" style={{ background: '#494fdf', color: '#fff' }}>✓</span>
                <span className="text-2xl" style={{ color: 'rgba(255,255,255,0.55)' }}>{f}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>© 2026 Meal Planner</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="text-5xl font-bold" style={{ color: '#191c1f', letterSpacing: '-1px' }}>Welcome back</h2>
            <p className="mt-5 text-xl mb-4" style={{ color: '#8d969e' }}>Sign in to your account</p>
          </div>

          {error && (
            <div className="mb-5 text-sm px-4 py-3 rounded-xl" style={{ color: '#e23b4a', background: '#fff1f2', border: '1px solid #fecdd3' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold uppercase tracking-wider mb-2" style={{ color: '#8d969e' }}>Email</label>
              <input
                type="email" required value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full text-sm focus:outline-none transition-colors"
                style={{ height: 52, padding: '0 16px', border: '1.5px solid #e2e2e7', borderRadius: 12, color: '#191c1f' }}
                onFocus={e => e.target.style.borderColor = '#191c1f'}
                onBlur={e => e.target.style.borderColor = '#e2e2e7'}
                /*placeholder="you@example.com"*/
              />
            </div>
            <div>
              <label className="block text-sm font-semibold uppercase tracking-wider mb-2" style={{ color: '#8d969e' }}>Password</label>
              <input
                type="password" required value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full text-sm focus:outline-none transition-colors"
                style={{ height: 52, padding: '0 16px', border: '1.5px solid #e2e2e7', borderRadius: 12, color: '#191c1f' }}
                onFocus={e => e.target.style.borderColor = '#191c1f'}
                onBlur={e => e.target.style.borderColor = '#e2e2e7'}
                /*placeholder="••••••••"*/
              />
            </div>
            <button
              type="submit" disabled={loading}
              className="w-full font-semibold text-lg text-white disabled:opacity-50 transition-all"
              style={{ height: 52, borderRadius: 12, background: '#191c1f' }}
              onMouseEnter={e => e.target.style.background = '#000'}
              onMouseLeave={e => e.target.style.background = '#191c1f'}
            >
              {loading ? 'Signing in…' : 'Sign in →'}
            </button>
          </form>

          <p className="text-center mt-6 text-lg" style={{ color: '#8d969e' }}>
            No account?{' '}
            <Link href="/register" className="font-semibold hover:underline" style={{ color: '#494fdf' }}>
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
