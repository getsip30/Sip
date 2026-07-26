import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/admin',
        '/dashboard',
        '/onboarding',
        '/choose-role',
        '/(auth)/',
        '/rooms/',
        '/answers',
        '/seekers/',
      ],
    },
    sitemap: 'https://getsip.co/sitemap.xml',
  };
}