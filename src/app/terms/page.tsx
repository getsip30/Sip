import type { Metadata } from 'next';
import { BG, TEXT, MUTED, LINK } from '@/lib/theme';
import Logo from '@/components/Logo';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms and conditions for using Sip.',
  robots: { index: true, follow: true },
};

export default function Terms() {
  return (
    <div style={{ background: BG, minHeight: '100vh', color: TEXT, fontFamily: "'Space Grotesk', sans-serif", padding: '80px 40px' }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ marginBottom: 32 }}><Logo /></div>
        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 20 }}>Terms of Service</h1>
        <p style={{ color: MUTED, fontSize: 14, marginBottom: 24 }}>Last updated: {new Date().toLocaleDateString()}</p>
        <div style={{ color: MUTED, fontSize: 15, lineHeight: 1.8, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <p><strong style={{ color: TEXT }}>Using Sip:</strong> by creating an account, you agree to use the platform respectfully and follow our Code of Conduct during every session.</p>
          <p><strong style={{ color: TEXT }}>Accounts:</strong> you&apos;re responsible for activity under your account. Don&apos;t impersonate others or share your login.</p>
          <p><strong style={{ color: TEXT }}>Conduct:</strong> harassment, recording without consent, or inappropriate behavior during a session can result in suspension or a permanent ban, with no refund of any paid features.</p>
          <p><strong style={{ color: TEXT }}>Availability:</strong> Sip is provided as-is. We don&apos;t guarantee mentor availability or uninterrupted service.</p>
          <p><strong style={{ color: TEXT }}>Changes:</strong> we may update these terms as the product evolves. Continued use means you accept the current version.</p>
        </div>
        <Link href="/" style={{ color: LINK, textDecoration: 'none', fontSize: 14, display: 'block', marginTop: 32 }}>← back home</Link>
      </div>
    </div>
  );
}