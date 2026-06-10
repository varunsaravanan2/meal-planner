'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logout } from '@/lib/api';

function IconCalendar() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  );
}

function IconBook() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
  );
}

function IconBag() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
      <line x1="3" y1="6" x2="21" y2="6"/>
      <path d="M16 10a4 4 0 0 1-8 0"/>
    </svg>
  );
}

function IconPantry() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3h18v4H3z"/>
      <path d="M3 7v13a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V7"/>
      <line x1="9" y1="12" x2="15" y2="12"/>
    </svg>
  );
}

function IconProfile() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4"/>
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
    </svg>
  );
}

function IconLogout() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  );
}

const links = [
  { href: '/dashboard',     label: 'Plan',          Icon: IconCalendar },
  { href: '/recipes',       label: 'Recipes',        Icon: IconBook     },
  { href: '/shopping-list', label: 'Shopping',       Icon: IconBag      },
  { href: '/pantry',        label: 'Pantry',          Icon: IconPantry   },
  { href: '/profile',       label: 'Profile',         Icon: IconProfile  },
];

export default function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center justify-between px-6" style={{ background: '#0d0d0d', height: 64, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>

      {/* Logo */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center justify-center rounded-lg text-white font-black text-sm" style={{ width: 30, height: 30, background: '#494fdf' }}>
          M
        </div>
        <span className="text-sm font-bold tracking-tight text-white opacity-80">MealPlan</span>
      </div>

      {/* Nav links */}
      <ul className="flex items-center gap-0.5">
        {links.map(({ href, label, Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
          return (
            <li key={href}>
              <Link
                href={href}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
                style={active
                  ? { background: 'rgba(255,255,255,0.08)', color: '#fff' }
                  : { color: 'rgba(255,255,255,0.35)' }
                }
                onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'rgba(255,255,255,0.65)'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; }}
              >
                <Icon />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Sign out */}
      <button
        onClick={logout}
        className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-colors"
        style={{ color: 'rgba(255,255,255,0.22)' }}
        onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.55)'}
        onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.22)'}
      >
        <IconLogout />
        Sign out
      </button>
    </nav>
  );
}
