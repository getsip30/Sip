'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser, useClerk } from '@clerk/nextjs';
import PixelAvatar from '@/components/PixelAvatar';
import { QUIZ_INTERESTS } from '@/lib/quiz';
import { getOrCreateSessionId, saveQuizAnswer, trackQuizEvent } from '@/lib/quiz-session';
import { BG, SURFACE, BORDER, TEXT, MUTED, ACCENT, LINK } from '@/lib/theme';

type Suggestion = {
  mentorId: string;
  name: string;
  shortBio: string;
  avatarData: string | null;
};

/**
 * The landing-page mentor-match quiz.
 *
 * Visual shell is the same one <AppTour> uses — fixed overlay, centred card,
 * segmented progress, Next button — rather than a second modal system. It is a
 * copy rather than a shared component because AppTour is a linear reader of a
 * static `steps` array with no per-step state, and the two would have to fight
 * over control flow for this to branch, fetch, and gate on auth.
 *
 * Only the interest step is ever persisted. The two questions after it are
 * component state and are gone the moment this unmounts — that is the whole
 * point of them, and nothing here should ever try to read or interpret them.
 */

type Step = 'intro' | 'interest' | 'about' | 'dream' | 'searching' | 'reveal' | 'auth';

/** Steps that carry a progress indicator. The tail past 'dream' is not a quiz. */
const PROGRESS_STEPS: Step[] = ['intro', 'interest', 'about', 'dream'];

/** Throwaway chips for the "tell us about yourself" step. Never saved. */
const VIBE_CHIPS = [
  'curious', 'hardworking', 'artistic', 'funny', 'competitive', 'quiet',
  'ambitious', 'chaotic', 'organised', 'stubborn',
];

/**
 * Long enough for the step to register as a search rather than a flicker, short
 * enough that nobody sits waiting. The request is fired in parallel, so this is
 * a floor on the transition, not added latency.
 */
const SEARCH_MS = 1500;

export default function MentorQuiz({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { isSignedIn, isLoaded } = useUser();
  const { openSignUp, openSignIn } = useClerk();

  const [step, setStep] = useState<Step>('intro');
  const [interest, setInterest] = useState<string | null>(null);
  const [vibes, setVibes] = useState<string[]>([]);
  const [dream, setDream] = useState('');
  const [mentor, setMentor] = useState<Suggestion | null>(null);
  const [error, setError] = useState('');
  /**
   * Retry counter, not decoration. A failed lookup leaves `step` on 'searching'
   * while the error is displayed, so setting it to 'searching' again changes
   * nothing and the effect below never re-runs. Bumping this is what makes
   * "Try again" actually try again.
   */
  const [attempt, setAttempt] = useState(0);

  const reset = useCallback(() => {
    setStep('intro');
    setInterest(null);
    setVibes([]);
    setDream('');
    setMentor(null);
    setError('');
    setAttempt(0);
  }, []);

  const close = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  // Escape closes, matching every other overlay on the site. Bound only while
  // open so the landing page is not carrying a key listener it never uses.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  // Mint the anonymous session as soon as the quiz is opened, so the funnel
  // events fired later all carry the same id.
  useEffect(() => {
    if (open) getOrCreateSessionId();
  }, [open]);

  /**
   * The mentor lookup. The minimum-duration floor and the request race each
   * other rather than running in sequence — waiting out the animation and then
   * starting the fetch would double the time on this step for no benefit.
   */
  useEffect(() => {
    if (step !== 'searching' || !interest) return;
    let cancelled = false;

    const settle = async () => {
      const started = Date.now();
      try {
        const res = await fetch(`/api/mentors/suggest?interest=${encodeURIComponent(interest)}`);
        const data = await res.json().catch(() => ({}));
        const wait = Math.max(0, SEARCH_MS - (Date.now() - started));
        await new Promise(r => setTimeout(r, wait));
        if (cancelled) return;

        if (!res.ok || !data?.mentorId) {
          setError(data?.error || 'Could not find a mentor just now. Try again in a moment.');
          return;
        }
        setMentor(data as Suggestion);
        trackQuizEvent('quiz_completed');
        setStep('reveal');
      } catch {
        if (!cancelled) setError('Could not find a mentor just now. Try again in a moment.');
      }
    };

    void settle();
    return () => { cancelled = true; };
  }, [step, interest, attempt]);

  // Signed-out only, full stop. Checked here as well as at the call site so the
  // rule holds no matter how the quiz gets opened, including a session that
  // becomes active in another tab while the modal is on screen.
  if (!open || !isLoaded || isSignedIn) return null;

  const progressIndex = PROGRESS_STEPS.indexOf(step);
  const redirectUrl = mentor ? `/quiz/complete?mentorId=${encodeURIComponent(mentor.mentorId)}` : '/quiz/complete';

  function submitInterest(tag: string) {
    setInterest(tag);
    // The one answer that outlives the modal.
    saveQuizAnswer('interest', tag);
    trackQuizEvent('quiz_started');
    setStep('about');
  }

  const primaryButton: React.CSSProperties = {
    width: '100%',
    background: ACCENT,
    border: 'none',
    color: '#fff',
    padding: '13px',
    borderRadius: 12,
    fontSize: 14.5,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  };

  const ghostButton: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: MUTED,
    fontSize: 12.5,
    cursor: 'pointer',
    fontFamily: 'inherit',
  };

  const textField: React.CSSProperties = {
    width: '100%',
    background: BG,
    border: `1px solid ${BORDER}`,
    borderRadius: 12,
    padding: '13px 14px',
    color: TEXT,
    fontSize: 14,
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const chip = (selected: boolean): React.CSSProperties => ({
    padding: '7px 15px',
    borderRadius: 20,
    border: '1px solid',
    borderColor: selected ? ACCENT : BORDER,
    background: selected ? 'rgba(10,102,194,0.2)' : 'transparent',
    color: selected ? LINK : MUTED,
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: 'inherit',
  });

  function body() {
    if (error) {
      return (
        <>
          <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>That didn&apos;t go to plan.</h3>
          <p style={{ color: MUTED, fontSize: 14, lineHeight: 1.6, marginBottom: 22 }}>{error}</p>
          <button
            style={primaryButton}
            onClick={() => { setError(''); setStep('searching'); setAttempt(n => n + 1); }}
          >
            Try again
          </button>
          <p style={{ marginTop: 14, fontSize: 13, color: MUTED, textAlign: 'center' }}>
            or <Link href="/seekers" style={{ color: LINK }} onClick={close}>browse everyone</Link>
          </p>
        </>
      );
    }

    switch (step) {
      case 'intro':
        return (
          <>
            <h3 style={{ fontSize: 22, fontWeight: 700, marginBottom: 10 }}>
              Hey, I see you&apos;re here to look for a mentor. I gotchu.
            </h3>
            <p style={{ color: MUTED, fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
              Four quick questions, then I&apos;ll put someone in front of you. Takes about twenty seconds.
            </p>
            <button style={primaryButton} onClick={() => setStep('interest')}>Next →</button>
          </>
        );

      case 'interest':
        return (
          <>
            <h3 style={{ fontSize: 21, fontWeight: 700, marginBottom: 8 }}>What are you into?</h3>
            <p style={{ color: MUTED, fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>Pick the one that fits best.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {QUIZ_INTERESTS.map(tag => (
                <button key={tag} onClick={() => submitInterest(tag)} style={chip(interest === tag)}>{tag}</button>
              ))}
            </div>
          </>
        );

      case 'about':
        return (
          <>
            <h3 style={{ fontSize: 21, fontWeight: 700, marginBottom: 8 }}>Tell us about yourself.</h3>
            <p style={{ color: MUTED, fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
              Pick as many as you like. No wrong answers, and nobody is grading this.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 22 }}>
              {VIBE_CHIPS.map(v => (
                <button
                  key={v}
                  onClick={() => setVibes(cur => cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v])}
                  style={chip(vibes.includes(v))}
                >
                  {v}
                </button>
              ))}
            </div>
            <button style={primaryButton} onClick={() => setStep('dream')}>Next →</button>
          </>
        );

      case 'dream':
        return (
          <>
            <h3 style={{ fontSize: 21, fontWeight: 700, marginBottom: 8 }}>Your dream, in one line.</h3>
            <p style={{ color: MUTED, fontSize: 14, lineHeight: 1.6, marginBottom: 18 }}>
              Go big. This one is just between us.
            </p>
            <input
              value={dream}
              onChange={e => setDream(e.target.value)}
              maxLength={140}
              placeholder="Run design at a company people have heard of"
              style={{ ...textField, marginBottom: 22 }}
              onKeyDown={e => { if (e.key === 'Enter') setStep('searching'); }}
            />
            <button style={primaryButton} onClick={() => setStep('searching')}>
              {dream.trim() ? 'Find my mentor →' : 'Skip, find my mentor →'}
            </button>
          </>
        );

      case 'searching':
        return (
          <div style={{ textAlign: 'center', padding: '20px 0 10px' }}>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
              style={{
                width: 42, height: 42, margin: '0 auto 22px', borderRadius: '50%',
                border: `3px solid ${BORDER}`, borderTopColor: ACCENT,
              }}
            />
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Searching for a mentor for you</h3>
            <p style={{ color: MUTED, fontSize: 14 }}>Reading the room for {interest}…</p>
          </div>
        );

      case 'reveal':
        if (!mentor) return null;
        return (
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
              <PixelAvatar data={mentor.avatarData} size={104} />
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: ACCENT, textTransform: 'uppercase', marginBottom: 10 }}>
              Your match
            </div>
            <h3 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 12 }}>{mentor.name}</h3>
            <p style={{ color: MUTED, fontSize: 14.5, lineHeight: 1.65, marginBottom: 26 }}>{mentor.shortBio}</p>
            <button style={primaryButton} onClick={() => setStep('auth')}>Let&apos;s get you matched.</button>
          </div>
        );

      case 'auth':
        return (
          <>
            <h3 style={{ fontSize: 21, fontWeight: 700, marginBottom: 8 }}>You&apos;re not signed in. Let&apos;s fix that.</h3>
            <p style={{ color: MUTED, fontSize: 14, lineHeight: 1.6, marginBottom: 22 }}>
              Make an account and we&apos;ll take you straight to{' '}
              <span style={{ color: TEXT, fontWeight: 600 }}>{mentor?.name ?? 'your match'}</span>. It&apos;s free, and it
              takes a minute.
            </p>
            {/*
              Clerk's own modal rather than an embedded <SignUp>. The embed needs
              path or hash routing, and hash routing on the landing page would
              rewrite the URL fragment out from under the in-page anchors
              (#how-it-works and the skip link). forceRedirectUrl outranks every
              other redirect source, so the mentor id survives the round trip.
            */}
            <button style={primaryButton} onClick={() => openSignUp({ forceRedirectUrl: redirectUrl })}>
              Create my account
            </button>
            <p style={{ marginTop: 16, fontSize: 13, color: MUTED, textAlign: 'center' }}>
              Already have one?{' '}
              <button
                onClick={() => openSignIn({ forceRedirectUrl: redirectUrl })}
                style={{ ...ghostButton, color: LINK, fontSize: 13, textDecoration: 'underline' }}
              >
                Sign in
              </button>
            </p>
          </>
        );
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={e => { if (e.target === e.currentTarget) close(); }}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(4,7,13,0.72)',
          backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
          zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}
      >
        <motion.div
          key={step}
          initial={{ scale: 0.94, opacity: 0, y: 16 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-label="Find a mentor"
          style={{
            background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 20,
            padding: 28, width: '100%', maxWidth: step === 'reveal' ? 480 : 460,
          }}
        >
          {progressIndex >= 0 && (
            <div style={{ display: 'flex', gap: 5, marginBottom: 24 }} aria-hidden="true">
              {PROGRESS_STEPS.map((_, n) => (
                <div key={n} style={{ flex: 1, height: 3, borderRadius: 4, background: n <= progressIndex ? ACCENT : BORDER }} />
              ))}
            </div>
          )}

          {body()}

          {step !== 'searching' && (
            <button onClick={close} style={{ ...ghostButton, display: 'block', margin: '18px auto 0' }}>
              Maybe later
            </button>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
