'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getProfile, isLoggedIn } from '@/lib/api';

export default function ProfileGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoggedIn() || pathname === '/onboarding') return;
    getProfile().then(p => {
      if (!p) router.push('/onboarding');
    }).catch(() => {});
  }, [pathname, router]);

  return children;
}
