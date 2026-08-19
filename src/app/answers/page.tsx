import type { Metadata } from 'next';
import Link from 'next/link';
import { db } from '@/db';
import { asks, mentors } from '@/db/schema';
import { eq, and, desc, isNotNull, isNull } from 'drizzle-orm';
import Logo from '@/components/Logo';
import Footer from '@/components/Footer';
import { jsonLdScript } from '@/lib/utils';
import { canonical, graph, breadcrumbJsonLd, absoluteUrl, WEBSITE_ID, ORGANIZATION_ID } from '@/lib/site';
import { BG, SURFACE, TEXT, MUTED, LINK, ACCENT } from '@/lib/theme';

/**
 * This page had two independent problems, either of which alone meant it
 * produced no search value despite holding the best content on the site.
 *
 *  1. It was disallowed in robots.txt. It is public, consented, human-written
 *     Q&A between named professionals and students — exactly the kind of page
 *     that earns long-tail traffic — and it was being withheld from search.
 *
 *  2. It was a client component that fetched /api/asks/public from useEffect,
 *     so the server HTML contained the heading and the word "loading..." and
 *     nothing else. Even with robots.txt fixed there was nothing to index.
 *
 * It is now a server component reading the database directly, with the same
 * consent filters as the API route (which stays for any client caller). The
 * content is in the initial HTML, and each answered question is marked up so it
 * is eligible to surface on its own.
 */

export const metadata: Metadata = {
  title: 'Mentor Answers: real career questions, answered',
  description:
    'Real questions from students, answered by people doing the job. Honest answers about breaking into tech, internships, grad school and changing careers, from working professionals on Sip.',
  alternates: canonical('/answers'),
  openGraph: {
    title: 'Mentor Answers on Sip',
    description: 'Real career questions from students, answered by people doing the job.',
    url: absoluteUrl('/answers'),
    type: 'website',
  },
};

// Answers accumulate slowly and are approved by hand. Hourly is far fresher
// than the content changes, and keeps crawler traffic off the database.
export const revalidate = 3600;

type PublicAsk = {
  id: string;
  question: string;
  answer: string | null;
  seekerFirstName: string;
  answeredAt: Date | null;
  mentorId: string;
  mentorFirstName: string;
  mentorLastName: string;
  mentorRole: string;
  mentorCompany: string;
};

async function getAnswers(): Promise<PublicAsk[]> {
  return db
    .select({
      id: asks.id,
      question: asks.question,
      answer: asks.answer,
      seekerFirstName: asks.seekerName,
      answeredAt: asks.answeredAt,
      mentorId: mentors.id,
      mentorFirstName: mentors.firstName,
      mentorLastName: mentors.lastName,
      mentorRole: mentors.role,
      mentorCompany: mentors.company,
    })
    .from(asks)
    .innerJoin(mentors, eq(asks.mentorId, mentors.id))
    .where(
      and(
        eq(asks.status, 'answered'),
        eq(asks.seekerConsentToShow, true),
        eq(asks.mentorConsentToShow, true),
        // Both consent flags can be set before the answer is written. Without
        // this the page could render an empty answer body, which reads as a
        // broken page to a visitor and a thin one to a crawler.
        isNotNull(asks.answer),
        eq(mentors.banned, false),
        isNull(mentors.deletedAt),
      ),
    )
    .orderBy(desc(asks.answeredAt))
    .limit(50);
}

export default async function AnswersPage() {
  const answers = await getAnswers();

  // QAPage semantics rather than FAQPage: these are questions asked by one
  // person and answered by a named someone else, which is exactly the
  // distinction Google draws between the two types. Each answer carries its
  // author so the professional's name and job title can appear with it.
  const jsonLd = graph(
    {
      '@type': 'CollectionPage',
      '@id': `${absoluteUrl('/answers')}#collection`,
      url: absoluteUrl('/answers'),
      name: 'Mentor Answers',
      description: 'Real career questions from students, answered by working professionals on Sip.',
      isPartOf: { '@id': WEBSITE_ID },
      about: { '@id': ORGANIZATION_ID },
      inLanguage: 'en',
      mainEntity: {
        '@type': 'ItemList',
        numberOfItems: answers.length,
        itemListElement: answers.map((a, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          item: {
            '@type': 'Question',
            '@id': `${absoluteUrl('/answers')}#q-${a.id}`,
            name: a.question.length > 110 ? `${a.question.slice(0, 107).trim()}...` : a.question,
            text: a.question,
            answerCount: 1,
            ...(a.answeredAt ? { dateCreated: a.answeredAt.toISOString() } : {}),
            acceptedAnswer: {
              '@type': 'Answer',
              text: a.answer ?? '',
              url: `${absoluteUrl('/answers')}#q-${a.id}`,
              author: {
                '@type': 'Person',
                name: `${a.mentorFirstName} ${a.mentorLastName}`,
                jobTitle: a.mentorRole,
                url: absoluteUrl(`/mentors/${a.mentorId}`),
                worksFor: { '@type': 'Organization', name: a.mentorCompany },
              },
            },
          },
        })),
      },
    },
    breadcrumbJsonLd([
      { name: 'Home', path: '/' },
      { name: 'Answers', path: '/answers' },
    ]),
  );

  return (
    <div style={{ background: BG, minHeight: '100vh', color: TEXT, display: 'flex', flexDirection: 'column' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />

      <nav style={{ padding: '0 16px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <Logo size={44} />
        <Link href="/sign-up" style={{ background: ACCENT, color: 'white', padding: '8px 20px', borderRadius: 20, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>sign up</Link>
      </nav>

      <main id="main-content" style={{ maxWidth: 720, margin: '0 auto', padding: '60px 24px 100px', width: '100%', boxSizing: 'border-box' }}>
        <h1 style={{ fontSize: 34, fontWeight: 700, letterSpacing: -1.5, marginBottom: 8 }}>
          Real questions, real answers
        </h1>
        <p style={{ color: MUTED, fontSize: 15, lineHeight: 1.7, marginBottom: 40 }}>
          Quick questions students asked mentors on Sip, answered by people actually doing the job.
          Both sides agreed to share these. To ask your own, find someone on the{' '}
          <Link href="/seekers" style={{ color: LINK }}>mentor directory</Link> and send it over.
        </p>

        {answers.length === 0 ? (
          <p style={{ color: MUTED, fontSize: 15, lineHeight: 1.7 }}>
            No public answers yet. Mentors and seekers both have to agree before a question shows up
            here, so this fills up slowly.{' '}
            <Link href="/seekers" style={{ color: LINK }}>Browse mentors</Link> in the meantime.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {answers.map(a => (
              // An id per entry so a search result can deep-link to the specific
              // answer, matching the @id used in the structured data above.
              <article key={a.id} id={`q-${a.id}`} style={{ background: SURFACE, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 22 }}>
                <h2 style={{ fontWeight: 600, fontSize: 16, lineHeight: 1.5, marginBottom: 10 }}>{a.question}</h2>
                <div style={{ color: MUTED, fontSize: 13, marginBottom: 14 }}>
                  Asked by {a.seekerFirstName}
                  {a.answeredAt && (
                    <>
                      {' · '}
                      <time dateTime={a.answeredAt.toISOString()}>
                        {a.answeredAt.toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </time>
                    </>
                  )}
                </div>
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14 }}>
                  <Link href={`/mentors/${a.mentorId}`} style={{ color: LINK, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                    {a.mentorFirstName} {a.mentorLastName} · {a.mentorRole} at {a.mentorCompany}
                  </Link>
                  <p style={{ color: TEXT, fontSize: 14.5, lineHeight: 1.7, marginTop: 10, whiteSpace: 'pre-wrap' }}>{a.answer}</p>
                </div>
              </article>
            ))}
          </div>
        )}

        <aside style={{ marginTop: 48, background: 'linear-gradient(135deg, rgba(10,102,194,0.12), rgba(112,181,249,0.04))', border: '1px solid rgba(112,181,249,0.25)', borderRadius: 20, padding: '28px 20px', textAlign: 'center' }}>
          <h2 style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Got your own question?</h2>
          <p style={{ color: MUTED, fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
            Ask someone who has already done it. Free, and you get a real answer rather than silence.
          </p>
          <Link href="/sign-up" style={{ display: 'inline-block', background: ACCENT, color: 'white', padding: '13px 28px', borderRadius: 12, fontWeight: 600, fontSize: 14, textDecoration: 'none' }}>
            Sign up free →
          </Link>
        </aside>
      </main>

      <Footer />
    </div>
  );
}
