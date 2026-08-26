import type { Metadata } from 'next';
import UnbookedClient from './UnbookedClient';
import { BG } from '@/lib/theme';

export const metadata: Metadata = {
  title: 'Sip with no time set',
  robots: { index: false, follow: false },
};

/**
 * Landing page for the two buttons in the mentor's no-time-set email.
 *
 * The request is not looked up here. Both actions re-check ownership on the
 * server anyway, and resolving the id server-side would tell anyone who tried
 * one whether it exists — the same call the confirm page makes with its token.
 *
 * `report=1` in the query only decides which action is pre-selected. Neither
 * button fires on arrival: a mail scanner following the link must land on a
 * page, not perform an action.
 */
export default async function UnbookedPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ report?: string }>;
}) {
  const { id } = await params;
  const { report } = await searchParams;

  return (
    <main style={{ background: BG, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <UnbookedClient requestId={id} startOnReport={report === '1'} />
    </main>
  );
}
