import type { Metadata } from 'next';
import { BG, TEXT, MUTED, LINK } from '@/lib/theme';
import Logo from '@/components/Logo';
import Footer from '@/components/Footer';
import Link from 'next/link';
import { canonical, absoluteUrl } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'What Sip collects, who we share it with, how long we keep it, and how to have it deleted. Written plainly, governed by Canadian privacy law (PIPEDA).',
  alternates: canonical('/privacy'),
  openGraph: {
    title: 'Privacy Policy | Sip',
    description: 'What we collect, who we share it with, and how to have it deleted.',
    url: absoluteUrl('/privacy'),
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

export default function Privacy() {
  return (
    <div style={{ background: BG, minHeight: '100vh', color: TEXT, fontFamily: "var(--font-space-grotesk), 'Space Grotesk', sans-serif", paddingTop: 80, display: 'flex', flexDirection: 'column' }}>
      <main id="main-content" style={{ maxWidth: 640, margin: '0 auto', padding: '0 20px 60px', width: '100%', boxSizing: 'border-box', animation: 'fadeInUp 0.5s ease-out' }}>
        <div style={{ marginBottom: 32 }}><Logo /></div>
        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 20 }}>Privacy Policy</h1>
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
            <h2 style={sectionHeading}>Who we are</h2>
            <p>Sip is operated out of Ontario, Canada, and is governed primarily by Canadian privacy law (PIPEDA). If you're located outside Canada, your information may be processed in Canada and the United States, where our service providers operate.</p>
          </section>

          <section>
            <h2 style={sectionHeading}>What we collect</h2>
            <p>Your name, email, and profile info you provide (bio, topics, availability, age, interests, LinkedIn if you choose to share it). We also log session activity, including who joined which room, when, questions and answers exchanged, sip notes, and any reports filed, for safety, moderation, and to run the core product.</p>
          </section>

          <section>
            <h2 style={sectionHeading}>AI matching</h2>
            <p>If you use the mentor-matching search, your query text is sent to Groq, a third-party AI provider, to find relevant mentors. We don't use this to build an advertising profile of you.</p>
          </section>

          <section>
            <h2 style={sectionHeading}>How we use it</h2>
            <p>To match you with mentors or seekers, run the live queue, send you notifications about requests and matches, and investigate reports if something goes wrong during a session.</p>
          </section>

          <section>
            <h2 style={sectionHeading}>Who we share it with</h2>
            <p>We work with a small set of service providers to run Sip: Clerk (accounts and login), Neon (database hosting), Vercel (application hosting), Resend (sending you email), Sentry (catching and fixing bugs), Groq (AI mentor matching), and Jitsi (video calls, via their public meet.jit.si service). Each only receives the data needed to do its job. We don't sell your data, and we never will.</p>
          </section>

          <section>
            <h2 style={sectionHeading}>Video calls</h2>
            <p>Live sessions run through Jitsi, a third-party video service. We don't record calls ourselves. Screen recording or capturing by other participants can't be technically prevented on our end and is prohibited under our Code of Conduct.</p>
          </section>

          <section>
            <h2 style={sectionHeading}>How long we keep it</h2>
            <p>We keep your data while your account is active. If you delete your account, we remove your personal data within 30 days, except where we're required to retain records longer (for example, to investigate an active safety report).</p>
          </section>

          <section>
            <h2 style={sectionHeading}>Your rights</h2>
            <p>You can ask us to access, correct, or delete your personal data at any time by emailing us. If you're in the EU/UK, you also have the right to data portability and to object to certain processing. If you're in California, you have the right to know what categories of data we hold and to opt out of any "sale or sharing" of your data. We don't sell or share your data with anyone for advertising, so there's nothing to opt out of.</p>
          </section>

          <section>
            <h2 style={sectionHeading}>Age</h2>
            <p>Sip is intended for users 13 and older. If you're under 18, we encourage you to loop in a parent or guardian before using the platform.</p>
          </section>

          <section>
            <h2 style={sectionHeading}>Email</h2>
            <p>Emails we send you (request updates, live-session alerts, weekly check-ins) are tied to your use of the platform. Every email identifies us clearly and gives you a way to stop receiving that type of notification, in line with Canada's Anti-Spam Legislation (CASL).</p>
          </section>

          <section>
            <h2 style={sectionHeading}>Security</h2>
            <p>We use industry-standard measures, including encrypted connections, access controls, and monitoring, to protect your data. No system is perfectly secure, but we take this seriously.</p>
          </section>

          <section>
            <h2 style={sectionHeading}>If something goes wrong</h2>
            <p>In the event of a data breach that affects you, we'll notify you and, where legally required, the relevant regulator, without undue delay.</p>
          </section>

          <section>
            <h2 style={sectionHeading}>Contact</h2>
            <p>Questions about your data, or requests to access/correct/delete it, go to m.shahmeer.khan8@gmail.com.</p>
          </section>
        </div>
        <Link href="/" style={{ color: LINK, textDecoration: 'none', fontSize: 14, display: 'block', marginTop: 32 }}>← back home</Link>
      </main>
      <Footer />
    </div>
  );
}