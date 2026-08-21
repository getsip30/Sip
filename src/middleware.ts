import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { touchLastActive } from '@/lib/activity';

const isProtectedRoute = createRouteMatcher(['/dashboard(.*)', '/admin(.*)']);

export default clerkMiddleware(async (auth, req, event) => {
  // Without an explicit destination, protect() answers a signed-out visitor with
  // a 404, so /dashboard read as "no such page" rather than "sign in first".
  if (isProtectedRoute(req)) {
    await auth.protect({ unauthenticatedUrl: new URL('/sign-in', req.url).toString() });
  }

  // Activity tracking for the admin dashboard's weekly-active count.
  //
  // waitUntil, not await: the response must not wait on this, and a slow or
  // failing database must not slow down every page on the site. touchLastActive
  // throttles itself to one write per person per 15 minutes and swallows its
  // own errors, so there is nothing here for the request to care about.
  const { userId } = await auth();
  if (userId) event.waitUntil(touchLastActive(userId));
});

export const config = {
  matcher: ['/((?!.*\..*|_next).*)', '/', '/(api|trpc)(.*)'],
};
