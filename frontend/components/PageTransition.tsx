'use client';

import { usePathname } from 'next/navigation';

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div
      key={pathname}
      style={{
        animation: 'pageTransitionIn 0.32s cubic-bezier(0.4, 0, 0.2, 1) both',
        minHeight: '100%',
      }}
    >
      {children}
    </div>
  );
}
