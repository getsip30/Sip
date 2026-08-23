'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { useUser, useClerk } from '@clerk/nextjs';
import PixelAvatar from '@/components/PixelAvatar';
import { INTEREST_TAGS } from '@/lib/interests';
import { getOrCreateSessionId, saveQuizAnswer, trackQuizEvent } from '@/lib/quiz-session';
import { BG, SURFACE, BORDER, TEXT, MUTED, ACCENT, LINK } from '@/lib/theme';

type Mentor = {
  mentorId: string;
  name: string;
  shortBio: string;
  avatarData: string | null;
};

/** A category that does have open mentors, offered when the chosen one has none. */
type Alternate = { interest: string; openMentors: number };

type SuggestResponse =
  | { matched: true; mentor: Mentor }
  | { matched: false; suggestion: Alternate | null };

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
 *
 * There is no "maybe later" control on any step. The only way out is Escape,
 * kept because a dialog a keyboard user cannot dismiss is an accessibility
 * defect rather than a persuasion tactic. Clicking the backdrop does nothing:
 * it was the easiest way to lose four answers by accident.
 */

type Step =
  | 'intro'
  | 'interest'
  | 'about'
  | 'dream'
  | 'searching'
  /** Chosen interest has nobody open; offer a category that does. */
  | 'nomatch'
  /** They declined the alternative, or there was none. Signup with no mentor. */
  | 'nomentor'
  | 'reveal'
  | 'auth';

/** Steps that carry a progress indicator. The tail past 'dream' is not a quiz. */
const PROGRESS_STEPS: Step[] = ['intro', 'interest', 'about', 'dream'];

/** Starting chips for "tell us about yourself". Never saved; own words welcome. */
const VIBE_CHIPS = [
  'curious', 'hardworking', 'artistic', 'funny', 'competitive', 'quiet',
  'ambitious', 'chaotic', 'organised', 'stubborn',
];

/**
 * Ceiling on the about-yourself step, presets and typed-in words together.
 *
 * Five, because the answer is discarded the moment the quiz ends and the step
 * exists to be quick. Without a cap the chip field grows until it pushes the
 * Next button off a phone screen.
 */
const MAX_VIBES = 5;

/** Enough for a word or two. Anything longer stops looking like a chip. */
const MAX_VIBE_LENGTH = 24;

/**
 * Long enough for the step to register as a search rather than a flicker, short
 * enough that nobody sits waiting. The request is fired in parallel, so this is
 * a floor on the transition, not added latency.
 */
const SEARCH_MS = 1500;

/**
 * Clerk's modal backdrop. `modalBackdrop` is a published appearance element
 * key, so this class is part of Clerk's public surface rather than an internal
 * detail — see ElementsConfig in @clerk/shared.
 */
const CLERK_BACKDROP = '.cl-modalBackdrop';

/** How long to wait for Clerk's modal before assuming it will not open. */
const CLERK_OPEN_TIMEOUT_MS = 4000;

/**
 * Keys the browser scrolls the document with when nothing has focus.
 *
 * `overflow: hidden` below is what actually stops the page moving; this list
 * exists for the second half of the problem, which is that these keys still
 * *reach* the page — Space activating a focused button behind the overlay, an
 * arrow key moving a background carousel. Both are the same bug to someone
 * using the quiz.
 */
const SCROLL_KEYS = new Set([
  ' ', 'Spacebar', 'PageUp', 'PageDown', 'End', 'Home',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
]);

export default function MentorQuiz({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { isSignedIn, isLoaded } = useUser();
  const { openSignUp, openSignIn } = useClerk();

  const [step, setStep] = useState<Step>('intro');
  const [interest, setInterest] = useState<string | null>(null);
  const [vibes, setVibes] = useState<string[]>([]);
  const [vibeDraft, setVibeDraft] = useState('');
  const [dream, setDream] = useState('');
  const [mentor, setMentor] = useState<Mentor | null>(null);
  const [alternate, setAlternate] = useState<Alternate | null>(null);
  const [error, setError] = useState('');
  /**
   * Clerk's own modal is on screen. While it is, this card is hidden outright
   * rather than dimmed — two translucent cards stacked on one backdrop read as
   * a rendering fault, and only one of them can be interacted with anyway.
   */
  const [authOpen, setAuthOpen] = useState(false);
  /**
   * Retry counter, not decoration. A failed lookup leaves `step` on 'searching'
   * while the error is displayed, so setting it to 'searching' again changes
   * nothing and the effect below never re-runs. Bumping this is what makes
   * "Try again" actually try again.
   */
  const [attempt, setAttempt] = useState(0);

  /** The overlay layer. Used to tell "inside the flow" from "the page behind". */
  const overlayRef = useRef<HTMLDivElement | null>(null);

  /**
   * Whether any part of this flow is on screen. The lock below keys off this
   * rather than off `open` alone, because `open` can be true while Clerk has
   * not resolved the session yet and nothing is rendered.
   */
  const mounted = open && isLoaded && !isSignedIn;

  const reset = useCallback(() => {
    setStep('intro');
    setInterest(null);
    setVibes([]);
    setVibeDraft('');
    setDream('');
    setMentor(null);
    setAlternate(null);
    setError('');
    setAuthOpen(false);
    setAttempt(0);
  }, []);

  const close = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  /**
   * Escape closes — the one exit, and only while this card is the thing on
   * screen. Clerk's modal handles its own Escape, and without the `authOpen`
   * guard a single press would dismiss both, dropping someone out of the quiz
   * entirely when they meant to back out of the signup form.
   */
  useEffect(() => {
    if (!open || authOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, authOpen, close]);

  // Mint the anonymous session as soon as the quiz is opened, so the interest
  // saved a step later lands in a cookie that already exists rather than one
  // created mid-flow. The funnel events do not carry it — POST /api/events
  // takes identity from the Clerk session and nothing else.
  useEffect(() => {
    if (open) getOrCreateSessionId();
  }, [open]);

  /**
   * Freeze the page behind the flow.
   *
   * Keyed on `mounted`, so the lock is held for the whole flow — the quiz
   * steps, the auth step, and the time Clerk's own modal is up — rather than
   * being taken and released around one part of it. Clerk applies a lock of its
   * own on top; because ours is applied first, what Clerk captures and restores
   * is already `hidden`, so its close does not unlock the page underneath us.
   *
   * `overflow: hidden` on BOTH html and body: which of the two is the scrolling
   * element varies, and locking only body leaves the page scrollable in the
   * common case where html is the scroller.
   *
   * Not the `position: fixed` technique, which locks just as well but throws the
   * scroll position away and jumps the visitor to the top of the page when the
   * modal closes. The padding compensates for the scrollbar the lock removes,
   * so the landing page does not shift sideways underneath the overlay.
   */
  useEffect(() => {
    if (!mounted) return;

    const html = document.documentElement;
    const { body } = document;
    const prev = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      bodyPaddingRight: body.style.paddingRight,
    };

    const scrollbar = window.innerWidth - html.clientWidth;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;

    return () => {
      html.style.overflow = prev.htmlOverflow;
      body.style.overflow = prev.bodyOverflow;
      body.style.paddingRight = prev.bodyPaddingRight;
    };
  }, [mounted]);

  /**
   * Stop scroll keys reaching the page behind the flow.
   *
   * The overflow lock already prevents the document scrolling, so this is about
   * the rest of it: Space activating whatever button happened to have focus
   * when the modal opened, arrows moving something in the background.
   *
   * Capture phase, so it runs before anything behind the overlay sees the
   * event. The guard is where the event came from, not what key it was —
   * anything inside our overlay keeps its keys (Space on our buttons, arrows in
   * our text fields), and so does anything inside Clerk's modal, which is
   * portalled to <body> and therefore outside our overlay entirely. Without
   * that second clause this would break typing in Clerk's own form.
   */
  useEffect(() => {
    if (!mounted) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (!SCROLL_KEYS.has(e.key)) return;
      const target = e.target as Node | null;
      if (target && overlayRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest(CLERK_BACKDROP)) return;
      e.preventDefault();
    };

    window.addEventListener('keydown', onKeyDown, { capture: true, passive: false });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [mounted]);

  /**
   * Move focus into the card when it opens.
   *
   * Without this, focus stays on the "Find a match" button in the page behind,
   * which is both the thing that makes Space reach the background at all and an
   * accessibility problem in its own right — a screen reader user is not moved
   * to the dialog they just opened.
   */
  useEffect(() => {
    if (!mounted || authOpen) return;
    overlayRef.current?.focus({ preventScroll: true });
  }, [mounted, authOpen, step]);

  /**
   * Bring this card back when Clerk's modal goes away.
   *
   * Clerk gives no "modal closed" callback, so the DOM is the signal. Two
   * phases on purpose: the backdrop does not exist in the same tick as the
   * `openSignUp()` call, and reacting to its absence straight away would
   * un-hide the card before Clerk had mounted anything. Nothing happens until
   * the backdrop has been seen at least once.
   *
   * The timeout is the failure branch. If Clerk never opens — blocked script,
   * failed load — the card comes back rather than leaving someone looking at an
   * empty blurred screen with no way forward.
   */
  useEffect(() => {
    if (!authOpen) return;

    let seen = false;
    let settled = false;
    let confirming: ReturnType<typeof setTimeout> | null = null;

    const present = () => !!document.querySelector(CLERK_BACKDROP);

    const finish = () => {
      if (settled) return;
      settled = true;
      setAuthOpen(false);
    };

    const check = () => {
      if (present()) {
        seen = true;
        // Clerk swaps sign-up for sign-in in place, and a swap that tears the
        // backdrop down and puts it straight back would otherwise read as a
        // close. Any reappearance cancels a pending close.
        if (confirming) { clearTimeout(confirming); confirming = null; }
        return;
      }
      if (!seen || confirming) return;
      confirming = setTimeout(() => { if (!present()) finish(); }, 150);
    };

    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true });
    check();

    const timer = setTimeout(() => { if (!seen) finish(); }, CLERK_OPEN_TIMEOUT_MS);

    return () => {
      observer.disconnect();
      clearTimeout(timer);
      if (confirming) clearTimeout(confirming);
    };
  }, [authOpen]);

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

        if (!res.ok) {
          setError(data?.error || 'Could not find a mentor just now. Try again in a moment.');
          return;
        }

        const payload = data as SuggestResponse;

        // Nobody open under this tag. Hand off to the fallback step rather than
        // restarting the quiz or substituting an off-topic mentor: they have
        // already answered four questions and neither of those respects that.
        if (!payload.matched) {
          setAlternate(payload.suggestion);
          // No alternative to offer means the whole directory is empty, so
          // there is no question worth asking — go straight to the honest
          // version of the answer.
          setStep(payload.suggestion ? 'nomatch' : 'nomentor');
          return;
        }

        setMentor(payload.mentor);
        // Fires on the reveal, not on the request: this step means "was shown a
        // mentor", and the fallback paths below never show one.
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
  /**
   * Where Clerk sends them after signup. /quiz/complete claims the interest
   * either way and then forwards: to the matched mentor with ?from=quiz, or to
   * the seeker dashboard when there is no mentor to forward to.
   */
  const redirectUrl = mentor
    ? `/quiz/complete?mentorId=${encodeURIComponent(mentor.mentorId)}`
    : '/quiz/complete';

  const atVibeCap = vibes.length >= MAX_VIBES;
  /** Typed-in words, in the order they were added, rendered after the presets. */
  const customVibes = vibes.filter(v => !VIBE_CHIPS.includes(v));

  function startAuth(mode: 'signUp' | 'signIn') {
    // Hidden before the call, not after: Clerk mounts on a later frame, and
    // hiding afterwards would show both cards for that frame.
    setAuthOpen(true);
    if (mode === 'signUp') openSignUp({ forceRedirectUrl: redirectUrl });
    else openSignIn({ forceRedirectUrl: redirectUrl });
  }

  function toggleVibe(v: string) {
    setVibes(cur => {
      if (cur.includes(v)) return cur.filter(x => x !== v);
      if (cur.length >= MAX_VIBES) return cur;
      return [...cur, v];
    });
  }

  /**
   * Turn the typed word into a chip. Deliberately unvalidated beyond a length
   * cap and a duplicate check — the answer is thrown away, so garbage is fine
   * and there is nothing here that tries to interpret it.
   */
  function commitVibeDraft() {
    const word = vibeDraft.trim().slice(0, MAX_VIBE_LENGTH);
    if (!word || atVibeCap) return;
    // Case-insensitive, so typing "Curious" next to the "curious" preset does
    // not produce two chips that look like a bug.
    if (vibes.some(v => v.toLowerCase() === word.toLowerCase())) {
      setVibeDraft('');
      return;
    }
    setVibes(cur => [...cur, word]);
    setVibeDraft('');
  }

  /**
   * Take the offered category: overwrite the persisted interest and re-run the
   * lookup. Overwrite rather than remember both — the interest is what gets
   * attached to their account, and the tag they are about to be shown a mentor
   * from is the truer answer to "what are you into" than the one that had
   * nobody in it.
   */
  function acceptAlternate(next: string) {
    saveQuizAnswer('interest', next);
    setInterest(next);
    setAlternate(null);
    setStep('searching');
  }

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

  /** Same button, visibly inert. Used wherever a step still needs an answer. */
  const disabledButton: React.CSSProperties = {
    ...primaryButton,
    background: 'rgba(255,255,255,0.07)',
    color: MUTED,
    cursor: 'not-allowed',
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

  const chip = (selected: boolean, muted = false): React.CSSProperties => ({
    padding: '7px 15px',
    borderRadius: 20,
    border: '1px solid',
    borderColor: selected ? ACCENT : BORDER,
    background: selected ? 'rgba(10,102,194,0.2)' : 'transparent',
    color: selected ? LINK : MUTED,
    fontSize: 13,
    fontFamily: 'inherit',
    cursor: muted ? 'not-allowed' : 'pointer',
    opacity: muted ? 0.4 : 1,
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

      // No Next button, by design: choosing a chip is both the answer and the
      // advance, so this step cannot be passed without one.
      case 'interest':
        return (
          <>
            <h3 style={{ fontSize: 21, fontWeight: 700, marginBottom: 8 }}>What are you into?</h3>
            <p style={{ color: MUTED, fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>Pick the one that fits best.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {INTEREST_TAGS.map(tag => (
                <button key={tag} onClick={() => submitInterest(tag)} style={chip(interest === tag)}>{tag}</button>
              ))}
            </div>
          </>
        );

      case 'about':
        return (
          <>
            <h3 style={{ fontSize: 21, fontWeight: 700, marginBottom: 8 }}>Tell us about yourself.</h3>
            <p style={{ color: MUTED, fontSize: 14, lineHeight: 1.6, marginBottom: 18 }}>
              Pick a few, or type your own. No wrong answers, and nobody is grading this.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {VIBE_CHIPS.map(v => {
                const selected = vibes.includes(v);
                // At the cap the unselected presets go inert rather than
                // disappearing — the list staying put is what makes the cap
                // legible instead of looking like the chips broke.
                const blocked = atVibeCap && !selected;
                return (
                  <button
                    key={v}
                    onClick={() => toggleVibe(v)}
                    disabled={blocked}
                    style={chip(selected, blocked)}
                  >
                    {v}
                  </button>
                );
              })}
              {customVibes.map(v => (
                <button
                  key={v}
                  onClick={() => toggleVibe(v)}
                  style={chip(true)}
                  aria-label={`Remove ${v}`}
                  title="Remove"
                >
                  {v} ×
                </button>
              ))}
            </div>

            <input
              value={vibeDraft}
              onChange={e => setVibeDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key !== 'Enter') return;
                // There is no form around this card, but Enter in a text field
                // is still a submit gesture to most people. Take it, and make
                // it mean "add the chip".
                e.preventDefault();
                commitVibeDraft();
              }}
              maxLength={MAX_VIBE_LENGTH}
              disabled={atVibeCap}
              placeholder={atVibeCap ? `That's ${MAX_VIBES} — remove one to add another` : 'Or type your own, then press Enter'}
              aria-label="Add your own word"
              style={{ ...textField, marginBottom: 12, opacity: atVibeCap ? 0.5 : 1 }}
            />

            <p style={{ color: MUTED, fontSize: 12, marginBottom: 18 }}>
              {vibes.length} of {MAX_VIBES}
            </p>

            <button
              style={vibes.length > 0 ? primaryButton : disabledButton}
              disabled={vibes.length === 0}
              onClick={() => setStep('dream')}
            >
              Next →
            </button>
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
              onKeyDown={e => {
                // Enter advances only when there is something to advance with,
                // so it cannot be used to skip what the button will not.
                if (e.key === 'Enter' && dream.trim()) setStep('searching');
              }}
            />
            <button
              style={dream.trim() ? primaryButton : disabledButton}
              disabled={!dream.trim()}
              onClick={() => setStep('searching')}
            >
              Find my mentor →
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

      case 'nomatch':
        if (!alternate) return null;
        return (
          <>
            <h3 style={{ fontSize: 21, fontWeight: 700, marginBottom: 10 }}>
              No {interest} mentors are open right now.
            </h3>
            <p style={{ color: MUTED, fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
              But we&apos;ve got people in{' '}
              <span style={{ color: TEXT, fontWeight: 600 }}>{alternate.interest}</span> —{' '}
              {alternate.openMentors} open right now.
            </p>
            <button style={primaryButton} onClick={() => acceptAlternate(alternate.interest)}>
              Yes, show me {alternate.interest}
            </button>
            <button
              onClick={() => setStep('nomentor')}
              style={{ ...primaryButton, background: 'transparent', border: `1px solid ${BORDER}`, color: MUTED, marginTop: 10 }}
            >
              No thanks
            </button>
          </>
        );

      case 'nomentor':
        return (
          <>
            <h3 style={{ fontSize: 21, fontWeight: 700, marginBottom: 10 }}>No worries.</h3>
            <p style={{ color: MUTED, fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
              Sign up and we&apos;ll keep you posted as new mentors join.
            </p>
            <button style={primaryButton} onClick={() => setStep('auth')}>Sign me up →</button>
          </>
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

      /*
       * Deliberately built from the same parts as every other step: the 21/700
       * heading, the 14/1.6 muted paragraph, the full-width primary button, and
       * the transparent-with-border secondary the 'nomatch' step already uses.
       *
       * It previously ended on an inline underlined text link, which was the
       * only control of its kind in the flow and was what made this screen read
       * as a different, less finished one. The mentor strip is the same inset
       * panel <AppTour> uses for its step label — BG on SURFACE, 1px border,
       * radius 14 — and carries the reveal's avatar forward so the step does
       * not look like it belongs to some other product.
       */
      case 'auth':
        return (
          <>
            <h3 style={{ fontSize: 21, fontWeight: 700, marginBottom: 8 }}>You&apos;re not signed in. Let&apos;s fix that.</h3>
            <p style={{ color: MUTED, fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
              {mentor
                ? 'Make an account and we’ll take you straight to your match. It’s free, and it takes a minute.'
                : 'Make an account and we’ll email you the moment someone who fits comes along. It’s free, and it takes a minute.'}
            </p>

            {mentor && (
              <div
                style={{
                  background: BG, border: `1px solid ${BORDER}`, borderRadius: 14,
                  padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 13, marginBottom: 20,
                }}
              >
                <PixelAvatar data={mentor.avatarData} size={40} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: ACCENT, textTransform: 'uppercase', marginBottom: 3 }}>
                    Your match
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: TEXT }}>{mentor.name}</div>
                </div>
              </div>
            )}

            {/*
              Clerk's own modal rather than an embedded <SignUp>. The embed needs
              path or hash routing, and hash routing on the landing page would
              rewrite the URL fragment out from under the in-page anchors
              (#how-it-works and the skip link). forceRedirectUrl outranks every
              other redirect source, so the mentor id survives the round trip.
              This card hides itself while that modal is up — see `authOpen`.
            */}
            <button style={primaryButton} onClick={() => startAuth('signUp')}>
              Create my account
            </button>
            <button
              onClick={() => startAuth('signIn')}
              style={{ ...primaryButton, background: 'transparent', border: `1px solid ${BORDER}`, color: MUTED, marginTop: 10 }}
            >
              I already have one
            </button>
            <p style={{ color: MUTED, fontSize: 12, lineHeight: 1.5, textAlign: 'center', marginTop: 16 }}>
              Free, and no cold outreach — ever.
            </p>
          </>
        );
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        ref={overlayRef}
        // Focusable so the card can take focus on open without putting a tab
        // stop in anyone's way; -1 keeps it out of the tab order.
        tabIndex={-1}
        initial={{ opacity: 0 }}
        animate={{ opacity: authOpen ? 0 : 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        aria-hidden={authOpen}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(4,7,13,0.72)',
          backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
          zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          // A card taller than the viewport scrolls inside the overlay. The
          // page behind is locked, so without this there would be no way to
          // reach the bottom of the interest step on a short screen.
          overflowY: 'auto',
          outline: 'none',
          // The whole layer steps aside for Clerk's modal, backdrop included.
          // Hiding only the card would leave this blur stacked under Clerk's
          // own, which is half of what made the two look disjointed.
          pointerEvents: authOpen ? 'none' : 'auto',
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
          {/*
            Same close control the feedback widget uses — lucide <X> at 16,
            no chrome, muted until hovered — rather than a new one. It sits in
            its own row instead of floating over the card's corner, so it
            cannot land on top of the progress bar below it.

            Escape still works; this is the pointer equivalent, not a
            replacement for it.
          */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button
              onClick={close}
              aria-label="Close"
              style={{ background: 'none', border: 'none', color: MUTED, cursor: 'pointer', padding: 2, display: 'flex' }}
            >
              <X size={16} />
            </button>
          </div>

          {progressIndex >= 0 && (
            <div style={{ display: 'flex', gap: 5, marginBottom: 24 }} aria-hidden="true">
              {PROGRESS_STEPS.map((_, n) => (
                <div key={n} style={{ flex: 1, height: 3, borderRadius: 4, background: n <= progressIndex ? ACCENT : BORDER }} />
              ))}
            </div>
          )}

          {body()}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
