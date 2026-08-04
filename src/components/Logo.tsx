'use client';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { ACCENT } from '@/lib/theme';

async function hasRole(endpoint: string) {
  try {
    const res = await fetch(endpoint);
    if (!res.ok) return false;
    const data = await res.json();
    return !!data;
  } catch {
    return false;
  }
}

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
  const { user, isLoaded } = useUser();
  const router = useRouter();

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    if (!isLoaded || !user) { router.push('/'); return; }

    const [mentorFlag, seekerFlag] = await Promise.all([
      hasRole('/api/mentor'),
      hasRole('/api/seeker'),
    ]);

    const lastRole = typeof window !== 'undefined' ? localStorage.getItem('sip_last_role') : null;
    if (lastRole === 'seeker' && seekerFlag) { router.push('/seekers'); return; }
    if (lastRole === 'mentor' && mentorFlag) { router.push('/dashboard'); return; }
    if (mentorFlag) { router.push('/dashboard'); return; }
    if (seekerFlag) { router.push('/seekers'); return; }
    router.push('/');
  }

  return (
    <a href="/" onClick={handleClick} aria-label={label}
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
    </a>
  );
}