import type { Metadata } from 'next';
import { BG, TEXT, MUTED, LINK } from '@/lib/theme';
import Logo from '@/components/Logo';
import Footer from '@/components/Footer';
import Link from 'next/link';
import { canonical, absoluteUrl } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Code of Conduct',
  description:
    'The rules every session on Sip runs by: no recording without consent, no harassment, show up when you say you will. How reports are handled and what happens when they are upheld.',
  alternates: canonical('/conduct'),
  openGraph: {
    title: 'Code of Conduct | Sip',
    description: 'The rules every session on Sip runs by.',
    url: absoluteUrl('/conduct'),
    type: 'article',
  },
  robots: { index: true, follow: true },
};

export default function Conduct() {
  return (
    <div style={{ background: BG, minHeight: '100vh', color: TEXT, fontFamily: "var(--font-space-grotesk), 'Space Grotesk', sans-serif", paddingTop: 60, display: 'flex', flexDirection: 'column' }}>
      {/*
        This container had a max-width and auto margins but no horizontal
        padding, unlike every other legal page. On a screen narrower than 640px
        the text ran flush into both edges with nothing between it and the
        bezel. Mobile-first indexing means the phone rendering is the one Google
        judges, so a layout defect here is not only a usability problem.
        `id="main-content"` was also missing, which broke the skip link that the
        root layout renders on every page.
      */}
      <main id="main-content" style={{ maxWidth: 640, margin: '0 auto', padding: '0 20px 60px', width: '100%', boxSizing: 'border-box', animation: 'fadeInUp 0.5s ease-out' }}>
        <div style={{ marginBottom: 32 }}><Logo /></div>
        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 20 }}>Code of Conduct</h1>
        <div style={{ color: MUTED, fontSize: 15, lineHeight: 1.8, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p>Every session on Sip is between real people. Treat it that way.</p>
          <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <li>No recording, screenshotting, or sharing any part of a call without explicit consent from everyone involved.</li>
            <li>No harassment, discrimination, or inappropriate language or behavior.</li>
            <li>Show up when you say you will. Repeated no-shows can affect your standing.</li>
            <li>Use the flag button if something feels wrong. reports are reviewed, not ignored.</li>
            <li>Violations can result in a warning, suspension, or permanent ban depending on severity.</li>
          </ul>
        </div>
        <Link href="/" style={{ color: LINK, textDecoration: 'none', fontSize: 14, display: 'block', marginTop: 32 }}>← back home</Link>
      </main>
      <Footer />
    </div>
  );
}