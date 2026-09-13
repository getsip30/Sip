'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import dynamic from 'next/dynamic';
import { useRoles } from '@/hooks/useRoles';
import PixelAvatar from '@/components/PixelAvatar';
import Logo from '@/components/Logo';
import Reveal from '@/components/landing/Reveal';
import { Section, Eyebrow, Rule, ArrowRight } from '@/components/landing/shared';
import styles from '@/components/landing/landing.module.css';

/**
 * MentorQuiz is an 847-line modal that renders only after a click, and only for
 * a visitor who turns out to be signed out. Bundled eagerly, its code — plus the
 * lucide icons and AnimatePresence it pulls in — shipped and parsed in the
 * homepage's entry chunk for every visitor whether or not they ever opened it.
 *
 * `ssr: false` because it has nothing to contribute server-side: it returns null
 * until `open` is true, `open` starts false, and by the time a visitor could
 * have clicked "Find a match" the page has long since hydrated. There is no
 * content here for a crawler or a slow connection to miss.
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
   * false — which a naive expression reads as "seeker", sending everyone to
   * /seekers. That route's layout gates on requireOnboarded('seeker'), so a
   * signed-in MENTOR who clicked before the roles landed was redirected into
   * seeker onboarding: a form for an account type they do not have and did not
   * ask for. Someone holding neither role got the same treatment.
   *
   * /choose-role is the honest destination for both of those cases. It is the
   * one screen that resolves this server-truthfully — it forwards a single-role
   * user straight through to their own side and only stops to ask when there is
   * a real choice — so an unresolved or ambiguous state costs a redirect rather
   * than landing someone in the wrong product.
   */
  const dest = !rolesLoaded
    ? '/choose-role'
    : isMentor && !isSeeker
      ? '/dashboard'
      : isSeeker && !isMentor
        ? '/seekers'
        : '/choose-role';

  return (
    <header className={`${styles.nav}${scrolled ? ` ${styles.navScrolled}` : ''}`}>
      <nav className={styles.navInner}>
        <Logo size={44} />

        <div className={styles.navLinks}>
          <Link href="/seekers" className={`desktop-only ${styles.navLink}`}>
            Mentors
          </Link>
          <Link href="/answers" className={`desktop-only ${styles.navLink}`}>
            Answers
          </Link>
          <Link href="/mentors/signup" className={styles.navLink}>
            Become a mentor
          </Link>
          <Link href={signedIn ? dest : '/sign-in'} className={styles.navCta}>
            {signedIn ? 'Open Sip' : 'Sign in'}
          </Link>
        </div>
      </nav>
    </header>
  );
}

/**
 * The hero copy does not animate in, deliberately — see .heroTitle in the
 * stylesheet for why the <h1> in particular must not be given an enter
 * animation. The panel beside it does; it is not an LCP candidate.
 */
function Hero({ mentors }: { mentors: Mentor[] }) {
  const openCount = mentors.length;

  return (
    <div className={styles.hero}>
      <div className={styles.heroGrid}>
        <div style={{ minWidth: 0 }}>
          <Eyebrow color="var(--link)">Live calls</Eyebrow>

          <h1 className={styles.heroTitle}>
            Talk to someone
            <br />
            who already
            <br />
            <span className={styles.heroTitleMuted}>did the thing.</span>
          </h1>

          <p className={styles.heroLede}>
            Sip puts students in front of people working the jobs they want. Say what you&apos;re
            stuck on, see who can actually help, and have the conversation this week.
          </p>
        </div>

        <Reveal delay={0.15}>
          <aside className={styles.rail} aria-label="Mentors open right now">
            <div className={styles.railStatus}>
              <span
                className={`${styles.railDot}${openCount > 0 ? '' : ` ${styles.railDotIdle}`}`}
              />
              <span className={styles.railLabel}>
                {openCount > 0 ? `${openCount} open now` : 'Nobody open right now'}
              </span>
            </div>

            {mentors.slice(0, 4).map((m) => (
              <Link key={m.id} href={`/mentors/${m.id}`} className={styles.railRow}>
                {m.avatarData ? (
                  <PixelAvatar data={m.avatarData} size={40} />
                ) : (
                  <div className={styles.avatarFallback}>
                    {m.firstName[0]}
                    {m.lastName[0]}
                  </div>
                )}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className={styles.railName}>
                    {m.firstName} {m.lastName}
                  </div>
                  <div className={styles.railMeta}>
                    {m.role} at {m.company}
                  </div>
                </div>
              </Link>
            ))}

            {mentors.length === 0 && (
              <p className={styles.railEmpty}>
                Mentors open their doors throughout the week. Sign in to get a note when someone in
                your field goes live.
              </p>
            )}
          </aside>
        </Reveal>
      </div>
    </div>
  );
}

/**
 * Holds the quiz band's space while Clerk is still resolving the session. See
 * .quizReserve in the stylesheet for the full reasoning.
 */
function QuizPromptReserve() {
  return (
    <Section tone="raised">
      <div className={styles.quizReserve} aria-hidden="true" />
    </Section>
  );
}

/**
 * The landing page's primary conversion path, at the same visual weight as the
 * sections around it, whose only job is to open the quiz.
 *
 * SIGNED-OUT VISITORS ONLY. This component takes no auth state and has no
 * signed-in branch — the caller decides whether it exists at all. That is the
 * point: an earlier version rendered the section unconditionally and swapped
 * only the button inside it for a link, so every signed-in visitor still read
 * "Not sure who to talk to? We'll find the right person" on a page where the
 * quiz is unreachable. A conditional on the control cannot hide the pitch
 * wrapped around it; the conditional has to be on the section.
 */
function QuizPrompt({ onStartQuiz }: { onStartQuiz: () => void }) {
  return (
    <Section tone="raised">
      <Reveal>
        <div className={styles.quizCard}>
          <div className={styles.quizCopy}>
            <Eyebrow color="var(--link)">Mentor match</Eyebrow>
            <h2 className={styles.quizTitle}>
              Not sure who to talk to?
              <br />
              <span className={styles.quizTitleMuted}>We&apos;ll find the right person.</span>
            </h2>
            <p className={styles.quizSub}>Just 4 questions and you&apos;ll be all set.</p>
          </div>

          <div className={styles.quizAction}>
            <button type="button" onClick={onStartQuiz} className={styles.btnPrimary}>
              Find a match
              <ArrowRight size={16} color="#fff" />
            </button>
            <p className={styles.quizFinePrint}>Four questions · about twenty seconds</p>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}

/** Placeholder occupying one card's worth of grid while the fetch is in flight. */
function MentorCardSkeleton({ lead = false }: { lead?: boolean }) {
  return (
    <div
      className={`${styles.mentorCard} ${styles.mentorSkeleton}${lead ? ` ${styles.mentorSkeletonLead}` : ''}`}
      aria-hidden="true"
    />
  );
}

/**
 * `loaded` distinguishes "the fetch has not answered yet" from "there is
 * genuinely nobody open", which an empty array alone cannot.
 *
 * The section used to return null for both, so on every load it was absent from
 * the server-rendered HTML and then inserted — heading and five cards — once
 * /api/mentor answered, shoving everything below it down the page. Now the
 * heading is in the static HTML (it is true regardless of who is open) and the
 * cards are stood in for until the real ones arrive.
 *
 * Nobody open is still a hidden section rather than an empty grid, and that case
 * does still shift. It is the rare one, and the alternative is a heading
 * promising mentors above an empty box.
 */
function MentorGrid({ mentors, loaded }: { mentors: Mentor[]; loaded: boolean }) {
  if (loaded && mentors.length === 0) return null;
  const featured = mentors.slice(0, 5);

  return (
    <Section labelledBy="mentors-heading" tone="base">
      <Reveal>
        <div className={styles.sectionHead}>
          <div>
            <Eyebrow>Open right now</Eyebrow>
            <h2 id="mentors-heading" className={styles.headline}>
              Who you&apos;ll be talking to.
            </h2>
          </div>
          <Link href="/seekers" className={styles.headLink}>
            All mentors
          </Link>
        </div>
      </Reveal>

      <div className={styles.mentorGrid}>
        {!loaded &&
          Array.from({ length: 5 }, (_, i) => <MentorCardSkeleton key={`skeleton-${i}`} lead={i === 0} />)}
        {featured.map((m, i) => {
          const lead = i === 0;
          const topics = m.topics
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
            .slice(0, 3);

          return (
            // The span and the stretch both belong on the wrapper: it is the
            // grid item, so grid-column on the card inside does nothing.
            <Reveal
              key={m.id}
              delay={Math.min(i, 3) * 0.06}
              style={{ display: 'flex' }}
              className={lead ? styles.spanWide : undefined}
            >
              <Link href={`/mentors/${m.id}`} className={styles.mentorCard}>
                <div className={styles.mentorIdentity}>
                  {m.avatarData ? (
                    <PixelAvatar data={m.avatarData} size={lead ? 56 : 42} />
                  ) : (
                    <div
                      className={`${styles.avatarFallback}${lead ? ` ${styles.avatarFallbackLead}` : ''}`}
                    >
                      {m.firstName[0]}
                      {m.lastName[0]}
                    </div>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div className={`${styles.mentorName}${lead ? ` ${styles.mentorNameLead}` : ''}`}>
                      {m.firstName} {m.lastName}
                    </div>
                    <div className={styles.mentorRole}>
                      {m.role} at {m.company}
                    </div>
                  </div>
                </div>

                {lead && m.bio && (
                  <p className={styles.mentorBio}>
                    {m.bio.length > 190 ? `${m.bio.slice(0, 190).trim()}...` : m.bio}
                  </p>
                )}

                {topics.length > 0 && (
                  <div className={styles.tagRow}>
                    {topics.map((t) => (
                      <span key={t} className={styles.tag}>
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
    </Section>
  );
}

/**
 * Two layouts behind one section: a pull-quote when mentors have approved notes
 * to show, and the numbers when they have not.
 *
 * While the fetches are outstanding this renders the count layout with the
 * number itself held blank, rather than rendering nothing. Before, the whole
 * section appeared from nowhere once /api/sip-notes/featured answered. The count
 * layout is the one production is actually in — there are no approved notes
 * today — so reserving that shape is reserving the right shape almost always. A
 * site that does have notes still shifts once when they arrive, because the
 * quote layout is genuinely taller and there is no honest way to reserve for a
 * branch we cannot know yet.
 */
function Proof({ notes, mentors, loaded }: { notes: FeaturedNote[]; mentors: Mentor[]; loaded: boolean }) {
  const mentorCount = mentors.length;

  if (notes.length === 0) {
    if (loaded && mentorCount === 0) return null;
    return (
      <Section tone="raised">
        <Reveal>
          <div className={styles.statBlock}>
            <div className={styles.statRow}>
              <div>
                <div className={styles.statLabel}>Mentors listed</div>
                <div className={styles.statNumber}>
                  {/* Non-breaking space, not an empty string: the number's line
                      box has to exist at its full height before the count
                      lands, or reserving the row buys nothing. */}
                  {loaded ? mentorCount : ' '}
                </div>
              </div>

              <p className={styles.statBody}>
                Every one of them chose to be here and set their own terms for what they will talk
                about. Notes from finished sips show up here once mentors approve them.
              </p>
            </div>
          </div>
        </Reveal>
      </Section>
    );
  }

  const [lead, ...rest] = notes;

  return (
    <Section tone="raised">
      <Reveal>
        <Eyebrow>After the sip</Eyebrow>
      </Reveal>

      <Reveal delay={0.05}>
        <figure style={{ margin: '0 0 clamp(48px, 7vw, 76px)' }}>
          <blockquote className={styles.pullQuote}>&ldquo;{lead.note}&rdquo;</blockquote>
          <figcaption className={styles.pullQuoteMeta}>
            {lead.seekerName}, after sipping with{' '}
            <Link href={`/mentors/${lead.mentorId}`} className={styles.pullQuoteLink}>
              {lead.mentorFirstName} {lead.mentorLastName}
            </Link>
            , {lead.mentorRole} at {lead.mentorCompany}
          </figcaption>
        </figure>
      </Reveal>

      {rest.length > 0 && (
        <>
          <Rule />
          <div className={styles.noteGrid}>
            {rest.slice(0, 3).map((n, i) => (
              <Reveal key={n.id} delay={i * 0.07}>
                <figure style={{ margin: 0 }}>
                  <blockquote className={styles.noteQuote}>
                    &ldquo;{n.note.length > 165 ? `${n.note.slice(0, 165).trim()}...` : n.note}&rdquo;
                  </blockquote>
                  <figcaption className={styles.noteMeta}>
                    {n.seekerName} on {n.mentorFirstName} {n.mentorLastName}, {n.mentorRole}
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </>
      )}
    </Section>
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

  return (
    <div className={`${styles.sectionOuter} ${styles.toneGradient}`}>
      <div className={styles.finalCta}>
        <Reveal>
          <h2 className={styles.finalHeadline}>
            The conversation
            <br />
            you keep putting off
            <br />
            <span className={styles.finalHeadlineMuted}>takes twenty minutes.</span>
          </h2>
        </Reveal>

        <Reveal delay={0.1}>
          <div className={styles.ctaRow}>
            <Link href={treatAsSignedIn ? '/seekers' : '/sign-up'} className={styles.btnPrimary}>
              {treatAsSignedIn ? 'Find a mentor' : 'Start for free'}
              <ArrowRight size={16} color="#fff" />
            </Link>
            <Link href="/mentors/signup" className={styles.btnSecondary}>
              Become a mentor
            </Link>
          </div>
        </Reveal>
      </div>
    </div>
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
   * redirect firing — closes the quiz on the very next render, with no effect to
   * run and no stale boolean left behind to reopen it later.
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
    <div className={styles.page}>
      <Nav isMentor={isMentor} isSeeker={isSeeker} rolesLoaded={rolesLoaded} signedIn={!!user} />

      <main id="main-content">
        <Hero mentors={mentors} />
        {/*
          `canQuiz` is `isLoaded && !user`, so the band is absent both while
          Clerk is resolving and for anyone signed in. Rendering nothing until
          the session is known is deliberate: the alternative is to guess, and
          guessing "signed out" is what put quiz copy in front of signed-in
          users on every hard refresh.
        */}
        {canQuiz ? (
          <QuizPrompt onStartQuiz={() => setQuizRequested(true)} />
        ) : isLoaded ? null : (
          <QuizPromptReserve />
        )}
        {testimonials}
        {steps}
        <MentorGrid mentors={mentors} loaded={mentorsLoaded} />
        <Proof notes={notes} mentors={mentors} loaded={mentorsLoaded && notesLoaded} />
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
    </div>
  );
}
