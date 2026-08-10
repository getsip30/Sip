import type { Metadata } from 'next';
import ConfirmClient from './ConfirmClient';
import { BG } from '@/lib/theme';

export const metadata: Metadata = {
  title: 'Confirm your sip',
  // A tokenised URL should never end up in an index.
  robots: { index: false, follow: false },
};

/**
 * Landing page for the confirm link in the T-1h reminder email.
 *
 * The token is passed straight to the client component without being looked up
 * here. Resolving it server-side would leak whether a token is valid to anyone
 * who tries one, and the POST has to re-check it regardless.
 */
export default async function ConfirmPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  return (
    <main style={{ background: BG, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <ConfirmClient token={token} />
    </main>
  );
}
