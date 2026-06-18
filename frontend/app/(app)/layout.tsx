import NavLinks from '@/components/NavLinks';
import ProfileGate from '@/components/ProfileGate';
import PageTransition from '@/components/PageTransition';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProfileGate>
      <div className="flex flex-col h-screen overflow-hidden" style={{ background: '#edf1f7' }}>
        <header className="w-full" style={{ background: '#0a0a0a' }}>
          <NavLinks />
        </header>
        <main className="flex-1 overflow-y-auto">
          <PageTransition>
            {children}
          </PageTransition>
        </main>
      </div>
    </ProfileGate>
  );
}
