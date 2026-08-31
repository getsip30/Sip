'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { useRoles } from '@/hooks/useRoles';
import PixelAvatar from '@/components/PixelAvatar';
import Logo from '@/components/Logo';
import dynamic from 'next/dynamic';
import Reveal from '@/components/landing/Reveal';
import { MAX_PAGE_WIDTH, GUTTER, mono, ArrowRight, Eyebrow, Rule } from '@/components/landing/shared';
import { BG, SURFACE, TEXT, MUTED, ACCENT, LINK, SUCCESS2 } from '@/lib/theme';

/**
 * MentorQuiz was a static import of an 847-line modal that renders only after
 * a click, and only for a visitor who turns out to be signed out. Bundled
 * eagerly, its code — plus the lucide icons and AnimatePresence it pulls in —
 * shipped and parsed in the homepage's entry chunk for every visitor whether
 * or not they ever open it.
 *
 * `ssr: false` because the component has nothing to contribute server-side: it
 * returns null until `open` is true, `open` starts false, and by the time a
 * visitor could have clicked "Find a match" the page has long since hydrated.
 * There is no content here for a crawler or a slow connection to miss.
 */
const MentorQuiz = dynamic(() => import('@/components/MentorQuiz'), { ssr: false });

type Mentor = {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  company: string;
  topics: string;
  bio: string;
  isOpen: boolean;
  avatarData?: string | null;
};

type FeaturedNote = {
  id: string;
  note: string;
  seekerName: string;
  mentorId: string;
  mentorFirstName: string;
  mentorLastName: string;
  mentorRole: string;
  mentorCompany: string;
};

function Nav({
  isMentor,
  isSeeker,
  rolesLoaded,
  signedIn,
}: {
  isMentor: boolean;
  isSeeker: boolean;
  rolesLoaded: boolean;
  signedIn: boolean;
}) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /**
   * Where "Open Sip" goes.
   *
   * useRoles() resolves over two fetches, and until it does both flags are
   * false — which the old expression read as "seeker", sending everyone to
   * /seekers. That route's layout gates on requireOnboarded('seeker'), so a
   * signed-in MENTOR who clicked before the roles landed was redirected into
   * seeker onboarding: a form for an account type they do not have and did not
   * ask for. Someone holding neither role got the same treatment.
   *
   * /choose-role is the honest destination for both of those cases. It is the
   * one screen that resolves this server-truthfully — it forwards a
   * single-role user straight through to their own side and only stops to ask
   * when there is a real choice — so an unresolved or ambiguous state costs a
   * redirect rather than landing someone in the wrong product.
   */
  const dest = !rolesLoaded
    ? '/choose-role'
    : isMentor && !isSeeker
      ? '/dashboard'
      : isSeeker && !isMentor
        ? '/seekers'
        : '/choose-role';

  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 90,
        background: scrolled ? 'rgba(10,14,22,0.92)' : 'transparent',
        borderBottom: `1px solid ${scrolled ? 'rgba(255,255,255,0.08)' : 'transparent'}`,
        transition: 'background 260ms ease, border-color 260ms ease',
      }}
    >
      <nav
        style={{
          maxWidth: MAX_PAGE_WIDTH,
          margin: '0 auto',
          padding: `0 ${GUTTER}`,
          height: 68,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <Logo size={44} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(14px, 3vw, 30px)' }}>
          <Link href="/seekers" className="desktop-only" style={{ fontSize: 14, color: MUTED, textDecoration: 'none' }}>
            Mentors
          </Link>
          <Link href="/answers" className="desktop-only" style={{ fontSize: 14, color: MUTED, textDecoration: 'none' }}>
            Answers
          </Link>
          <Link href="/mentors/signup" style={{ fontSize: 14, color: MUTED, textDecoration: 'none' }}>
            Become a mentor
          </Link>
          <Link
            href={signedIn ? dest : '/sign-in'}
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: TEXT,
              textDecoration: 'none',
              border: '1px solid rgba(255,255,255,0.16)',
              padding: '9px 18px',
              borderRadius: 999,
              whiteSpace: 'nowrap',
            }}
          >
            {signedIn ? 'Open Sip' : 'Sign in'}
          </Link>
        </div>
      </nav>
    </header>
  );
}

/**
 * The hero copy does not animate in, deliberately.
 *
 * These three elements were <motion.*> with `initial={{ opacity: 0, y: 18 }}`,
 * which framer-motion serializes into the server-rendered HTML. The <h1> is the
 * page's LCP element, and it was being shipped as `opacity:0` — so the largest
 * contentful paint could not happen until the JS had downloaded, hydrated, and
 * run the enter animation. Lighthouse measured LCP at 12.9s against an FCP of
 * 1.8s: the whole gap was the hero waiting on hydration to become visible.
 *
 * A CSS fade would still hold the element at opacity 0 for the duration and
 * push LCP out by that much, so the animation is dropped rather than moved.
 * The rail beside it still animates; it is not an LCP candidate.
 */
function Hero({ mentors }: { mentors: Mentor[] }) {
  const reduced = useReducedMotion();
  const openCount = mentors.length;

  return (
    <section
      style={{
        maxWidth: MAX_PAGE_WIDTH,
        margin: '0 auto',
        padding: `clamp(120px, 17vh, 190px) ${GUTTER} clamp(64px, 10vh, 110px)`,
      }}
    >
      <div className="hero-grid">
        <div style={{ minWidth: 0 }}>
          <Eyebrow color={LINK}>Live calls</Eyebrow>

          <h1
            style={{
              fontSize: 'clamp(42px, 7.4vw, 82px)',
              lineHeight: 0.98,
              letterSpacing: '-0.035em',
              fontWeight: 700,
              margin: 0,
            }}
          >
            Talk to someone
            <br />
            who already
            <br />
            <span style={{ color: LINK }}>did the thing.</span>
          </h1>

          <p
            style={{
              marginTop: 26,
              fontSize: 'clamp(16px, 1.9vw, 19px)',
              lineHeight: 1.62,
              color: MUTED,
              maxWidth: 470,
            }}
          >
            Sip puts students in front of people working the jobs they want. Say what you&apos;re
            stuck on, see who can actually help, and have the conversation this week.
          </p>
        </div>

        <motion.aside
          initial={reduced ? false : { opacity: 0, y: 26 }}
          animate={reduced ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 0.61, 0.36, 1] }}
          className="hero-rail"
          aria-label="Mentors open right now"
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '0 0 16px',
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: openCount > 0 ? SUCCESS2 : MUTED,
                flexShrink: 0,
              }}
            />
            <span style={{ ...mono, fontSize: 10, color: MUTED }}>
              {openCount > 0 ? `${openCount} open now` : 'Nobody open right now'}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {mentors.slice(0, 4).map((m, i) => (
              <div key={m.id}>
                {i > 0 && <Rule />}
                <Link href={`/mentors/${m.id}`} className="rail-row" style={{ textDecoration: 'none', color: 'inherit' }}>
                  {m.avatarData ? (
                    <PixelAvatar data={m.avatarData} size={40} />
                  ) : (
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        background: 'rgba(255,255,255,0.06)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 13,
                        fontWeight: 600,
                        color: MUTED,
                        flexShrink: 0,
                      }}
                    >
                      {m.firstName[0]}
                      {m.lastName[0]}
                    </div>
                  )}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {m.firstName} {m.lastName}
                    </div>
                    <div style={{ fontSize: 12.5, color: MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {m.role} at {m.company}
                    </div>
                  </div>
                </Link>
              </div>
            ))}
            {mentors.length === 0 && (
              <p style={{ fontSize: 13.5, color: MUTED, lineHeight: 1.6, padding: '6px 0 2px' }}>
                Mentors open their doors throughout the week. Sign in to get a note when someone in
                your field goes live.
              </p>
            )}
          </div>
        </motion.aside>
      </div>
    </section>
  );
}

/**
 * The landing page's primary conversion path: a full-width section, at the same
 * visual weight as "How it works", whose only job is to open the quiz.
 *
 * SIGNED-OUT VISITORS ONLY. This component takes no auth state and has no
 * signed-in branch — the caller decides whether it exists at all. That is the
 * point: the previous version rendered the section unconditionally and swapped
 * only the button inside it for a link, so every signed-in visitor still read
 * "Not sure who to talk to? We'll find the right person. Just 4 questions and you'll
 * be all set" on a page where the quiz is unreachable. A conditional on the
 * control cannot hide the pitch wrapped around it; the conditional has to be on
 * the section.
 *
 * It replaced a small button sitting under the hero paragraph, which read as a
 * secondary action on a page whose whole purpose is that one action.
 *
 * The blur here is decorative and scoped to this box — two soft colour washes
 * behind the card's own content. It is deliberately not the page-wide backdrop
 * blur: that treatment belongs to the quiz modal, and using it in two places
 * would stop it meaning "something is on top of the page".
 */
/**
 * Holds the quiz section's space while Clerk is still resolving the session.
 *
 * The prompt is present in the statically rendered HTML — with no request to
 * read, Clerk resolves to signed-out at build time — but on the client the
 * first render has isLoaded false, so the section unmounted and then remounted
 * a beat later when the session arrived. Everything below it moved twice.
 *
 * Reserving rather than simply leaving the prompt mounted keeps the rule the
 * section already had: a signed-in visitor never sees quiz copy, not even for
 * one frame. They get an empty box that collapses instead, which is one shift
 * for them and none for the signed-out visitor this page is mostly for.
 *
 * The padding clamps are copied from .quiz-prompt so only the inner content
 * height is estimated, in .quiz-prompt-reserve::before.
 */
function QuizPromptReserve() {
  return (
    <section style={{ maxWidth: MAX_PAGE_WIDTH, margin: '0 auto', padding: `clamp(56px, 9vh, 100px) ${GUTTER}` }}>
      <div className="quiz-prompt-reserve" aria-hidden="true" />
    </section>
  );
}

function QuizPrompt({ onStartQuiz }: { onStartQuiz: () => void }) {
  return (
    <section style={{ maxWidth: MAX_PAGE_WIDTH, margin: '0 auto', padding: `clamp(56px, 9vh, 100px) ${GUTTER}` }}>
      <Reveal>
        <div className="quiz-prompt">
          {/*
            Decorative only, and hidden from assistive tech: these are two
            blurred colour fields with no content behind them. `overflow:hidden`
            on the parent is what keeps the blur inside the box's border rather
            than bleeding onto the page.
          */}
          <div className="quiz-prompt-glow" aria-hidden="true">
            <span className="quiz-prompt-blob quiz-prompt-blob-a" />
            <span className="quiz-prompt-blob quiz-prompt-blob-b" />
          </div>

          <div style={{ position: 'relative', textAlign: 'center', maxWidth: 640, margin: '0 auto' }}>
            <Eyebrow color={LINK}>Mentor match</Eyebrow>
            <h2
              style={{
                fontSize: 'clamp(28px, 4.2vw, 46px)',
                lineHeight: 1.08,
                letterSpacing: '-0.03em',
                fontWeight: 700,
                margin: '0 0 18px',
              }}
            >
              Not sure who to talk to?
              <br />
              <span style={{ color: LINK }}>We&apos;ll find the right person.</span>
            </h2>
            <p style={{ fontSize: 'clamp(15px, 1.8vw, 18px)', lineHeight: 1.6, color: MUTED, margin: '0 0 32px' }}>
              Just 4 questions and you&apos;ll be all set.
            </p>

            <button type="button" onClick={onStartQuiz} className="hero-cta">
              Find a match
              <ArrowRight size={16} />
            </button>

            <p style={{ ...mono, fontSize: 10, color: MUTED, marginTop: 18 }}>
              Four questions · about twenty seconds
            </p>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/**
 * Placeholder occupying one card's worth of grid while the mentor fetch is in
 * flight. The heights are estimates of the real cards below — a plain card is
 * an avatar row plus a topic chip row, the lead card adds a bio paragraph —
 * chosen so the grid does not resize when the data lands. They are the one
 * approximate thing here; if the card design changes, these move with it.
 */
function MentorCardSkeleton({ lead = false }: { lead?: boolean }) {
  return <div className={`mentor-card mentor-card-skeleton${lead ? ' mentor-card-lead' : ''}`} aria-hidden="true" />;
}

/**
 * `loaded` distinguishes "the fetch has not answered yet" from "there is
 * genuinely nobody open", which an empty array alone cannot.
 *
 * The section used to return null for both, so on every load it was absent
 * from the server-rendered HTML and then inserted — heading, and five cards —
 * once /api/mentor answered, shoving everything below it down the page. Now
 * the heading is in the static HTML (it is true regardless of who is open) and
 * the cards are stood in for until the real ones arrive.
 *
 * Nobody open is still a hidden section rather than an empty grid, and that
 * case does still shift. It is the rare one, and the alternative is a heading
 * promising mentors above an empty box.
 */
function MentorGrid({ mentors, loaded }: { mentors: Mentor[]; loaded: boolean }) {
  if (loaded && mentors.length === 0) return null;
  const featured = mentors.slice(0, 5);

  return (
    <section style={{ maxWidth: MAX_PAGE_WIDTH, margin: '0 auto', padding: `clamp(56px, 9vh, 100px) ${GUTTER}` }}>
      <Reveal>
        <div className="section-head">
          <div>
            <Eyebrow>Open right now</Eyebrow>
            <h2
              style={{
                fontSize: 'clamp(30px, 4.4vw, 48px)',
                lineHeight: 1.06,
                letterSpacing: '-0.03em',
                fontWeight: 700,
                margin: 0,
                maxWidth: 560,
              }}
            >
              Who you&apos;ll be talking to.
            </h2>
          </div>
          <Link href="/seekers" className="text-link" style={{ ...mono, fontSize: 11, color: LINK, textDecoration: 'none', whiteSpace: 'nowrap' }}>
            All mentors
          </Link>
        </div>
      </Reveal>

      <div className="mentor-grid">
        {!loaded &&
          Array.from({ length: 5 }, (_, i) => <MentorCardSkeleton key={`skeleton-${i}`} lead={i === 0} />)}
        {featured.map((m, i) => {
          const topics = m.topics
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
            .slice(0, 3);
          return (
            <Reveal key={m.id} delay={Math.min(i, 3) * 0.06} style={{ display: 'flex' }}>
              <Link
                href={`/mentors/${m.id}`}
                className={`mentor-card${i === 0 ? ' mentor-card-lead' : ''}`}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                  {m.avatarData ? (
                    <PixelAvatar data={m.avatarData} size={i === 0 ? 52 : 42} />
                  ) : (
                    <div
                      style={{
                        width: i === 0 ? 52 : 42,
                        height: i === 0 ? 52 : 42,
                        borderRadius: '50%',
                        background: 'rgba(255,255,255,0.06)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: i === 0 ? 16 : 13,
                        fontWeight: 600,
                        color: MUTED,
                        flexShrink: 0,
                      }}
                    >
                      {m.firstName[0]}
                      {m.lastName[0]}
                    </div>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: i === 0 ? 19 : 16, fontWeight: 600, letterSpacing: '-0.01em' }}>
                      {m.firstName} {m.lastName}
                    </div>
                    <div style={{ fontSize: 13, color: MUTED, marginTop: 2 }}>
                      {m.role} at {m.company}
                    </div>
                  </div>
                </div>

                {i === 0 && m.bio && (
                  <p style={{ fontSize: 15, lineHeight: 1.62, color: MUTED, margin: '20px 0 0', maxWidth: 440 }}>
                    {m.bio.length > 190 ? `${m.bio.slice(0, 190).trim()}...` : m.bio}
                  </p>
                )}

                {topics.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 'auto', paddingTop: 20 }}>
                    {topics.map((t) => (
                      <span
                        key={t}
                        style={{
                          ...mono,
                          fontSize: 9.5,
                          color: MUTED,
                          border: '1px solid rgba(255,255,255,0.11)',
                          padding: '5px 9px',
                          borderRadius: 5,
                        }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

/**
 * Two layouts behind one section: a pull-quote when mentors have approved notes
 * to show, and a bare mentor count when they have not.
 *
 * While the fetches are outstanding this renders the count layout with the
 * number itself held blank, rather than rendering nothing. Before, the whole
 * section appeared from nowhere once /api/sip-notes/featured answered. The
 * count layout is the one production is actually in — there are no approved
 * notes today — so reserving that shape is reserving the right shape almost
 * always. A site that does have notes still shifts once when they arrive,
 * because the quote layout is genuinely taller and there is no honest way to
 * reserve for a branch we cannot know yet.
 */
function Proof({ notes, mentorCount, loaded }: { notes: FeaturedNote[]; mentorCount: number; loaded: boolean }) {
  if (notes.length === 0) {
    if (loaded && mentorCount === 0) return null;
    return (
      <section style={{ maxWidth: MAX_PAGE_WIDTH, margin: '0 auto', padding: `clamp(56px, 9vh, 100px) ${GUTTER}` }}>
        <Reveal>
          <Rule />
          <div className="stat-row">
            <div>
              <div style={{ ...mono, fontSize: 11, color: MUTED, marginBottom: 12 }}>Mentors listed</div>
              <div style={{ fontSize: 'clamp(38px, 6vw, 60px)', fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1 }}>
                {/* Non-breaking space, not an empty string: the number's line
                    box has to exist at its full height before the count lands,
                    or reserving the row buys nothing. */}
                {loaded ? mentorCount : '\u00A0'}
              </div>
            </div>
            <p style={{ fontSize: 16, lineHeight: 1.65, color: MUTED, margin: 0, maxWidth: 420 }}>
              Every one of them chose to be here and set their own terms for what they will talk
              about. Notes from finished sips show up here once mentors approve them.
            </p>
          </div>
          <Rule />
        </Reveal>
      </section>
    );
  }

  const [lead, ...rest] = notes;

  return (
    <section style={{ maxWidth: MAX_PAGE_WIDTH, margin: '0 auto', padding: `clamp(56px, 9vh, 100px) ${GUTTER}` }}>
      <Reveal>
        <Eyebrow>After the sip</Eyebrow>
      </Reveal>

      <Reveal delay={0.05}>
        <figure style={{ margin: '0 0 clamp(40px, 6vw, 64px)' }}>
          <blockquote
            style={{
              fontSize: 'clamp(23px, 3.4vw, 37px)',
              lineHeight: 1.28,
              letterSpacing: '-0.025em',
              fontWeight: 500,
              margin: 0,
              maxWidth: 860,
              textWrap: 'pretty',
            }}
          >
            &ldquo;{lead.note}&rdquo;
          </blockquote>
          <figcaption style={{ marginTop: 24, fontSize: 14, color: MUTED }}>
            {lead.seekerName}, after sipping with{' '}
            <Link href={`/mentors/${lead.mentorId}`} className="text-link" style={{ color: TEXT, textDecoration: 'none' }}>
              {lead.mentorFirstName} {lead.mentorLastName}
            </Link>
            , {lead.mentorRole} at {lead.mentorCompany}
          </figcaption>
        </figure>
      </Reveal>

      {rest.length > 0 && (
        <>
          <Rule />
          <div className="proof-grid">
            {rest.slice(0, 3).map((n, i) => (
              <Reveal key={n.id} delay={i * 0.07}>
                <figure style={{ margin: 0 }}>
                  <blockquote style={{ fontSize: 15, lineHeight: 1.66, color: TEXT, margin: 0 }}>
                    &ldquo;{n.note.length > 165 ? `${n.note.slice(0, 165).trim()}...` : n.note}&rdquo;
                  </blockquote>
                  <figcaption style={{ marginTop: 14, fontSize: 12.5, color: MUTED }}>
                    {n.seekerName} on {n.mentorFirstName} {n.mentorLastName}, {n.mentorRole}
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

/**
 * `authResolved` here for the same reason the quiz section takes no auth state
 * at all: an unresolved session must not be read as signed-out. This one cannot
 * simply be withheld — it is the page's closing call to action and should be in
 * the static HTML — so it defaults to the signed-in wording instead. /seekers is
 * a working destination for everyone, whereas /sign-up in front of someone who
 * is already signed in is a dead end.
 */
function FinalCta({ signedIn, authResolved }: { signedIn: boolean; authResolved: boolean }) {
  const treatAsSignedIn = signedIn || !authResolved;
  const ref = useRef<HTMLElement | null>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const shift = useTransform(scrollYProgress, [0, 1], [26, -26]);

  return (
    <section ref={ref} style={{ padding: `clamp(72px, 12vh, 140px) ${GUTTER}`, overflow: 'hidden' }}>
      <div style={{ maxWidth: MAX_PAGE_WIDTH, margin: '0 auto' }}>
        <Reveal>
          <motion.h2
            style={{
              fontSize: 'clamp(38px, 8vw, 92px)',
              lineHeight: 0.98,
              letterSpacing: '-0.04em',
              fontWeight: 700,
              margin: 0,
              maxWidth: 900,
              y: reduced ? 0 : shift,
            }}
          >
            The conversation
            <br />
            you keep putting off
            <br />
            <span style={{ color: MUTED }}>takes twenty minutes.</span>
          </motion.h2>
        </Reveal>

        <Reveal delay={0.1}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 44, alignItems: 'center' }}>
            <Link href={treatAsSignedIn ? '/seekers' : '/sign-up'} className="cta-primary">
              {treatAsSignedIn ? 'Find a mentor' : 'Start for free'}
              <ArrowRight size={16} color="#fff" />
            </Link>
            <Link href="/mentors/signup" className="cta-secondary">
              Become a mentor
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export default function Landing({
  testimonials,
  steps,
  faqSection,
  footer,
}: {
  testimonials: React.ReactNode;
  steps: React.ReactNode;
  faqSection: React.ReactNode;
  footer: React.ReactNode;
}) {
  const { user, isLoaded } = useUser();
  const { isMentor, isSeeker, loaded: rolesLoaded } = useRoles();

  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [mentorsLoaded, setMentorsLoaded] = useState(false);
  const [notes, setNotes] = useState<FeaturedNote[]>([]);
  const [notesLoaded, setNotesLoaded] = useState(false);
  const [quizRequested, setQuizRequested] = useState(false);

  /**
   * Signed-out only, derived rather than stored.
   *
   * Whether the quiz may be on screen is a function of the live Clerk session,
   * not a flag set once when a button was clicked. Deriving it means a session
   * appearing at any point — another tab, Clerk's modal completing without the
   * redirect firing — closes the quiz on the very next render, with no effect
   * to run and no stale boolean left behind to reopen it later.
   */
  const canQuiz = isLoaded && !user;
  const quizOpen = quizRequested && canQuiz;

  useEffect(() => {
    let cancelled = false;

    // Both `loaded` flags are set in .finally rather than .then: a failed fetch
    // has to release the reserved space too, or a mentor list that 500s leaves
    // skeleton cards on the page forever.
    fetch('/api/mentor?all=true')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Mentor[]) => {
        if (!cancelled) setMentors(Array.isArray(data) ? data : []);
      })
      .catch((err) => console.error('landing: mentor fetch failed', err))
      .finally(() => {
        if (!cancelled) setMentorsLoaded(true);
      });

    fetch('/api/sip-notes/featured')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: FeaturedNote[]) => {
        if (!cancelled) setNotes(Array.isArray(data) ? data : []);
      })
      .catch((err) => console.error('landing: notes fetch failed', err))
      .finally(() => {
        if (!cancelled) setNotesLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ background: BG, color: TEXT, minHeight: '100vh' }}>
      <Nav isMentor={isMentor} isSeeker={isSeeker} rolesLoaded={rolesLoaded} signedIn={!!user} />

      <main id="main-content">
        <Hero mentors={mentors} />
        {/*
          `canQuiz` is `isLoaded && !user`, so the section is absent both while
          Clerk is resolving and for anyone signed in. Rendering nothing until
          the session is known is deliberate: the alternative is to guess, and
          guessing "signed out" is what put quiz copy in front of signed-in
          users on every hard refresh. The cost is that signed-out visitors get
          this block a beat after first paint; the benefit is that signed-in
          visitors never get it at all, not even for a frame.
        */}
        {canQuiz ? (
          <QuizPrompt onStartQuiz={() => setQuizRequested(true)} />
        ) : isLoaded ? null : (
          <QuizPromptReserve />
        )}
        {testimonials}
        {steps}
        <MentorGrid mentors={mentors} loaded={mentorsLoaded} />
        <Proof notes={notes} mentorCount={mentors.length} loaded={mentorsLoaded && notesLoaded} />
        {faqSection}
        <FinalCta signedIn={!!user} authResolved={isLoaded} />
      </main>

      {footer}

      {/*
        Signed-out visitors only. MentorQuiz enforces this itself as well; the
        guard is repeated here so the component is never even mounted for a
        signed-in user, and `isLoaded` keeps it from flashing open during the
        moment before Clerk has resolved the session.
      */}
      {canQuiz && <MentorQuiz open={quizOpen} onClose={() => setQuizRequested(false)} />}

      <style>{`
        .hero-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: clamp(48px, 7vw, 72px);
          align-items: start;
        }
        .quiz-prompt {
          position: relative;
          overflow: hidden;
          isolation: isolate;
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 24px;
          background: ${SURFACE};
          padding: clamp(48px, 8vw, 88px) clamp(24px, 5vw, 64px);
        }
        /* Same padding clamps as .quiz-prompt above, so the only estimate is
           the inner content height below. */
        .quiz-prompt-reserve {
          border: 1px solid transparent;
          border-radius: 24px;
          padding: clamp(48px, 8vw, 88px) clamp(24px, 5vw, 64px);
        }
        .quiz-prompt-reserve::before {
          content: '';
          display: block;
          /* Eyebrow, two-line heading, one line of copy, the button, and the
             small print under it, at the sizes .quiz-prompt renders them. */
          height: clamp(247px, 30vw, 293px);
        }
        .quiz-prompt-glow {
          position: absolute;
          inset: 0;
          z-index: -1;
          pointer-events: none;
        }
        .quiz-prompt-blob {
          position: absolute;
          display: block;
          border-radius: 50%;
          filter: blur(72px);
          opacity: 0.5;
        }
        .quiz-prompt-blob-a {
          width: 46%;
          padding-bottom: 46%;
          top: -18%;
          left: -8%;
          background: rgba(112,181,249,0.45);
        }
        .quiz-prompt-blob-b {
          width: 40%;
          padding-bottom: 40%;
          bottom: -22%;
          right: -6%;
          background: rgba(10,102,194,0.42);
        }
        /* A 72px blur over a large area is a real compositing cost on low-end
           phones, and the blobs are decoration. Below the breakpoint they are
           dropped rather than shrunk. */
        @media (max-width: 640px) {
          .quiz-prompt-glow { display: none; }
        }
        .hero-cta {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          background: ${ACCENT};
          color: #fff;
          border: none;
          padding: 16px 28px;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          transition: background 200ms ease, transform 200ms ease;
        }
        .hero-cta:hover { background: #1d4fd8; transform: translateY(-2px); }
        @media (prefers-reduced-motion: reduce) {
          .hero-cta:hover { transform: none; }
        }
        .hero-rail {
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 16px;
          padding: 20px 22px;
          background: ${SURFACE};
        }
        .rail-row {
          display: flex;
          align-items: center;
          gap: 13px;
          padding: 14px 0;
          transition: opacity 180ms ease;
        }
        .rail-row:hover { opacity: 0.62; }
        .section-head {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: clamp(36px, 5vw, 58px);
        }
        .mentor-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 14px;
        }
        .mentor-card {
          display: flex;
          flex-direction: column;
          width: 100%;
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 16px;
          padding: 22px;
          background: ${SURFACE};
          transition: border-color 220ms ease, transform 220ms ease;
        }
        /* Stand-ins for cards still being fetched. See MentorCardSkeleton. */
        .mentor-card-skeleton {
          min-height: 152px;
        }
        .mentor-card-skeleton.mentor-card-lead {
          min-height: 232px;
        }
        .mentor-card:hover {
          border-color: rgba(112,181,249,0.4);
          transform: translateY(-3px);
        }
        .proof-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: clamp(28px, 4vw, 44px);
          padding-top: clamp(32px, 4.5vw, 48px);
        }
        .stat-row {
          display: flex;
          flex-wrap: wrap;
          align-items: flex-end;
          justify-content: space-between;
          gap: 32px;
          padding: clamp(34px, 5vw, 54px) 0;
        }
        .cta-primary {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          background: ${ACCENT};
          color: #fff;
          padding: 15px 28px;
          border-radius: 999px;
          font-size: 15px;
          font-weight: 600;
          text-decoration: none;
          transition: transform 200ms ease, background 200ms ease;
        }
        .cta-primary:hover { background: #1d4fd8; transform: translateY(-2px); }
        .cta-secondary {
          display: inline-flex;
          align-items: center;
          padding: 15px 28px;
          border: 1px solid rgba(255,255,255,0.16);
          border-radius: 999px;
          font-size: 15px;
          font-weight: 600;
          color: ${TEXT};
          text-decoration: none;
          transition: border-color 200ms ease;
        }
        .cta-secondary:hover { border-color: rgba(255,255,255,0.34); }
        .text-link { transition: color 180ms ease; }
        .text-link:hover { color: ${LINK}; }

        @media (min-width: 720px) {
          .mentor-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .mentor-card-lead { grid-column: span 2; }
          .proof-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        }
        @media (min-width: 980px) {
          .hero-grid { grid-template-columns: minmax(0, 1.35fr) minmax(0, 0.85fr); }
          .mentor-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
          .mentor-card-lead { grid-column: span 2; grid-row: span 1; }
        }
      `}</style>
    </div>
  );
}
