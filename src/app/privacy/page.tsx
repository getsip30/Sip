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
      <div style={{ maxWidth: 640, margin: '0 auto', animation: 'fadeInUp 0.5s ease-out' }}>
        <div style={{ marginBottom: 32 }}><Logo /></div>
        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 20 }}>Privacy Policy</h1>
        <p style={{ color: MUTED, fontSize: 14, marginBottom: 24 }}>Last updated: {new Date().toLocaleDateString()}</p>
        <div style={{ color: MUTED, fontSize: 15, lineHeight: 1.8, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <p><strong style={{ color: TEXT }}>Who we are:</strong> Sip is operated out of Ontario, Canada, and is governed primarily by Canadian privacy law (PIPEDA). If you're located outside Canada, your information may be processed in Canada and the United States, where our service providers operate.</p>

          <p><strong style={{ color: TEXT }}>What we collect:</strong> your name, email, and profile info you provide (bio, topics, availability, age, interests, LinkedIn if you choose to share it). We also log session activity, including who joined which room, when, questions and answers exchanged, sip notes, and any reports filed, for safety, moderation, and to run the core product.</p>

          <p><strong style={{ color: TEXT }}>AI matching:</strong> if you use the mentor-matching search, your query text is sent to Groq, a third-party AI provider, to find relevant mentors. We don't use this to build an advertising profile of you.</p>

          <p><strong style={{ color: TEXT }}>How we use it:</strong> to match you with mentors or seekers, run the live queue, send you notifications about requests and matches, and investigate reports if something goes wrong during a session.</p>

          <p><strong style={{ color: TEXT }}>Who we share it with:</strong> we work with a small set of service providers to run Sip: Clerk (accounts and login), Neon (database hosting), Vercel (application hosting), Resend (sending you email), Sentry (catching and fixing bugs), Groq (AI mentor matching), and Jitsi (video calls, via their public meet.jit.si service). Each only receives the data needed to do its job. We don't sell your data, and we never will.</p>

          <p><strong style={{ color: TEXT }}>Video calls:</strong> live sessions run through Jitsi, a third-party video service. We don't record calls ourselves. Screen recording or capturing by other participants can't be technically prevented on our end and is prohibited under our Code of Conduct.</p>

          <p><strong style={{ color: TEXT }}>How long we keep it:</strong> we keep your data while your account is active. If you delete your account, we remove your personal data within 30 days, except where we're required to retain records longer (for example, to investigate an active safety report).</p>

          <p><strong style={{ color: TEXT }}>Your rights:</strong> you can ask us to access, correct, or delete your personal data at any time by emailing us. If you're in the EU/UK, you also have the right to data portability and to object to certain processing. If you're in California, you have the right to know what categories of data we hold and to opt out of any "sale or sharing" of your data. We don't sell or share your data with anyone for advertising, so there's nothing to opt out of.</p>

          <p><strong style={{ color: TEXT }}>Age:</strong> Sip is intended for users 13 and older. If you're under 18, we encourage you to loop in a parent or guardian before using the platform.</p>

          <p><strong style={{ color: TEXT }}>Email:</strong> emails we send you (request updates, live-session alerts, weekly check-ins) are tied to your use of the platform. Every email identifies us clearly and gives you a way to stop receiving that type of notification, in line with Canada's Anti-Spam Legislation (CASL).</p>

          <p><strong style={{ color: TEXT }}>Security:</strong> we use industry-standard measures, including encrypted connections, access controls, and monitoring, to protect your data. No system is perfectly secure, but we take this seriously.</p>

          <p><strong style={{ color: TEXT }}>If something goes wrong:</strong> in the event of a data breach that affects you, we'll notify you and, where legally required, the relevant regulator, without undue delay.</p>

          <p><strong style={{ color: TEXT }}>Contact:</strong> questions about your data, or requests to access/correct/delete it, go to m.shahmeer.khan8@gmail.com.</p>
        </div>
        <Link href="/" style={{ color: LINK, textDecoration: 'none', fontSize: 14, display: 'block', marginTop: 32 }}>← back home</Link>
      </div>
    </div>
  );
}