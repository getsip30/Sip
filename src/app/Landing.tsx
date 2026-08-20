'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { useRoles } from '@/hooks/useRoles';
import PixelAvatar from '@/components/PixelAvatar';
import Logo from '@/components/Logo';
import Footer from '@/components/Footer';
import Testimonials from '@/components/Testimonials';
import { BG, SURFACE, TEXT, MUTED, ACCENT, LINK, SUCCESS2 } from '@/lib/theme';

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

type Match = {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  company: string;
  reason: string;
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

const MAX_PAGE_WIDTH = 1180;
const GUTTER = 'clamp(20px, 5vw, 56px)';

const mono: React.CSSProperties = {
  fontFamily: "var(--font-space-mono), 'Space Mono', monospace",
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
};

function ArrowRight({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 12h15M13 5.5 19.5 12 13 18.5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Fades and lifts children the first time they enter the viewport. */
function Reveal({
  children,
  delay = 0,
  y = 22,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  style?: React.CSSProperties;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y }}
      whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-70px' }}
      transition={{ duration: 0.6, delay, ease: [0.22, 0.61, 0.36, 1] }}
      style={style}
    >
      {children}
    </motion.div>
  );
}

function Eyebrow({ children, color = MUTED }: { children: React.ReactNode; color?: string }) {
  return <div style={{ ...mono, fontSize: 11, color, marginBottom: 20 }}>{children}</div>;
}

function Rule() {
  return <div style={{ height: 1, background: 'rgba(255,255,255,0.09)' }} />;
}

function Nav({ isMentor, isSeeker, signedIn }: { isMentor: boolean; isSeeker: boolean; signedIn: boolean }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const dest = isMentor ? '/dashboard' : isSeeker ? '/seekers' : '/seekers';

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

function Hero({
  mentors,
  onMatch,
  matching,
  matches,
  matchError,
}: {
  mentors: Mentor[];
  onMatch: (q: string) => void;
  matching: boolean;
  matches: Match[] | null;
  matchError: string;
}) {
  const [query, setQuery] = useState('');
  const reduced = useReducedMotion();
  const openCount = mentors.length;

  const rise = (delay: number) => ({
    initial: reduced ? false : { opacity: 0, y: 18 },
    animate: reduced ? undefined : { opacity: 1, y: 0 },
    transition: { duration: 0.7, delay, ease: [0.22, 0.61, 0.36, 1] as const },
  });

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
          <motion.div {...rise(0)}>
            <Eyebrow color={LINK}>Live mentorship</Eyebrow>
          </motion.div>

          <motion.h1
            {...rise(0.06)}
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
          </motion.h1>

          <motion.p
            {...rise(0.14)}
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
          </motion.p>

          <motion.form
            {...rise(0.22)}
            onSubmit={(e) => {
              e.preventDefault();
              onMatch(query);
            }}
            style={{ marginTop: 36, maxWidth: 500 }}
          >
            <label htmlFor="matchQuery" style={{ ...mono, fontSize: 10, color: MUTED, display: 'block', marginBottom: 10 }}>
              What do you want to figure out?
            </label>
            <div className="hero-field">
              <input
                id="matchQuery"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                maxLength={500}
                placeholder="Breaking into product design without a portfolio"
                style={{
                  flex: 1,
                  minWidth: 0,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: TEXT,
                  fontSize: 15,
                  padding: '15px 4px 15px 18px',
                  fontFamily: 'inherit',
                }}
              />
              <button
                type="submit"
                disabled={matching || !query.trim()}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 9,
                  background: query.trim() ? ACCENT : 'rgba(255,255,255,0.07)',
                  color: query.trim() ? '#fff' : MUTED,
                  border: 'none',
                  padding: '12px 20px',
                  margin: 5,
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  cursor: matching || !query.trim() ? 'not-allowed' : 'pointer',
                  transition: 'background 200ms ease, color 200ms ease',
                  whiteSpace: 'nowrap',
                }}
              >
                {matching ? 'Matching' : 'Find a match'}
                {!matching && <ArrowRight size={15} />}
              </button>
            </div>
            {matchError && (
              <p style={{ marginTop: 12, fontSize: 13, color: '#f87171' }}>{matchError}</p>
            )}
          </motion.form>

          {matches && (
            <motion.div
              initial={reduced ? false : { opacity: 0, y: 10 }}
              animate={reduced ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              style={{ marginTop: 26, maxWidth: 500 }}
            >
              {matches.length === 0 ? (
                <p style={{ fontSize: 14, color: MUTED }}>
                  No strong match for that yet.{' '}
                  <Link href="/seekers" style={{ color: LINK }}>
                    Browse everyone
                  </Link>{' '}
                  instead.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ ...mono, fontSize: 10, color: MUTED, marginBottom: 10 }}>
                    {matches.length} match{matches.length > 1 ? 'es' : ''}
                  </div>
                  {matches.slice(0, 3).map((m) => (
                    <Link
                      key={m.id}
                      href={`/mentors/${m.id}`}
                      className="match-row"
                      style={{ textDecoration: 'none', color: 'inherit' }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 600 }}>
                          {m.firstName} {m.lastName}
                        </div>
                        <div style={{ fontSize: 13, color: MUTED, marginTop: 2 }}>{m.reason}</div>
                      </div>
                      <ArrowRight size={15} color={LINK} />
                    </Link>
                  ))}
                </div>
              )}
            </motion.div>
          )}
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

function Steps() {
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
    </section>
  );
}

function MentorGrid({ mentors }: { mentors: Mentor[] }) {
  if (mentors.length === 0) return null;
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

function Proof({ notes, mentorCount }: { notes: FeaturedNote[]; mentorCount: number }) {
  if (notes.length === 0) {
    if (mentorCount === 0) return null;
    return (
      <section style={{ maxWidth: MAX_PAGE_WIDTH, margin: '0 auto', padding: `clamp(56px, 9vh, 100px) ${GUTTER}` }}>
        <Reveal>
          <Rule />
          <div className="stat-row">
            <div>
              <div style={{ ...mono, fontSize: 11, color: MUTED, marginBottom: 12 }}>Mentors listed</div>
              <div style={{ fontSize: 'clamp(38px, 6vw, 60px)', fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1 }}>
                {mentorCount}
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

function FinalCta({ signedIn }: { signedIn: boolean }) {
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
            <Link href={signedIn ? '/seekers' : '/sign-up'} className="cta-primary">
              {signedIn ? 'Find a mentor' : 'Start for free'}
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

/**
 * Common questions, rendered as real content.
 *
 * The landing page previously had no answer to any qualifying question a
 * visitor arrives with — most importantly "is this free", which is asked in
 * search constantly and which the page never once said. It also gave the site
 * almost no indexable body text: the hero and three step titles are headline
 * copy, not the kind of prose that can match a query.
 *
 * The list is owned by page.tsx (the server component) and passed down, so the
 * same strings feed the FAQPage structured data and what a person reads. They
 * cannot drift apart, which is both a Google requirement and the only way this
 * stays honest.
 */
function Faq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <section
      id="faq"
      aria-labelledby="faq-heading"
      style={{ maxWidth: MAX_PAGE_WIDTH, margin: '0 auto', padding: `clamp(56px, 9vh, 100px) ${GUTTER}` }}
    >
      <Reveal>
        <Eyebrow>Common questions</Eyebrow>
        <h2
          id="faq-heading"
          style={{
            fontSize: 'clamp(30px, 4.4vw, 48px)',
            lineHeight: 1.06,
            letterSpacing: '-0.03em',
            fontWeight: 700,
            margin: '0 0 clamp(40px, 6vw, 64px)',
            maxWidth: 620,
          }}
        >
          Before you sign up.
        </h2>
      </Reveal>

      <div className="faq-grid">
        {items.map((item, i) => (
          <Reveal key={item.q} delay={Math.min(i, 3) * 0.05}>
            <h3 style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.01em', margin: '0 0 10px' }}>
              {item.q}
            </h3>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: MUTED, margin: 0 }}>{item.a}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

export default function Landing({ faq = [] }: { faq?: { q: string; a: string }[] }) {
  const { user, isLoaded } = useUser();
  const { isMentor, isSeeker } = useRoles();
  const router = useRouter();

  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [notes, setNotes] = useState<FeaturedNote[]>([]);
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [matching, setMatching] = useState(false);
  const [matchError, setMatchError] = useState('');

  useEffect(() => {
    let cancelled = false;

    fetch('/api/mentor?all=true')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Mentor[]) => {
        if (!cancelled) setMentors(Array.isArray(data) ? data : []);
      })
      .catch((err) => console.error('landing: mentor fetch failed', err));

    fetch('/api/sip-notes/featured')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: FeaturedNote[]) => {
        if (!cancelled) setNotes(Array.isArray(data) ? data : []);
      })
      .catch((err) => console.error('landing: notes fetch failed', err));

    return () => {
      cancelled = true;
    };
  }, []);

  const handleMatch = useCallback(
    async (query: string) => {
      const q = query.trim();
      if (!q) return;
      if (isLoaded && !user) {
        router.push('/sign-up');
        return;
      }
      setMatching(true);
      setMatchError('');
      try {
        const res = await fetch('/api/match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: q }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setMatchError(data.error || 'Could not run the match. Try again in a moment.');
          setMatches(null);
        } else {
          setMatches(data.matches ?? []);
        }
      } catch (err) {
        console.error('landing: match failed', err);
        setMatchError('Could not run the match. Try again in a moment.');
        setMatches(null);
      } finally {
        setMatching(false);
      }
    },
    [isLoaded, user, router]
  );

  return (
    <div style={{ background: BG, color: TEXT, minHeight: '100vh' }}>
      <Nav isMentor={isMentor} isSeeker={isSeeker} signedIn={!!user} />

      <main id="main-content">
        <Hero
          mentors={mentors}
          onMatch={handleMatch}
          matching={matching}
          matches={matches}
          matchError={matchError}
        />
        <Testimonials />
        <Steps />
        <MentorGrid mentors={mentors} />
        <Proof notes={notes} mentorCount={mentors.length} />
        <Faq items={faq} />
        <FinalCta signedIn={!!user} />
      </main>

      <Footer />

      <style>{`
        .hero-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: clamp(48px, 7vw, 72px);
          align-items: start;
        }
        .hero-field {
          display: flex;
          align-items: center;
          background: ${SURFACE};
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 14px;
          transition: border-color 200ms ease;
        }
        .hero-field:focus-within { border-color: rgba(112,181,249,0.55); }
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
        .match-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 14px 0;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          transition: opacity 180ms ease;
        }
        .match-row:hover { opacity: 0.65; }
        .section-head {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: clamp(36px, 5vw, 58px);
        }
        .step-row {
          display: grid;
          grid-template-columns: 46px minmax(0, 1fr);
          gap: 8px 20px;
          padding: clamp(26px, 3.4vw, 38px) 0;
        }
        .step-row h3 { grid-column: 2; }
        .step-row p { grid-column: 2; }
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
        .faq-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: clamp(28px, 4vw, 40px) clamp(32px, 5vw, 56px);
        }
        .text-link { transition: color 180ms ease; }
        .text-link:hover { color: ${LINK}; }

        @media (min-width: 720px) {
          .faq-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .mentor-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .mentor-card-lead { grid-column: span 2; }
          .proof-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
          .step-row { grid-template-columns: 92px minmax(0, 320px) minmax(0, 1fr); align-items: start; }
          .step-row h3 { grid-column: 2; }
          .step-row p { grid-column: 3; }
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
