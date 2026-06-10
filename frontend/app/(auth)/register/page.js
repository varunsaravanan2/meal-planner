'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { register, login } from '@/lib/api';

export default function RegisterPage() {
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
      await register(email, password);
      await login(email, password);
      router.push('/onboarding');
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
          <p className="text-white font-bold leading-tight" style={{ fontSize: 78, letterSpacing: '-1px' }}>
            Your kitchen,<br />organized.
          </p>
          <p className="mt-4 text-base" style={{ color: 'rgba(255,255,255,0.45)', lineHeight: 1.6, fontSize: 48}}>
            Stop wondering what to cook.<br />
            Plan smarter with AI.
          </p>
        </div>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>© 2026 Meal Planner</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="text-5xl font-bold" style={{ color: '#191c1f', letterSpacing: '-0.5px' }}>Create your account</h2>
            {/* <p className="mt-1 text-sm" style={{ color: '#8d969e' }}>Free forever. No credit card required.</p> */}
          </div>

          {error && (
            <div className="mb-5 text-sm px-4 py-3 rounded-xl" style={{ color: '#e23b4a', background: '#fff1f2', border: '1px solid #fecdd3' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-lg font-semibold uppercase tracking-wider mb-2" style={{ color: '#8d969e' }}>Email</label>
              <input
                type="email" required value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full text-sm focus:outline-none"
                style={{ height: 52, padding: '0 16px', border: '1.5px solid #e2e2e7', borderRadius: 12, color: '#191c1f' }}
                onFocus={e => e.target.style.borderColor = '#191c1f'}
                onBlur={e => e.target.style.borderColor = '#e2e2e7'}
                /*placeholder="you@example.com"*/
              />
            </div>
            <div>
              <label className="block text-lg font-semibold uppercase tracking-wider mb-2" style={{ color: '#8d969e' }}>Password</label>
              <input
                type="password" required minLength={8} value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full text-sm focus:outline-none"
                style={{ height: 52, padding: '0 16px', border: '1.5px solid #e2e2e7', borderRadius: 12, color: '#191c1f' }}
                onFocus={e => e.target.style.borderColor = '#191c1f'}
                onBlur={e => e.target.style.borderColor = '#e2e2e7'}
                /*placeholder="8+ characters"*/
              />
            </div>
            <button
              type="submit" disabled={loading}
              className="w-full font-semibold text-lg text-white disabled:opacity-50"
              style={{ height: 52, borderRadius: 12, background: '#191c1f' }}
              onMouseEnter={e => e.target.style.background = '#000'}
              onMouseLeave={e => e.target.style.background = '#191c1f'}
            >
              {loading ? 'Creating account…' : 'Get started →'}
            </button>
          </form>

          <p className="text-center mt-6 text-lg" style={{ color: '#8d969e' }}>
            Already have an account?{' '}
            <Link href="/login" className="font-semibold hover:underline" style={{ color: '#494fdf' }}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
