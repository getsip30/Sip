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
      <div style={{ maxWidth: 640, margin: '0 auto', animation: 'fadeInUp 0.5s ease-out' }}>
        <div style={{ marginBottom: 32 }}><Logo /></div>
        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 20 }}>Terms of Service</h1>
        <p style={{ color: MUTED, fontSize: 14, marginBottom: 24 }}>Last updated: {new Date().toLocaleDateString()}</p>
        <div style={{ color: MUTED, fontSize: 15, lineHeight: 1.8, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <p><strong style={{ color: TEXT }}>Eligibility:</strong> you must be 13 or older to use Sip. By creating an account, you agree to use the platform respectfully and follow our Code of Conduct during every session.</p>

          <p><strong style={{ color: TEXT }}>Accounts:</strong> you're responsible for activity under your account. Don't impersonate others or share your login.</p>

          <p><strong style={{ color: TEXT }}>Mentor advice isn't verified:</strong> mentors on Sip are individuals sharing their own experience and opinions. We don't vet, credential, or endorse the advice given by any mentor. Nothing shared on Sip is professional, legal, financial, or medical advice, and you shouldn't treat it as such.</p>

          <p><strong style={{ color: TEXT }}>User content:</strong> questions, answers, sip notes, and profile bios are your content. You're responsible for what you post, and we can remove content or suspend accounts that violate our Code of Conduct.</p>

          <p><strong style={{ color: TEXT }}>Video calls:</strong> live sessions run through Jitsi, a third-party video service, not infrastructure we host ourselves. We aren't responsible for outages or issues on their end.</p>

          <p><strong style={{ color: TEXT }}>Reporting:</strong> our flag system exists to keep sessions safe. Filing knowingly false reports against another user is itself a violation of these terms and can result in suspension.</p>

          <p><strong style={{ color: TEXT }}>Conduct:</strong> harassment, recording without consent, or inappropriate behavior during a session can result in suspension or a permanent ban, with no refund of any paid features.</p>

          <p><strong style={{ color: TEXT }}>Availability:</strong> Sip is provided as-is. We don't guarantee mentor availability or uninterrupted service.</p>

          <p><strong style={{ color: TEXT }}>Limitation of liability:</strong> to the fullest extent permitted by law, Sip isn't liable for indirect, incidental, or consequential damages arising from your use of the platform, including anything said or done by another user during a session.</p>

          <p><strong style={{ color: TEXT }}>Termination:</strong> we can suspend or terminate accounts that violate these terms or our Code of Conduct. You can delete your account at any time.</p>

          <p><strong style={{ color: TEXT }}>Governing law:</strong> these terms are governed by the laws of Ontario, Canada.</p>

          <p><strong style={{ color: TEXT }}>Changes:</strong> we may update these terms as the product evolves. Continued use means you accept the current version.</p>
        </div>
        <Link href="/" style={{ color: LINK, textDecoration: 'none', fontSize: 14, display: 'block', marginTop: 32 }}>← back home</Link>
      </div>
    </div>
  );
}