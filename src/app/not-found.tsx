import type { Metadata } from 'next';
import Link from 'next/link';
import { BG, SURFACE, TEXT, MUTED, ACCENT, LINK, BORDER } from '@/lib/theme';
import { noIndex } from '@/lib/site';

export const metadata: Metadata = noIndex(
  'Page not found',
  'That page does not exist on Sip. Browse mentors, read answers, or head back home.',
);

/**
 * The 404 page.
 *
 * Two problems with the version this replaces. It offered exactly one way out —
 * a single link home — which wastes the visit and, more to the point, wastes
 * the link equity of every inbound link pointing at a URL that has since moved
 * or was typed wrong. A 404 is a normal and frequent destination for crawlers
 * and for people following stale links, and it should route them somewhere
 * useful rather than making them start over.
 *
 * It also carried no metadata, so it inherited the root layout's title and
 * `index: true`. Next serves a correct 404 status here, so this was never going
 * to be indexed in practice, but declaring noindex costs nothing and removes
 * the ambiguity if the component is ever rendered at a 200 by mistake — which
 * is precisely how soft 404s happen.
 */
export default function NotFound() {
  const links: { href: string; label: string; blurb: string }[] = [
    { href: '/seekers', label: 'Find a mentor', blurb: 'Browse everyone taking conversations right now.' },
    { href: '/answers', label: 'Read answers', blurb: 'Real questions, answered by people doing the job.' },
    { href: '/mentors/signup', label: 'Become a mentor', blurb: 'List yourself and set your own terms.' },
    { href: '/about', label: 'About Sip', blurb: 'What this is and who it is for.' },
  ];

  return (
    <div style={{ background: BG, minHeight: '100vh', color: TEXT, fontFamily: "var(--font-space-grotesk), 'Space Grotesk', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 20px' }}>
      <main id="main-content" style={{ maxWidth: 620, width: '100%', textAlign: 'center' }}>
        <div style={{ fontFamily: "var(--font-space-mono), 'Space Mono', monospace", fontSize: 13, letterSpacing: '0.14em', textTransform: 'uppercase', color: MUTED, marginBottom: 20 }}>
          Error 404
        </div>
        <h1 style={{ fontSize: 'clamp(38px, 8vw, 56px)', fontWeight: 700, letterSpacing: -2, margin: '0 0 16px', lineHeight: 1.05 }}>
          This page doesn&apos;t exist.
        </h1>
        <p style={{ color: MUTED, fontSize: 16, lineHeight: 1.7, margin: '0 0 40px' }}>
          The link may be out of date, or the mentor may have moved on. Here is everything else.
        </p>

        <nav aria-label="Where to go instead" style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', textAlign: 'left', marginBottom: 36 }}>
          {links.map(l => (
            <Link
              key={l.href}
              href={l.href}
              style={{ display: 'block', background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '16px 18px', textDecoration: 'none', color: 'inherit' }}
            >
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, color: LINK }}>{l.label}</div>
              <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.55 }}>{l.blurb}</div>
            </Link>
          ))}
        </nav>

        <Link href="/" style={{ display: 'inline-block', background: ACCENT, color: 'white', padding: '13px 30px', borderRadius: 999, fontSize: 15, fontWeight: 600, textDecoration: 'none' }}>
          Back home
        </Link>
      </main>
    </div>
  );
}
