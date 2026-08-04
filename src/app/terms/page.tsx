import type { Metadata } from 'next';
import { BG, TEXT, MUTED, LINK } from '@/lib/theme';
import Logo from '@/components/Logo';
import Footer from '@/components/Footer';
import Link from 'next/link';
import { canonical, absoluteUrl } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'The terms for using Sip: who is eligible, what mentors are and are not responsible for, how accounts are suspended, and the law these terms are governed by.',
  alternates: canonical('/terms'),
  openGraph: {
    title: 'Terms of Service | Sip',
    description: 'The terms for using Sip.',
    url: absoluteUrl('/terms'),
    type: 'article',
  },
  robots: { index: true, follow: true },
};

/**
 * Edited by hand when the policy is actually edited. See the note where it is
 * rendered for why this is not derived from the current date.
 */
/**
 * Each clause had its label bolded inside the paragraph, so the whole document
 * was one h1 followed by a wall of <p>. That gives a screen-reader user no way
 * to jump between clauses — heading navigation is the primary way a long policy
 * is read non-visually — and gives search engines no structure for a document
 * where "how long we keep it" or "governing law" is exactly what someone
 * searched for.
 *
 * They are real section headings and are marked up as such. The label now sits
 * on its own line rather than running into the sentence, which is a small
 * deliberate visual change: a heading that is not on its own line is not doing
 * a heading's job for a sighted reader either.
 */
const sectionHeading: React.CSSProperties = {
  color: TEXT,
  fontSize: 15,
  fontWeight: 700,
  marginBottom: 6,
};

const LAST_UPDATED = '2026-08-03';
const LAST_UPDATED_LABEL = 'August 3, 2026';

export default function Terms() {
  return (
    <div style={{ background: BG, minHeight: '100vh', color: TEXT, fontFamily: "var(--font-space-grotesk), 'Space Grotesk', sans-serif", paddingTop: 80, display: 'flex', flexDirection: 'column' }}>
      <main id="main-content" style={{ maxWidth: 640, margin: '0 auto', padding: '0 20px 60px', width: '100%', boxSizing: 'border-box', animation: 'fadeInUp 0.5s ease-out' }}>
        <div style={{ marginBottom: 32 }}><Logo /></div>
        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 20 }}>Terms of Service</h1>
        {/*
          Was `new Date()`, which rendered today's date on every request. That
          told every reader the policy had been revised today, told crawlers the
          page changes daily when it has not changed in months, and — because
          toLocaleDateString formats against the runtime's locale — could differ
          between server and client. A real constant, edited when the policy
          is actually edited, is the only honest version of this line.
        */}
        <p style={{ color: MUTED, fontSize: 14, marginBottom: 24 }}>
          Last updated: <time dateTime={LAST_UPDATED}>{LAST_UPDATED_LABEL}</time>
        </p>
        <div style={{ color: MUTED, fontSize: 15, lineHeight: 1.8, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <section>
            <h2 style={sectionHeading}>Eligibility</h2>
            <p>You must be 13 or older to use Sip. By creating an account, you agree to use the platform respectfully and follow our Code of Conduct during every session.</p>
          </section>

          <section>
            <h2 style={sectionHeading}>Accounts</h2>
            <p>You're responsible for activity under your account. Don't impersonate others or share your login.</p>
          </section>

          <section>
            <h2 style={sectionHeading}>Mentor advice isn't verified</h2>
            <p>Mentors on Sip are individuals sharing their own experience and opinions. We don't vet, credential, or endorse the advice given by any mentor. Nothing shared on Sip is professional, legal, financial, or medical advice, and you shouldn't treat it as such.</p>
          </section>

          <section>
            <h2 style={sectionHeading}>User content</h2>
            <p>Questions, answers, sip notes, and profile bios are your content. You're responsible for what you post, and we can remove content or suspend accounts that violate our Code of Conduct.</p>
          </section>

          <section>
            <h2 style={sectionHeading}>Video calls</h2>
            <p>Live sessions run through Jitsi, a third-party video service, not infrastructure we host ourselves. We aren't responsible for outages or issues on their end.</p>
          </section>

          <section>
            <h2 style={sectionHeading}>Reporting</h2>
            <p>Our flag system exists to keep sessions safe. Filing knowingly false reports against another user is itself a violation of these terms and can result in suspension.</p>
          </section>

          <section>
            <h2 style={sectionHeading}>Conduct</h2>
            <p>Harassment, recording without consent, or inappropriate behavior during a session can result in suspension or a permanent ban, with no refund of any paid features.</p>
          </section>

          <section>
            <h2 style={sectionHeading}>Availability</h2>
            <p>Sip is provided as-is. We don't guarantee mentor availability or uninterrupted service.</p>
          </section>

          <section>
            <h2 style={sectionHeading}>Limitation of liability</h2>
            <p>To the fullest extent permitted by law, Sip isn't liable for indirect, incidental, or consequential damages arising from your use of the platform, including anything said or done by another user during a session.</p>
          </section>

          <section>
            <h2 style={sectionHeading}>Termination</h2>
            <p>We can suspend or terminate accounts that violate these terms or our Code of Conduct. You can delete your account at any time.</p>
          </section>

          <section>
            <h2 style={sectionHeading}>Governing law</h2>
            <p>These terms are governed by the laws of Ontario, Canada.</p>
          </section>

          <section>
            <h2 style={sectionHeading}>Changes</h2>
            <p>We may update these terms as the product evolves. Continued use means you accept the current version.</p>
          </section>
        </div>
        <Link href="/" style={{ color: LINK, textDecoration: 'none', fontSize: 14, display: 'block', marginTop: 32 }}>← back home</Link>
      </main>
      <Footer />
    </div>
  );
}