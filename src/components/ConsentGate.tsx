'use client';
import { BG, SURFACE, TEXT, MUTED, ACCENT } from '@/lib/theme';

export function ConsentGate({ onAccept, onDecline }: { onAccept: () => void; onDecline: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
      <div style={{ background: SURFACE, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 32, width: '100%', maxWidth: 460, fontFamily: "'Space Grotesk', sans-serif" }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: TEXT }}>Before you join a call</h3>
        <ul style={{ fontSize: 14, color: MUTED, lineHeight: 1.8, marginBottom: 22, paddingLeft: 18 }}>
          <li>No recording, screenshotting, or sharing this call without consent</li>
          <li>Be respectful. Harassment or inappropriate behavior gets you removed</li>
          <li>Sessions may be reported and reviewed if flagged</li>
          <li>Use the flag button if anything feels off</li>
          <li>Repeated violations result in a permanent ban</li>
        </ul>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onDecline} style={{ flex: 1, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: MUTED, padding: '12px', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>decline</button>
          <button onClick={onAccept} style={{ flex: 1, background: ACCENT, color: 'white', border: 'none', padding: '12px', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>agree & continue</button>
        </div>
      </div>
    </div>
  );
}