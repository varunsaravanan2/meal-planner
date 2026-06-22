import type { Metadata } from 'next';
import { Lora, Raleway } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';

const lora = Lora({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-lora',
});

const raleway = Raleway({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-raleway',
});

export const metadata: Metadata = {
  title: 'Meal Planner',
  description: 'Plan meals from your saved recipes',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${lora.variable} ${raleway.variable} h-full`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem('theme');document.documentElement.dataset.theme=(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches))?'dark':'light'}catch(e){}` }} />
      </head>
      <body className="h-full antialiased"><ThemeProvider>{children}</ThemeProvider></body>
    </html>
  );
}
