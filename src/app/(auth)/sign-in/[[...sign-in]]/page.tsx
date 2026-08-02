import { SignIn } from '@clerk/nextjs';
import { clerkAppearance } from '@/lib/clerk-appearance';

export default function SignInPage() {
  return (
    <div style={{ background: '#0A0E16', minHeight: '100vh', display: 'flex', flexDirection: 'row', flexWrap: 'wrap', color: '#EDEFF3', fontFamily: 'Space Grotesk, sans-serif' }}>

      {/* LEFT PANEL */}
      <div style={{ flex: 1, minWidth: 340, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '48px 24px', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontFamily: 'Space Mono', fontSize: 26, fontWeight: 700, color: '#70B5F9', marginBottom: 48 }}>sip</div>
        <h1 style={{ fontSize: 40, fontWeight: 700, letterSpacing: -2, lineHeight: 1.1, marginBottom: 16 }}>
          Welcome back.<br />
          <span style={{ color: '#70B5F9' }}>People are waiting.</span>
        </h1>
        <p style={{ color: '#8A93A3', fontSize: 16, lineHeight: 1.7, maxWidth: 380, marginBottom: 48 }}>
          Sign in to manage your requests, update your availability, and keep showing up.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {[
            'See who requested a sip with you',
            'Accept or decline in one click',
            'Earn XP and climb the leaderboard',
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
          <SignIn forceRedirectUrl="/" appearance={{
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