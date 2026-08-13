'use client';
import Image from 'next/image';
import Link from 'next/link';
import { ACCENT } from '@/lib/theme';

/**
 * @param label  Accessible name for the link. The logo is a link, not a
 *   decorative image, so what a screen reader announces should describe where
 *   it goes. Every instance previously announced the single word "Sip", which
 *   on a page that also has "Sip" as its h1 gives a keyboard user no way to
 *   tell the nav link from the heading. Callers that render the logo somewhere
 *   other than the primary nav should say so.
 */
export default function Logo({
  style,
  children,
  size = 68,
  label = 'Sip home',
}: {
  style?: React.CSSProperties;
  children?: React.ReactNode;
  size?: number;
  label?: string;
}) {
  return (
    // Standard logo-as-home link. This used to intercept the click and route
    // signed-in users to their own dashboard, which made the logo look dead:
    // it renders in the nav of those same dashboards, so the click pushed the
    // route the user was already on. Preventing the default also cost
    // cmd/middle-click to open in a new tab, and put two API calls in front of
    // every navigation.
    <Link href="/" aria-label={label}
      style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: "var(--font-space-mono), 'Space Mono', monospace", fontSize: 28, fontWeight: 700, color: ACCENT, letterSpacing: -1, textDecoration: 'none', cursor: 'pointer', ...style }}>
      {/*
        Was a raw <img> pointing at the 500x500, 84KB source PNG, rendered at
        44-68px on every page of the site. Lighthouse costed that at 82KB of
        pure waste per page load. next/image serves an AVIF/WebP variant scaled
        to the box it is drawn in, and the explicit width/height reserve the
        space so nothing shifts when it arrives.

        alt is empty because the anchor already carries an accessible name via
        aria-label; describing the image too would make a screen reader
        announce the same link twice.
      */}
      <Image
        src="/logo.png"
        alt=""
        width={size}
        height={size}
        sizes={`${size}px`}
        style={{ width: size, height: size, objectFit: 'contain' }}
      />
      {children}
    </Link>
  );
}