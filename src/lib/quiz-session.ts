'use client';

import Cookies from 'js-cookie';
import type { EventType } from '@/lib/events';

/**
 * The anonymous session behind the landing-page quiz.
 *
 * Everything here is browser-only and first-party. There is no server session:
 * a signed-out visitor has no account to key anything to, and the one value
 * worth carrying across the signup redirect (their chosen interest) is not
 * sensitive. A cookie rather than localStorage because it survives the Clerk
 * round trip identically and expires on its own.
 *
 * The fun questions in the middle of the quiz never come through here. They are
 * component state, thrown away when the modal closes, and `saveQuizAnswer` is
 * only ever called with 'interest'.
 */

const SESSION_COOKIE = 'sip_session_id';
const ANSWERS_COOKIE = 'sip_quiz_answers';

/** One day. Long enough to finish a signup, short enough not to be tracking. */
const EXPIRY_DAYS = 1;

/**
 * `secure` is conditional because a cookie with the flag set is silently
 * dropped on plain http, which would make the whole quiz appear to lose its
 * state on a local dev server. SameSite=Lax is enough here: the value is read
 * by our own page after a top-level redirect back from Clerk, which Lax allows.
 */
const COOKIE_OPTIONS: Cookies.CookieAttributes = {
  expires: EXPIRY_DAYS,
  path: '/',
  sameSite: 'lax',
  secure: typeof window !== 'undefined' && window.location.protocol === 'https:',
};

/**
 * crypto.randomUUID is unavailable outside a secure context, which includes
 * plain-http staging and older in-app browsers. Falling back to a random string
 * matters because the id is only ever a correlation key for funnel rows — a
 * weaker one degrades analytics, whereas throwing would break the quiz.
 */
function newSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `s_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

/** The visitor's anonymous session id, creating and persisting one if needed. */
export function getOrCreateSessionId(): string {
  const existing = Cookies.get(SESSION_COOKIE);
  if (existing) return existing;
  const id = newSessionId();
  Cookies.set(SESSION_COOKIE, id, COOKIE_OPTIONS);
  return id;
}

function readAnswers(): Record<string, string> {
  const raw = Cookies.get(ANSWERS_COOKIE);
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    // A cookie is user-editable, so this has to survive being handed anything.
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === 'string') out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Persist one quiz answer for the length of the session.
 *
 * Only 'interest' is ever passed. The key/value shape is kept because the
 * cookie is a bag rather than a single value, and a caller that needs a second
 * durable answer later should not have to reshape the cookie to add one.
 */
export function saveQuizAnswer(key: string, value: string): void {
  const answers = { ...readAnswers(), [key]: value };
  Cookies.set(ANSWERS_COOKIE, JSON.stringify(answers), COOKIE_OPTIONS);
}

export function getQuizAnswer(key: string): string | null {
  return readAnswers()[key] ?? null;
}

/**
 * Drop both cookies. Called once the interest has been written to the database,
 * so a signed-in user is not carrying a stale anonymous session around.
 */
export function clearQuizSession(): void {
  Cookies.remove(ANSWERS_COOKIE, { path: '/' });
  Cookies.remove(SESSION_COOKIE, { path: '/' });
}

/**
 * Imperative funnel logging for the quiz's mid-flow steps.
 *
 * Posts to POST /api/events — the same endpoint and the same body shape
 * <TrackEvent> uses — rather than introducing a second analytics path. The
 * difference is only in when it fires: TrackEvent records a page view once on
 * mount, whereas these fire at two specific points inside a modal that never
 * changes route.
 *
 * Deliberately swallows every failure. A rate-limited or offline analytics
 * write must never interrupt someone moving through the quiz. `keepalive` lets
 * the request outlive the navigation when the event is logged immediately
 * before a redirect.
 */
export function trackQuizEvent(eventType: Extract<EventType, 'quiz_started' | 'quiz_completed'>): void {
  try {
    void fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Ignored — see above.
  }
}
