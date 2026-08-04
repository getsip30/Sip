'use client';
import { SURFACE, TEXT, MUTED, ACCENT } from '@/lib/theme';

export function MessageConsentGate({ onAccept, onCancel }: { onAccept: () => void; onCancel: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
      <div role="dialog" aria-modal="true" aria-labelledby="msgConsentTitle" style={{ background: SURFACE, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 420, fontFamily: "var(--font-space-grotesk), 'Space Grotesk', sans-serif" }}>
        <h3 id="msgConsentTitle" style={{ fontSize: 17, fontWeight: 700, marginBottom: 14, color: TEXT }}>Quick reminder</h3>
        <ul style={{ fontSize: 13, color: MUTED, lineHeight: 1.7, marginBottom: 20, paddingLeft: 18 }}>
          <li>Be respectful and clear in what you're asking for</li>
          <li>No spam, no repeated requests to the same mentor</li>
          <li>Sharing false info or impersonating someone can get you banned</li>
        </ul>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: MUTED, padding: '11px', borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>cancel</button>
          <button onClick={onAccept} style={{ flex: 1, background: ACCENT, color: 'white', border: 'none', padding: '11px', borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>agree & send</button>
        </div>
      </div>
    </div>
  );
}