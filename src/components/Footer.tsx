'use client';
import Link from 'next/link';
import Logo from '@/components/Logo';
import { MUTED, LINK } from '@/lib/theme';

const NAV_LINKS: [string, string][] = [
  ['/about', 'About'],
  ['/#how-it-works', 'How Sip works'],
  ['/leaderboard', 'Leaderboard'],
  ['/answers', 'Answers'],
];

const LEGAL_LINKS: [string, string][] = [
  ['/conduct', 'Conduct'],
  ['/privacy', 'Privacy'],
  ['/terms', 'Terms'],
];

const CONTACT_EMAIL = 'hello@getsip.co';

const heading: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: MUTED,
  marginBottom: 14,
};

const linkStyle: React.CSSProperties = {
  fontSize: 14,
  color: MUTED,
  textDecoration: 'none',
  display: 'block',
  padding: '4px 0',
};

/**
 * Site footer.
 *
 * Each link appears once. Conduct, privacy and terms sit in the bottom row
 * rather than being repeated in a column above it, which is where they are
 * looked for and keeps the columns to things people navigate to on purpose.
 *
 * There is no social column because there are no accounts to link. The Twitter
 * reference in the app is Open Graph metadata, not a handle, and inventing a
 * profile that does not exist would be worse than leaving it out.
 */
export default function Footer() {
  return (
    <footer style={{ borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 'auto' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '52px 24px 28px' }}>
        <div className="footer-grid">
          <div style={{ maxWidth: 320 }}>
            <Logo size={44} />
            <p style={{ color: MUTED, fontSize: 14, lineHeight: 1.65, marginTop: 12 }}>
              Short, live conversations with people who have already done the thing you are trying to do.
            </p>
          </div>

          <nav aria-label="Footer">
            <div style={heading}>Explore</div>
            {NAV_LINKS.map(([href, label]) => (
              <Link key={href} href={href} className="text-link" style={linkStyle}>{label}</Link>
            ))}
          </nav>

          <div>
            <div style={heading}>Get in touch</div>
            <a href={`mailto:${CONTACT_EMAIL}`} style={{ ...linkStyle, color: LINK }}>{CONTACT_EMAIL}</a>
            <Link href="/mentors/signup" className="text-link" style={linkStyle}>Become a mentor</Link>
            <Link href="/seekers" className="text-link" style={linkStyle}>Find a mentor</Link>
          </div>
        </div>

        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.06)',
          marginTop: 36,
          paddingTop: 20,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 16,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: MUTED }}>
            Sip {new Date().getFullYear()}
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 22 }}>
            {LEGAL_LINKS.map(([href, label]) => (
              <Link key={href} href={href} className="text-link" style={{ fontSize: 13, color: MUTED, textDecoration: 'none' }}>
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
