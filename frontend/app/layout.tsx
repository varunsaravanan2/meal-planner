import type { Metadata } from 'next';
import { Inter, Nunito } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-inter',
});

const nunito = Nunito({
  subsets: ['latin'],
  weight: ['700', '800', '900'],
  variable: '--font-nunito',
});

export const metadata: Metadata = {
  title: 'Meal Planner',
  description: 'Plan meals from your saved recipes',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${nunito.variable} h-full`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem('theme');document.documentElement.dataset.theme=(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches))?'dark':'light'}catch(e){}` }} />
      </head>
      <body className="h-full antialiased"><ThemeProvider>{children}</ThemeProvider></body>
    </html>
  );
}
