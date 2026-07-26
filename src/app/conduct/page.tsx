import type { Metadata } from 'next';
import { BG, TEXT, MUTED, LINK } from '@/lib/theme';
import Logo from '@/components/Logo';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Code of Conduct',
  description: 'Community guidelines for mentors and seekers on Sip.',
  robots: { index: true, follow: true },
};

export default function Conduct() {
  return (
    <div style={{ background: BG, minHeight: '100vh', color: TEXT, fontFamily: "'Space Grotesk', sans-serif", padding: '60px 20px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ marginBottom: 32 }}><Logo /></div>
        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 20 }}>Code of Conduct</h1>
        <div style={{ color: MUTED, fontSize: 15, lineHeight: 1.8, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p>Every session on Sip is between real people. Treat it that way.</p>
          <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <li>No recording, screenshotting, or sharing any part of a call without explicit consent from everyone involved.</li>
            <li>No harassment, discrimination, or inappropriate language or behavior.</li>
            <li>Show up when you say you will. Repeated no-shows can affect your standing.</li>
            <li>Use the flag button if something feels wrong — reports are reviewed, not ignored.</li>
            <li>Violations can result in a warning, suspension, or permanent ban depending on severity.</li>
          </ul>
        </div>
        <Link href="/" style={{ color: LINK, textDecoration: 'none', fontSize: 14, display: 'block', marginTop: 32 }}>← back home</Link>
      </div>
    </div>
  );
}