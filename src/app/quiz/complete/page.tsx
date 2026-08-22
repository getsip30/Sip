'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import Logo from '@/components/Logo';
import { isUuid } from '@/lib/validate';
import { getQuizAnswer, getOrCreateSessionId, clearQuizSession } from '@/lib/quiz-session';
import { BG, TEXT, MUTED } from '@/lib/theme';

/**
 * Handoff between Clerk and the mentor the quiz picked.
 *
 * Clerk redirects here after signup (or sign-in) from the quiz's auth step,
 * because the sign-up page's own forceRedirectUrl points at /choose-role and
 * this flow must not disturb it. This is the first moment the interest chosen
 * by an anonymous visitor has an account to belong to, so it is written here
 * and the cookies are dropped immediately afterwards.
 *
 * Not gated by middleware and deliberately forgiving: every failure path still
 * ends with the visitor on a real page. Losing an analytics row is an
 * acceptable outcome, stranding someone on a spinner is not.
 */

function QuizCompleteInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { isLoaded, isSignedIn } = useUser();
  const [message, setMessage] = useState('Getting you matched…');

  // A redirect is fired from an effect, and React will run that effect twice in
  // development. Without this the claim POSTs twice — harmless, because the
  // endpoint is idempotent, but there is no reason to make it prove that.
  const ran = useRef(false);

  useEffect(() => {
    if (!isLoaded || ran.current) return;
    ran.current = true;

    const mentorId = params.get('mentorId');
    const destination = mentorId && isUuid(mentorId) ? `/mentors/${mentorId}?from=quiz` : '/seekers';

    // Signing up is the only way to reach this page. If somebody lands here
    // without a session, there is nothing to attach anything to — send them on
    // rather than showing an error for a state they cannot act on.
    if (!isSignedIn) {
      router.replace(destination);
      return;
    }

    const interest = getQuizAnswer('interest');

    const finish = async () => {
      if (interest) {
        try {
          await fetch('/api/quiz/claim', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              interest,
              mentorId: mentorId && isUuid(mentorId) ? mentorId : null,
              sessionId: getOrCreateSessionId(),
            }),
          });
        } catch (err) {
          // The interest is a nice-to-have on the profile; the match is the
          // thing they were promised. Log it and carry on to the mentor.
          console.error('quiz: claim failed', err);
        }
      }
      // Cleared whether or not the write landed. Retrying it later would mean
      // leaving an anonymous session cookie on a signed-in browser for a day,
      // and this page is not coming back.
      clearQuizSession();
      setMessage('Taking you to your match…');
      router.replace(destination);
    };

    void finish();
  }, [isLoaded, isSignedIn, params, router]);

  return (
    <div style={{
      background: BG, color: TEXT, minHeight: '100vh', display: 'flex',
      flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24,
    }}>
      <Logo />
      <p style={{ color: MUTED, fontSize: 14 }}>{message}</p>
    </div>
  );
}

export default function QuizCompletePage() {
  return (
    <Suspense fallback={null}>
      <QuizCompleteInner />
    </Suspense>
  );
}
