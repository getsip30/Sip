import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{ background: '#0A0E16', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, color: '#EDEFF3', fontFamily: 'Space Grotesk, sans-serif' }}>
      <div style={{ fontFamily: 'Space Mono', fontSize: 28, fontWeight: 700, color: '#70B5F9' }}>sip</div>
      <h1 style={{ fontSize: 48, fontWeight: 700, letterSpacing: -2, margin: 0 }}>404</h1>
      <p style={{ color: '#8A93A3', fontSize: 16 }}>This page doesn't exist. Maybe the mentor moved on.</p>
      <Link href="/" style={{ marginTop: 8, background: '#3B82F6', color: 'white', padding: '12px 28px', borderRadius: 20, fontSize: 15, fontWeight: 600, textDecoration: 'none' }}>back to directory →</Link>
    </div>
  );
}