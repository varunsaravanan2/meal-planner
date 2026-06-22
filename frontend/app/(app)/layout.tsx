import NavLinks from '@/components/NavLinks';
import ProfileGate from '@/components/ProfileGate';
import PageTransition from '@/components/PageTransition';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProfileGate>
      <NavLinks />
      <main style={{ paddingTop: 80 }}>
        <PageTransition>
          {children}
        </PageTransition>
      </main>
    </ProfileGate>
  );
}
