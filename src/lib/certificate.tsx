import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { BADGE_META, type BadgeType } from '@/lib/badge-meta';

/**
 * The shareable badge certificate, rendered as a PNG by Satori.
 *
 * Shared by the image route and the certificate page's Open Graph image so a
 * download and a LinkedIn preview are byte-for-byte the same picture. Only
 * flexbox and a subset of CSS survive Satori — no grid, no shorthand
 * `background` with multiple layers — which is why this is written out as nested
 * flex rows rather than styled like the rest of the app.
 */

export const CERTIFICATE_SIZE = { width: 1200, height: 630 };

const TEAL = '#52bdc2';
const TEAL_SOFT = '#81b3c8';
const INK = '#0A0E16';
const PAPER = '#EDEFF3';
const MUTED = '#8A93A3';

/**
 * The logo is read off disk and inlined rather than linked. Satori fetches
 * remote images at render time, which would make every certificate depend on a
 * network round trip to our own CDN — and fail outright in local development,
 * where the absolute URL points at production.
 */
let logoDataUri: string | null = null;
async function getLogo(): Promise<string | null> {
  if (logoDataUri) return logoDataUri;
  try {
    const bytes = await readFile(join(process.cwd(), 'public', 'logo.png'));
    logoDataUri = `data:image/png;base64,${bytes.toString('base64')}`;
    return logoDataUri;
  } catch {
    // A missing asset must not turn a certificate into a 500. The layout below
    // simply drops the mark.
    return null;
  }
}

export type CertificateInput = {
  badgeType: BadgeType;
  mentorName: string;
  /** Shown under the name, e.g. "Design Lead @ Figma". Optional. */
  mentorTitle?: string | null;
  awardedAt: Date;
};

export async function renderCertificate(
  { badgeType, mentorName, mentorTitle, awardedAt }: CertificateInput,
  init: ConstructorParameters<typeof ImageResponse>[1] = {}
) {
  const meta = BADGE_META[badgeType];
  const logo = await getLogo();
  const date = awardedAt.toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
  });

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: INK,
          fontFamily: 'sans-serif',
          padding: 28,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            border: `2px solid ${meta.color}`,
            borderRadius: 24,
            padding: '34px 52px',
            backgroundImage: `linear-gradient(135deg, rgba(82,189,194,0.14) 0%, rgba(10,14,22,0) 55%, rgba(129,179,200,0.12) 100%)`,
          }}
        >
          {/*
            The three bands are laid out as fixed-height ends around a growing
            middle. Satori will not shrink an overflowing child, so the masthead
            and footer are pinned with flexShrink: 0 and the type below is sized
            to leave the middle band slack at the longest badge name — the
            failure mode otherwise is the footer riding up over the mentor's name
            rather than anything visibly clipping.
          */}

          {/* Masthead. The logo art already contains the wordmark, so there is
              no separate "sip" text next to it. */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            {/* Satori renders raw <img> only — next/image has no meaning here. */}
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} width={58} height={58} alt="" style={{ objectFit: 'contain' }} />
            ) : (
              <div style={{ display: 'flex', fontSize: 36, fontWeight: 700, color: TEAL, letterSpacing: -1 }}>sip</div>
            )}
            <div style={{ display: 'flex', fontSize: 14, color: MUTED, letterSpacing: 3, textTransform: 'uppercase' }}>
              Certificate of Achievement
            </div>
          </div>

          {/* Award */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', paddingTop: 8 }}>
            <div
              style={{
                display: 'flex',
                alignSelf: 'flex-start',
                alignItems: 'center',
                background: 'rgba(82,189,194,0.12)',
                border: `1px solid ${meta.color}`,
                borderRadius: 999,
                padding: '6px 20px',
                marginBottom: 18,
              }}
            >
              <div style={{ display: 'flex', width: 9, height: 9, borderRadius: 999, background: meta.color, marginRight: 9 }} />
              <div style={{ display: 'flex', fontSize: 17, color: TEAL_SOFT, letterSpacing: 1 }}>{meta.criteria}</div>
            </div>

            <div style={{ display: 'flex', fontSize: 60, fontWeight: 700, color: PAPER, letterSpacing: -2, lineHeight: 1.05 }}>
              {meta.label}
            </div>
            <div style={{ display: 'flex', fontSize: 21, color: MUTED, marginTop: 10 }}>{meta.blurb}</div>

            <div style={{ display: 'flex', width: 88, height: 3, background: meta.color, borderRadius: 999, margin: '24px 0 20px' }} />

            <div style={{ display: 'flex', fontSize: 15, color: MUTED, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>
              Awarded to
            </div>
            <div style={{ display: 'flex', fontSize: 40, fontWeight: 700, color: PAPER, letterSpacing: -1, lineHeight: 1.15 }}>
              {mentorName}
            </div>
            {mentorTitle && (
              <div style={{ display: 'flex', fontSize: 20, color: TEAL_SOFT, marginTop: 6 }}>{mentorTitle}</div>
            )}
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexShrink: 0, paddingTop: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', fontSize: 13, color: MUTED, letterSpacing: 2, textTransform: 'uppercase' }}>Awarded</div>
              <div style={{ display: 'flex', fontSize: 21, color: PAPER, marginTop: 5 }}>{date}</div>
            </div>
            <div style={{ display: 'flex', fontSize: 21, color: TEAL }}>getsip.co</div>
          </div>
        </div>
      </div>
    ),
    { ...CERTIFICATE_SIZE, ...init }
  );
}
