import type { Metadata } from 'next';
import { BG, TEXT, MUTED, LINK } from '@/lib/theme';
import Logo from '@/components/Logo';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Sip collects, uses, and protects your data.',
  robots: { index: true, follow: true },
};

export default function Privacy() {
  return (
    <div style={{ background: BG, minHeight: '100vh', color: TEXT, fontFamily: "'Space Grotesk', sans-serif", padding: '80px 40px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ marginBottom: 32 }}><Logo /></div>
        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 20 }}>Privacy Policy</h1>
        <p style={{ color: MUTED, fontSize: 14, marginBottom: 24 }}>Last updated: {new Date().toLocaleDateString()}</p>
        <div style={{ color: MUTED, fontSize: 15, lineHeight: 1.8, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <p><strong style={{ color: TEXT }}>What we collect:</strong> your name, email, and any profile info you provide (bio, topics, LinkedIn). We also log session activity — who joined which room, when, and any reports filed — for safety and moderation purposes.</p>
          <p><strong style={{ color: TEXT }}>How we use it:</strong> to match you with mentors or seekers, run the queue system, send you notifications, and investigate reports if something goes wrong during a session.</p>
          <p><strong style={{ color: TEXT }}>Video calls:</strong> calls run through a third-party video service. We do not record calls by default. Screen recording or capturing by other participants cannot be technically prevented and is prohibited under our Code of Conduct.</p>
          <p><strong style={{ color: TEXT }}>Data sharing:</strong> we don&apos;t sell your data. Information is only shared between matched mentors and seekers as needed to facilitate a session.</p>
          <p><strong style={{ color: TEXT }}>Contact:</strong> questions about your data, email m.shahmeer.khan8@gmail.com.</p>
        </div>
        <Link href="/" style={{ color: LINK, textDecoration: 'none', fontSize: 14, display: 'block', marginTop: 32 }}>← back home</Link>
      </div>
    </div>
  );
}