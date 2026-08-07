import type { Metadata } from 'next';
import { Space_Grotesk, Space_Mono } from 'next/font/google';
import { FeedbackWidget } from '@/components/feedback-widget';
import { Analytics } from '@vercel/analytics/next';

import { ClerkThemeBridge } from '@/components/clerk-theme-bridge';
import { jsonLdScript } from '@/lib/utils';
import {
  SITE_URL,
  SITE_NAME,
  SITE_DESCRIPTION,
  canonical,
  graph,
  organizationJsonLd,
  webSiteJsonLd,
} from '@/lib/site';
import './globals.css';

/**
 * Fonts were two stylesheet links to fonts.googleapis.com, which blocks the
 * first render on a third-party connection: Lighthouse measured 251ms of the
 * critical path spent there before any text could paint. next/font downloads
 * the files at build time and serves them from our own origin with the
 * @font-face inlined, so there is no extra connection, no render-blocking
 * request, and no window where text is invisible.
 *
 * The weights are pinned to the ones actually used rather than the full range
 * the old URL requested: the previous link pulled five weights of Space Grotesk
 * when the app only ever sets 400, 500, 600 and 700.
 */
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-space-grotesk',
  fallback: ['system-ui', 'sans-serif'],
  adjustFontFallback: true,
});

const spaceMono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
  variable: '--font-space-mono',
  fallback: ['ui-monospace', 'monospace'],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Sip: real conversations with people who already did it',
    template: '%s | Sip',
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  // Every page sets its own; this is the fallback so no route can ship without
  // one. Relative values resolve against metadataBase, so the origin is decided
  // in exactly one place.
  alternates: canonical('/'),
  keywords: [
    'mentorship platform',
    'live mentorship',
    'find a mentor',
    'career mentorship for students',
    'talk to a professional',
    'informational interview',
    'student career advice',
  ],
  category: 'education',
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
  manifest: '/manifest.webmanifest',
  openGraph: {
    title: 'Sip: real conversations with people who already did it',
    description: 'Students and mentors, matched for short live conversations. No cold outreach.',
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: 'en_US',
    type: 'website',
    // No `images` here on purpose. Setting it pinned every page's card to the
    // 512x512 square logo and shadowed opengraph-image.tsx, so a card declared
    // as summary_large_image was being handed an image that is not large and
    // not the right shape. Leaving it unset lets the file convention supply the
    // 1200x630 image, and lets a route override it with something specific.
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sip: real conversations with people who already did it',
    description: 'Students and mentors, matched for short live conversations. No cold outreach.',
    // Same reasoning as openGraph.images above: the file convention fills this.
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  formatDetection: { telephone: false, address: false, email: false },
};

/**
 * `maximumScale: 1` was set here, which Chrome reports as user-scalable=no.
 * It stops a low-vision visitor pinch-zooming on a phone: a WCAG 1.4.4 failure
 * and the one audit scoring a flat zero in Lighthouse's accessibility category.
 * It buys nothing in return — the iOS focus-zoom it is usually cargo-culted to
 * prevent is already handled properly in globals.css, which sets a 16px font
 * size on inputs under 640px.
 */
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0a0e16',
  colorScheme: 'dark' as const,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Organization and WebSite describe the site itself, not any one page, so
  // they belong in the root layout where they render server-side into every
  // document. Both carry a stable @id, letting per-page graphs point at them
  // with a reference instead of restating them and risking two versions of the
  // same entity.
  const siteJsonLd = graph(organizationJsonLd(), webSiteJsonLd());

  return (
    <html
      lang="en"
      dir="ltr"
      suppressHydrationWarning
      className={`${spaceGrotesk.variable} ${spaceMono.variable}`}
    >
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(siteJsonLd) }} />
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <ClerkThemeBridge>
          {children}
        </ClerkThemeBridge>
        <FeedbackWidget />
        <Analytics />
      </body>
    </html>
  );
}
