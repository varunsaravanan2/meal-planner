import NavLinks from '@/components/NavLinks';
import ProfileGate from '@/components/ProfileGate';
import PageTransition from '@/components/PageTransition';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProfileGate>
      <NavLinks />
      <main className="pt-4 pb-[calc(env(safe-area-inset-bottom)+88px)] sm:pt-20 sm:pb-0">
        <PageTransition>
          {children}
        </PageTransition>
      </main>
    </ProfileGate>
  );
}
