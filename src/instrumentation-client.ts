// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://2e0a90137762613350671c81da75b346@o4511686725009409.ingest.us.sentry.io/4511686739427328",

  /**
   * Was 1 — the value the Sentry wizard scaffolds, next to a comment telling you
   * to adjust it in production. It never was. Every single page load opened a
   * trace and ran the browser-tracing instrumentation that goes with it.
   *
   * 0.1 matches replaysSessionSampleRate below, so a sampled session is roughly
   * as likely to have a trace as a replay and the two line up when reading an
   * issue. The server and edge configs are still at 1; those cost the browser
   * nothing and are left for a separate decision about Sentry quota.
   */
  tracesSampleRate: 0.1,
  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Define how likely Replay events are sampled.
  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: 0.1,

  // Define how likely Replay events are sampled when an error occurs.
  replaysOnErrorSampleRate: 1.0,

  dataCollection: {
    // To disable sending user data and HTTP bodies, uncomment the lines below. For more info visit:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#dataCollection
    // userInfo: false,
    // httpBodies: [],
  },
});

/**
 * Session Replay, added after the page is interactive rather than at init.
 *
 * replayIntegration() used to sit in the `integrations` array above, which put
 * the whole recorder in the entry chunk: downloaded, parsed and executed by
 * every visitor on every page, to record 10% of sessions. It is DOM-observing
 * code, so the cost is not only the bytes — it instruments the document as soon
 * as it initialises, during the same stretch of main thread that hydration
 * needs. Lighthouse measured 12.6s of total blocking time on the homepage.
 *
 * Adding it through addIntegration() on an idle callback keeps the feature and
 * moves it out of the critical path. requestIdleCallback deliberately will not
 * fire until the browser has finished the long hydration task, which is exactly
 * when we want this to happen; the timeout is the ceiling for a page that never
 * goes idle.
 *
 * The trade: errors thrown in the first moments of a page load now happen
 * before the recorder exists and will not carry a replay. That is the same
 * window Sentry's own lazy-loading guidance accepts, and it buys back the
 * blocking time for every visitor whether or not their session is sampled.
 */
function addReplayWhenIdle() {
  const start = () => {
    import("@sentry/nextjs")
      .then(({ replayIntegration }) => {
        Sentry.addIntegration(replayIntegration());
      })
      .catch(() => {
        // Best-effort. A failed replay load must never surface to the user, and
        // reporting it through Sentry would be reporting Sentry to itself.
      });
  };

  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(start, { timeout: 5000 });
  } else {
    // Safari <16.4 has no requestIdleCallback. A plain timeout is coarser but
    // still lands well after the initial render.
    window.setTimeout(start, 3000);
  }
}

addReplayWhenIdle();

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
