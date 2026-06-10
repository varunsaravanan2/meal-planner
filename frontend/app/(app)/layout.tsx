import NavLinks from '@/components/NavLinks';
import ProfileGate from '@/components/ProfileGate';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProfileGate>
      <div className="flex flex-col h-screen overflow-hidden" style={{ background: '#f4f4f4' }}>
        <header className="w-full" style={{ background: '#0a0a0a' }}>
          <NavLinks />
        </header>
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </ProfileGate>
  );
}
