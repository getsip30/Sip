import { MUTED } from '@/lib/theme';

/**
 * Layout and typographic primitives shared across the landing page's sections.
 *
 * No hooks and no browser APIs, deliberately: this file is imported by both
 * the client sections (Landing.tsx: Nav, Hero, MentorGrid, Proof, QuizPrompt,
 * FinalCta) and the server sections (Steps, Faq, Testimonials), and it has to
 * stay safe for both without needing 'use client' itself.
 */

export const MAX_PAGE_WIDTH = 1180;
export const GUTTER = 'clamp(20px, 5vw, 56px)';

export const mono: React.CSSProperties = {
  fontFamily: "var(--font-space-mono), 'Space Mono', monospace",
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
};

export function ArrowRight({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 12h15M13 5.5 19.5 12 13 18.5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Eyebrow({ children, color = MUTED }: { children: React.ReactNode; color?: string }) {
  return <div style={{ ...mono, fontSize: 11, color, marginBottom: 20 }}>{children}</div>;
}

export function Rule() {
  return <div style={{ height: 1, background: 'rgba(255,255,255,0.09)' }} />;
}
