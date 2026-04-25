import type { Metadata } from 'next';
import { Geist, Geist_Mono, Inter } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
});

// DESIGN.md — "Body & UI (The Workhorse)" with cv01 + ss03 OpenType features
const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'Catalyst Scout — AI Talent Scouting Agent',
  description:
    'An AI-powered talent scouting command center. Paste a job description and let the LangGraph agent retrieve, simulate, and rank the best-fit candidates in seconds.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} h-full antialiased`}
    >
      {/* DESIGN.md: bg-[#050507] on the body */}
      <body className="h-full bg-[#050507] text-[#f7f8f8]">{children}</body>
    </html>
  );
}
