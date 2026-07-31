import { ClerkProvider } from '@clerk/nextjs';
import type { Metadata } from 'next';
import { FeedbackWidget } from '@/components/feedback-widget';
import { ThemeProvider } from '@/components/theme-provider';
import { ClerkThemeBridge } from '@/components/clerk-theme-bridge';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://getsip.co'),
  title: {
    default: 'Sip — Find Your People',
    template: '%s | Sip',
  },
  description: 'Real conversations, zero cold messages. Sip connects you with mentors for live, no-pressure conversations — no scheduling, no cold outreach.',
  keywords: [
    'mentorship platform',
    'live mentorship',
    'find a mentor',
    'youth mentorship',
    'career conversations',
  ],
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
  openGraph: {
    title: 'Sip — Find Your People',
    description: 'Real conversations, zero cold messages.',
    url: 'https://getsip.co',
    siteName: 'Sip',
    images: [
      {
        url: '/logo.png',
        width: 512,
        height: 512,
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sip — Find Your People',
    description: 'Real conversations, zero cold messages.',
    images: ['/logo.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} value={{ light: "light", dark: "" }}>
          <ClerkThemeBridge>
            {children}
          </ClerkThemeBridge>
          <FeedbackWidget />
        </ThemeProvider>
      </body>
    </html>
  );
}