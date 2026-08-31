import { LINK, MUTED } from '@/lib/theme';
import Reveal from './Reveal';
import { MAX_PAGE_WIDTH, GUTTER, mono, Eyebrow, Rule } from './shared';

const STEPS = [
  {
    n: '01',
    title: 'Say what you’re stuck on',
    body: 'One sentence is enough. We read it against every mentor who is currently taking conversations, and rank who fits.',
  },
  {
    n: '02',
    title: 'See who can actually help',
    body: 'Real job, real company, and the specific topics they agreed to talk about. Profiles are short on purpose, so you can tell quickly.',
  },
  {
    n: '03',
    title: 'Have the conversation',
    body: 'Join a live room and take your place in the queue, or book a time that suits you both. Most first sips happen within the week.',
  },
];

/**
 * "How it works" — static prose with no dependency on auth, mentors, or notes.
 *
 * A plain Server Component: it renders through <Reveal>, a client leaf, so
 * the scroll-in animation survives, but this file itself has no hooks and
 * ships no JS of its own. It used to be a function nested inside the
 * client-rendered Landing.tsx, which meant its markup was bundled and
 * hydrated along with everything that section actually needs a browser for.
 */
export default function Steps() {
  return (
    <section
      id="how-it-works"
      style={{ maxWidth: MAX_PAGE_WIDTH, margin: '0 auto', padding: `clamp(56px, 9vh, 100px) ${GUTTER}` }}
    >
      <Reveal>
        <Eyebrow>How it works</Eyebrow>
        <h2
          style={{
            fontSize: 'clamp(30px, 4.4vw, 48px)',
            lineHeight: 1.06,
            letterSpacing: '-0.03em',
            fontWeight: 700,
            margin: '0 0 clamp(40px, 6vw, 72px)',
            maxWidth: 620,
          }}
        >
          Three steps, no cold outreach.
        </h2>
      </Reveal>

      <div>
        {STEPS.map((s, i) => (
          <Reveal key={s.n} delay={i * 0.07}>
            <div className="step-row">
              <div style={{ ...mono, fontSize: 12, color: LINK, paddingTop: 5 }}>{s.n}</div>
              <h3
                style={{
                  fontSize: 'clamp(20px, 2.5vw, 27px)',
                  fontWeight: 600,
                  letterSpacing: '-0.02em',
                  margin: 0,
                  lineHeight: 1.22,
                }}
              >
                {s.title}
              </h3>
              <p style={{ fontSize: 15.5, lineHeight: 1.68, color: MUTED, margin: 0, maxWidth: 460 }}>{s.body}</p>
            </div>
            <Rule />
          </Reveal>
        ))}
      </div>

      <style>{`
        .step-row {
          display: grid;
          grid-template-columns: 46px minmax(0, 1fr);
          gap: 8px 20px;
          padding: clamp(26px, 3.4vw, 38px) 0;
        }
        .step-row h3 { grid-column: 2; }
        .step-row p { grid-column: 2; }
        @media (min-width: 720px) {
          .step-row { grid-template-columns: 92px minmax(0, 320px) minmax(0, 1fr); align-items: start; }
          .step-row h3 { grid-column: 2; }
          .step-row p { grid-column: 3; }
        }
      `}</style>
    </section>
  );
}
