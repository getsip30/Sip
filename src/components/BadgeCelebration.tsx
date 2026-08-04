'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BADGE_META,
  badgeShareText,
  certificateImagePath,
  certificatePath,
  linkedInShareUrl,
  type BadgeType,
} from '@/lib/badge-meta';
import { BG, SURFACE, BORDER, TEXT, MUTED, SUCCESS2 } from '@/lib/theme';

/**
 * The "you earned a badge" moment, with the certificate that came with it.
 *
 * Shown once per badge: the dashboard marks it seen on close, so this cannot
 * become a thing that greets a mentor on every visit. The certificate is
 * rendered from the same route the public certificate page uses, so what they
 * see here is exactly what anyone following their LinkedIn post will see.
 */
export default function BadgeCelebration({
  mentorId,
  badgeType,
  open,
  onClose,
}: {
  mentorId: string;
  badgeType: BadgeType | null;
  open: boolean;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  if (!badgeType) return null;
  const meta = BADGE_META[badgeType];
  const shareText = badgeShareText(badgeType);
  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${certificatePath(mentorId, badgeType)}`
    : certificatePath(mentorId, badgeType);

  const button: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '11px 0',
    borderRadius: 20,
    fontSize: 13.5,
    fontWeight: 600,
    textDecoration: 'none',
    fontFamily: 'inherit',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={e => { if (e.target === e.currentTarget) onClose(); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(4px)', overflowY: 'auto' }}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 12 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 12 }}
            role="dialog" aria-modal="true" aria-label={`You earned the ${meta.label} badge`}
            style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 18, padding: 28, width: '100%', maxWidth: 520, color: TEXT }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: meta.color, display: 'inline-block' }} />
              <span style={{ color: MUTED, fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase' }}>New badge earned</span>
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.8, marginBottom: 4 }}>{meta.label}</div>
            <div style={{ color: MUTED, fontSize: 13.5, marginBottom: 18 }}>{meta.blurb} · {meta.criteria}</div>

            {/*
              Plain <img>: a generated PNG at a fixed size, served by our own
              route with its own cache headers, so there is nothing for
              next/image to optimise.
            */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={certificateImagePath(mentorId, badgeType)}
              alt={`${meta.label} certificate`}
              width={1200}
              height={630}
              style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 12, border: `1px solid ${BORDER}`, background: BG, marginBottom: 18 }}
            />

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
              <a
                href={certificateImagePath(mentorId, badgeType, true)}
                style={{ ...button, background: 'rgba(82,189,194,0.15)', border: '1px solid rgba(82,189,194,0.35)', color: '#52bdc2' }}
              >
                download
              </a>
              <a
                href={linkedInShareUrl(shareUrl, shareText)}
                target="_blank"
                rel="noopener noreferrer"
                // LinkedIn shows the link preview but does not reliably keep the
                // prefilled text, so the same text goes on the clipboard on the
                // way out. Same trick the sip-note share already uses.
                onClick={() => { navigator.clipboard?.writeText(shareText).catch(() => {}); }}
                style={{ ...button, background: '#0A66C2', color: 'white' }}
              >
                share on LinkedIn
              </a>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(`${shareText}\n${shareUrl}`).catch(() => {});
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                style={{ ...button, background: copied ? 'rgba(91,219,138,0.15)' : 'transparent', border: `1px solid ${copied ? 'rgba(91,219,138,0.3)' : BORDER}`, color: copied ? SUCCESS2 : MUTED }}
              >
                {copied ? 'copied' : 'copy text'}
              </button>
            </div>

            <button
              onClick={onClose}
              style={{ display: 'block', margin: '8px auto 0', background: 'none', border: 'none', color: MUTED, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              close
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
