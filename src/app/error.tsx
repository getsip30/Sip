'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import * as Sentry from '@sentry/nextjs';
import { BG, SURFACE, BORDER, TEXT, MUTED, ACCENT } from '@/lib/theme';

/**
 * Route-level boundary. Without this, any render error unmounted the whole app
 * through global-error; now a failure is contained to the segment that threw and
 * the rest of the shell keeps working.
 */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error, { tags: { boundary: 'route' } });
  }, [error]);

  return (
    <div style={{ background: BG, minHeight: '100vh', color: TEXT, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 460, width: '100%', background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 10, letterSpacing: '-0.02em' }}>
          This part of Sip failed to load
        </h1>
        <p style={{ color: MUTED, fontSize: 14.5, lineHeight: 1.65, marginBottom: 22 }}>
          The rest of the app is still working. Try again, and if it keeps happening let us know
          through the feedback button.
        </p>
        {error.digest && (
          <p style={{ color: MUTED, fontSize: 12, fontFamily: "var(--font-space-mono), 'Space Mono', monospace", marginBottom: 22 }}>
            Reference: {error.digest}
          </p>
        )}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={reset}
            style={{ background: ACCENT, color: '#fff', border: 'none', padding: '11px 22px', borderRadius: 999, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Try again
          </button>
          <Link
            href="/"
            style={{ display: 'inline-flex', alignItems: 'center', padding: '11px 22px', border: `1px solid ${BORDER}`, borderRadius: 999, fontSize: 14, fontWeight: 600, color: TEXT, textDecoration: 'none' }}
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
