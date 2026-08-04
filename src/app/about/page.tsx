import type { Metadata } from 'next';
import { BG, TEXT, MUTED, LINK } from '@/lib/theme';
import Logo from '@/components/Logo';
import Footer from '@/components/Footer';
import Link from 'next/link';
import { jsonLdScript } from '@/lib/utils';
import { canonical, absoluteUrl, graph, breadcrumbJsonLd, ORGANIZATION_ID, WEBSITE_ID } from '@/lib/site';

export const metadata: Metadata = {
  title: 'About Sip: why cold outreach does not work',
  description:
    'Why Sip exists, who it is for, and how live mentorship conversations work. Built so students can talk to people doing the job instead of sending messages that never get answered.',
  alternates: canonical('/about'),
  openGraph: {
    title: 'About Sip',
    description: 'Why cold outreach does not work, and what we built instead.',
    url: absoluteUrl('/about'),
    type: 'website',
  },
};

const para: React.CSSProperties = { color: MUTED, fontSize: 15.5, lineHeight: 1.85, marginBottom: 18 };
const h2: React.CSSProperties = { fontSize: 22, fontWeight: 700, letterSpacing: -0.5, margin: '40px 0 14px', color: TEXT };

/**
 * This page was two paragraphs and a back link — roughly ninety words, which is
 * a thin page by any measure and gave search engines almost nothing to work
 * with on a URL that is usually one of the most-linked on a site.
 *
 * It was also a dead end for crawling: the only outbound link went home. An
 * about page is a natural hub, and it now links to the directory, the mentor
 * signup, the answers archive and the conduct policy, which is how a crawler
 * finds them and how a reader who is still deciding gets to the next step.
 */
export default function About() {
  const jsonLd = graph(
    {
      '@type': 'AboutPage',
      '@id': `${absoluteUrl('/about')}#webpage`,
      url: absoluteUrl('/about'),
      name: 'About Sip',
      description: 'Why Sip exists, who it is for, and how live mentorship conversations work.',
      isPartOf: { '@id': WEBSITE_ID },
      about: { '@id': ORGANIZATION_ID },
      inLanguage: 'en',
    },
    breadcrumbJsonLd([
      { name: 'Home', path: '/' },
      { name: 'About', path: '/about' },
    ]),
  );

  return (
    <div style={{ background: BG, minHeight: '100vh', color: TEXT, fontFamily: "var(--font-space-grotesk), 'Space Grotesk', sans-serif", paddingTop: 60, display: 'flex', flexDirection: 'column' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />

      <main id="main-content" style={{ maxWidth: 680, margin: '0 auto', padding: '0 20px 60px', width: '100%', boxSizing: 'border-box', animation: 'fadeInUp 0.5s ease-out' }}>
        <div style={{ marginBottom: 32 }}><Logo /></div>

        <h1 style={{ fontSize: 34, fontWeight: 700, letterSpacing: -1, marginBottom: 20 }}>About Sip</h1>

        <p style={para}>
          Sip exists because cold outreach doesn&apos;t work. Most people trying to break into a field
          send messages that are never answered, or wait days for a scheduled call that could have
          been a five-minute conversation. The advice they need exists — it is sitting with someone
          three years ahead of them who would happily give twenty minutes if anyone made it easy.
        </p>
        <p style={para}>
          We built a place where mentors show up when they are actually free, and where students can
          join a live queue instead of sending a message into the void. No scheduling links, no
          waiting on replies, no wondering whether the silence means no.
        </p>

        <h2 style={h2}>Who Sip is for</h2>
        <p style={para}>
          Students working out what to do next, people early in a career who want to hear how someone
          else got where they are, and career changers who need a realistic account of a field before
          they commit to it. On the other side: professionals who are willing to answer the questions
          they once had, on their own terms and on their own schedule.
        </p>
        <p style={para}>
          You need to be 13 or older to use Sip. It is free for everyone — nobody is charged and
          nobody is paid. Removing the awkward first step is the entire product.
        </p>

        <h2 style={h2}>How a conversation actually happens</h2>
        <p style={para}>
          You describe what you are stuck on in a sentence. Sip matches that against mentors who are
          currently taking conversations and shows you who fits, with their real job, real company,
          and the specific topics they agreed to talk about. From there you either join a live room
          and take your place in the queue, or send a request and agree a time. Most first
          conversations happen within the week.
        </p>
        <p style={para}>
          Nothing is one-sided. Mentors see a request before committing to anything and decline in
          one click, which is exactly why they are willing to be listed at all.
        </p>

        <h2 style={h2}>What we care about</h2>
        <p style={para}>
          A mentorship platform is only as good as how safe it feels to show up on it. Sessions are
          governed by a <Link href="/conduct" style={{ color: LINK }}>code of conduct</Link> that
          every account agrees to, reports are reviewed rather than filed away, and contact details
          are never released to the other side until someone chooses to share them. What we collect
          and why is written plainly in the{' '}
          <Link href="/privacy" style={{ color: LINK }}>privacy policy</Link>.
        </p>

        <h2 style={h2}>Where to start</h2>
        <p style={para}>
          Browse the <Link href="/seekers" style={{ color: LINK }}>mentor directory</Link> to see who
          is available, read{' '}
          <Link href="/answers" style={{ color: LINK }}>questions other people have asked</Link> and
          the answers they got, or{' '}
          <Link href="/mentors/signup" style={{ color: LINK }}>list yourself as a mentor</Link> if you
          are the one with the answers.
        </p>

        <p style={{ marginTop: 36 }}>
          <Link href="/" style={{ color: LINK, textDecoration: 'none', fontSize: 14 }}>← back home</Link>
        </p>
      </main>

      <Footer />
    </div>
  );
}
