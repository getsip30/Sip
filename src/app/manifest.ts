import type { MetadataRoute } from 'next';
import { SITE_NAME, SITE_DESCRIPTION } from '@/lib/site';

/**
 * Web app manifest. Not a ranking factor on its own, but it is what makes an
 * "add to home screen" install carry the right name and colours instead of a
 * screenshot titled with the URL, and Lighthouse's installability checks read
 * it. Generated rather than a static file so the name and description stay tied
 * to the same constants the metadata uses.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Sip: real conversations with people who already did it',
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#0a0e16',
    theme_color: '#0a0e16',
    orientation: 'portrait',
    categories: ['education', 'productivity', 'social'],
    icons: [
      {
        src: '/logo.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/logo.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
