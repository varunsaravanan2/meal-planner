'use client';

import { usePathname } from 'next/navigation';

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div
      key={pathname}
      style={{
        animation: 'pageTransitionIn 0.28s ease both',
        minHeight: '100%',
      }}
    >
      {children}
    </div>
  );
}
