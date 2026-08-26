'use client';
import { useEffect, useRef } from 'react';
import type { EventType } from '@/lib/events';

/**
 * Records one funnel page-view event, from the browser.
 *
 * The two view steps are logged client-side rather than from the server
 * component, on purpose: the landing page and the mentor directory are the
 * site's most SEO-valuable pages and both render statically today. Logging from
 * the server would mean reading a request header or calling a dynamic API,
 * which opts the whole route out of static rendering to record an analytics
 * row. Firing after hydration costs those pages nothing.
 *
 * The trade is that a visitor with JavaScript disabled, and a crawler that does
 * not execute it, are not counted. For a funnel measuring people who go on to
 * sign up, that is the right population anyway.
 */
export default function TrackEvent({ type }: { type: EventType }) {
  // Guards the double-invocation of effects in development StrictMode, which
  // would otherwise log every view twice locally.
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    // One per event per tab. A funnel counts distinct people, so re-logging on
    // every soft navigation back to the page would inflate the step without
    // adding a person. sessionStorage rather than localStorage: a visit days
    // later is genuinely a new visit.
    const key = `sip:ev:${type}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {
      // Storage can be unavailable (private mode, blocked cookies). Log anyway
      // and accept the duplicate; losing the event entirely is worse.
    }

    // keepalive so the request survives the user navigating away immediately,
    // which on a landing page is the common case. Failures are ignored: this is
    // analytics, and there is nothing useful to tell the user.
    fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType: type }),
      keepalive: true,
    }).catch(() => {});
  }, [type]);

  return null;
}
