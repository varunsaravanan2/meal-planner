'use client';

import { logout } from '@/lib/api';
import { NavBar } from '@/components/ui/tubelight-navbar';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { LayoutDashboard, Calendar, BookOpen, Dumbbell, ShoppingBag, Package, CreditCard, TrendingUp, User, LogOut } from 'lucide-react';

const tubelightItems = [
  { name: 'Dashboard', url: '/home',         icon: LayoutDashboard },
  { name: 'Plan',      url: '/dashboard',    icon: Calendar    },
  { name: 'Recipes',  url: '/recipes',       icon: BookOpen    },
  { name: 'Workouts', url: '/workouts',      icon: Dumbbell    },
  { name: 'Shopping', url: '/shopping-list', icon: ShoppingBag },
  { name: 'Pantry',   url: '/pantry',        icon: Package     },
  { name: 'Plans',    url: '/pricing',       icon: CreditCard  },
  { name: 'Progress', url: '/progress',      icon: TrendingUp  },
  { name: 'Profile',  url: '/profile',       icon: User        },
];

export default function NavLinks() {
  return (
    <>
      <NavBar items={tubelightItems} />
      <div style={{
        position: 'fixed', top: 14, right: 20, zIndex: 51,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <ThemeToggle />
        <button
          onClick={logout}
          title="Sign out"
          style={{
            width: 36, height: 36, borderRadius: 10, border: 'none',
            background: 'rgba(10,10,14,0.85)', color: 'rgba(255,255,255,0.35)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(12px)',
          }}
        >
          <LogOut size={15} strokeWidth={2} />
        </button>
      </div>
    </>
  );
}
