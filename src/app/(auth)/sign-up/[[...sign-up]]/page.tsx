import type { Metadata } from 'next';
import { SignUp } from '@clerk/nextjs';
import { clerkAppearance } from '@/lib/clerk-appearance';
import { noIndex } from '@/lib/site';

/** See the note in the sign-in page for why this is not indexed. */
export const metadata: Metadata = noIndex('Sign up');

export default function SignUpPage() {
  return (
    <div style={{ background: '#0A0E16', minHeight: '100vh', display: 'flex', flexDirection: 'row', flexWrap: 'wrap', color: '#EDEFF3', fontFamily: "var(--font-space-grotesk), 'Space Grotesk', sans-serif" }}>

      {/* LEFT PANEL */}
      <div style={{ flex: 1, minWidth: 340, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '48px 24px', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontFamily: "var(--font-space-mono), 'Space Mono', monospace", fontSize: 26, fontWeight: 700, color: '#70B5F9', marginBottom: 48 }}>sip</div>
        <h1 style={{ fontSize: 40, fontWeight: 700, letterSpacing: -2, lineHeight: 1.1, marginBottom: 16 }}>
          Open your door.<br />
          <span style={{ color: '#70B5F9' }}>Change someone&apos;s path.</span>
        </h1>
        <p style={{ color: '#8A93A3', fontSize: 16, lineHeight: 1.7, maxWidth: 380, marginBottom: 48 }}>
          Join Sip as a mentor. List yourself, stay in control, and show up when you want to. No cold messages, ever.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {[
            'Toggle open/closed anytime',
            'Requests come straight to your email',
            'You decide who gets a sip',
          ].map(text => (
            <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#70B5F9', display: 'inline-block', flexShrink: 0 }} />
              <span style={{ color: '#EDEFF3', fontSize: 15 }}>{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div style={{ flex: 1, minWidth: 340, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <SignUp forceRedirectUrl="/choose-role" appearance={{
          ...clerkAppearance,
          elements: {
            ...clerkAppearance.elements,
            card: { ...clerkAppearance.elements.card, width: '100%', maxWidth: 420 },
          },
        }} />
      </div>
    </div>
  );
}