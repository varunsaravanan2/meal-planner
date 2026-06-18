'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logout } from '@/lib/api';

function IconCalendar() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  );
}
function IconBook() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
  );
}
function IconDumbbell() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 6.5h11M6.5 17.5h11"/>
      <rect x="2" y="9" width="4" height="6" rx="1"/>
      <rect x="18" y="9" width="4" height="6" rx="1"/>
      <line x1="6" y1="12" x2="18" y2="12"/>
    </svg>
  );
}
function IconBag() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
      <line x1="3" y1="6" x2="21" y2="6"/>
      <path d="M16 10a4 4 0 0 1-8 0"/>
    </svg>
  );
}
function IconPantry() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3h18v4H3z"/><path d="M3 7v13a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V7"/>
      <line x1="9" y1="12" x2="15" y2="12"/>
    </svg>
  );
}
function IconPricing() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23"/>
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  );
}
function IconProfile() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
    </svg>
  );
}
function IconLogout() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  );
}

const links = [
  { href: '/dashboard',     label: 'Plan',     Icon: IconCalendar },
  { href: '/recipes',       label: 'Recipes',  Icon: IconBook     },
  { href: '/workouts',      label: 'Workouts', Icon: IconDumbbell },
  { href: '/shopping-list', label: 'Shopping', Icon: IconBag      },
  { href: '/pantry',        label: 'Pantry',   Icon: IconPantry   },
  { href: '/pricing',       label: 'Plans',    Icon: IconPricing  },
  { href: '/profile',       label: 'Profile',  Icon: IconProfile  },
];

export default function NavLinks() {
  const pathname = usePathname();

  return (
    <>
      <style>{`
        .nav-link { transition: color 0.15s ease, background 0.15s ease; }
        .nav-link:hover { color: rgba(255,255,255,0.8) !important; background: rgba(255,255,255,0.06) !important; }
        .nav-link.active { color: #fff !important; background: rgba(255,255,255,0.1) !important; }
        .logout-btn { transition: color 0.15s ease, background 0.15s ease; }
        .logout-btn:hover { color: rgba(255,255,255,0.6) !important; background: rgba(255,255,255,0.05) !important; }
      `}</style>
      <nav style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        height: 60,
        background: 'rgba(10,10,14,0.98)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}>
        {/* logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 9,
            background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(99,102,241,0.35)',
          }}>
            <span style={{ color: '#fff', fontWeight: 900, fontSize: 14, letterSpacing: '-0.5px' }}>M</span>
          </div>
          <span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700, fontSize: 16, letterSpacing: '-0.3px' }}>MealPlan</span>
        </div>

        {/* links */}
        <ul style={{ display: 'flex', alignItems: 'center', gap: 2, listStyle: 'none', margin: 0, padding: 0 }}>
          {links.map(({ href, label, Icon }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={`nav-link${active ? ' active' : ''}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '8px 16px', borderRadius: 10,
                    fontSize: 15, fontWeight: 600, textDecoration: 'none',
                    color: active ? '#fff' : 'rgba(255,255,255,0.32)',
                    background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
                  }}
                >
                  <Icon />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* sign out */}
        <button
          onClick={logout}
          className="logout-btn"
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 12px', borderRadius: 10, border: 'none', background: 'transparent',
            color: 'rgba(255,255,255,0.2)', fontSize: 15, fontWeight: 600, cursor: 'pointer',
          }}
        >
          <IconLogout />
          Sign out
        </button>
      </nav>
    </>
  );
}
