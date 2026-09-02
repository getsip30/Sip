'use client';

import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';

const DISCORD_URL = 'https://discord.gg/RXCkB8JXDq';
const MESSAGE = '🎉 Join the Sip Discord — hang out, ask a mentor anything, or just vibe →';
const DISMISS_KEY = 'sip:discord-marquee-dismissed';

/**
 * A live call fills the whole viewport with no chrome of its own (see
 * RoomLayout) — a promo strip pinned above it would sit on top of the video
 * UI instead of pushing anything down, since there is nothing there to push.
 */
function isExcludedRoute(pathname: string | null) {
  return !!pathname && pathname.startsWith('/rooms/');
}

/**
 * Visibility is driven entirely by the `announcement-dismissed` class on
 * <html> (see globals.css), not by React state. The inline script in
 * RootLayout sets that class synchronously, before hydration, from the same
 * sessionStorage key this writes — so a visitor who already dismissed this
 * never sees it flash in first. Dismissing here just mirrors that: write the
 * key, flip the class, no re-render needed.
 */
export default function DiscordMarquee() {
  const pathname = usePathname();
  if (isExcludedRoute(pathname)) return null;

  const handleDismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Storage can be unavailable (private mode, quota); the class toggle
      // below still hides the strip for the rest of this visit either way.
    }
    document.documentElement.classList.add('announcement-dismissed');
  };

  // Repeated back-to-back with a separator so two adjacent copies of the
  // track (see the CSS) read as one continuous, evenly-spaced line with no
  // visible seam at the loop point.
  const repeated = Array.from({ length: 4 }, () => MESSAGE).join('    •    ');

  return (
    <div className="discord-marquee" role="region" aria-label="Announcement">
      <a
        href={DISCORD_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="sr-only"
      >
        Join the Sip Discord — hang out, ask a mentor anything, or just vibe (opens in a new tab)
      </a>

      <div className="discord-marquee__track" aria-hidden="true">
        <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" className="discord-marquee__copy">
          {repeated}
        </a>
        <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" className="discord-marquee__copy">
          {repeated}
        </a>
      </div>

      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss announcement"
        className="discord-marquee__close"
      >
        <X size={14} strokeWidth={2.5} />
      </button>
    </div>
  );
}
