import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div style={{ background: '#0A0E16', minHeight: '100vh', display: 'flex', flexDirection: 'row', flexWrap: 'wrap', color: '#EDEFF3', fontFamily: 'Space Grotesk, sans-serif' }}>

      {/* LEFT PANEL */}
      <div style={{ flex: 1, minWidth: 340, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '48px 24px', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontFamily: 'Space Mono', fontSize: 26, fontWeight: 700, color: '#70B5F9', marginBottom: 48 }}>sip</div>
        <h1 style={{ fontSize: 40, fontWeight: 700, letterSpacing: -2, lineHeight: 1.1, marginBottom: 16 }}>
          Welcome back.<br />
          <span style={{ background: 'linear-gradient(135deg, #70B5F9, #3B82F6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>People are waiting.</span>
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
          variables: {
            colorBackground: '#121923',
            colorForeground: '#EDEFF3',
            colorPrimary: '#3B82F6',
            colorInput: '#EDEFF3',
            borderRadius: '12px',
          },
          elements: {
            card: { border: '1px solid rgba(255,255,255,0.08)', boxShadow: 'none', width: '100%', maxWidth: 420 },
            headerTitle: { color: '#EDEFF3' },
            headerSubtitle: { color: '#8A93A3' },
            formFieldLabel: { color: '#8A93A3' },
            formFieldInput: { color: '#0A0E16' },
            formFieldHintText: { color: '#8A93A3', lineHeight: 1.5, marginTop: 6 },
            formFieldSuccessText: { color: '#5BDB8A', lineHeight: 1.5, marginTop: 4 },
            formFieldWarningText: { lineHeight: 1.5, marginTop: 4 },
            footerActionLink: { color: '#70B5F9' },
          }
        }} />
      </div>
    </div>
  );
}