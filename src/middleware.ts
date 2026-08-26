import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// /unbooked is reached from a link in the mentor's email, and both its buttons
// are mentor-only writes. Protecting it sends a signed-out mentor to sign-in
// rather than to a page whose buttons would answer 401.
const isProtectedRoute = createRouteMatcher(['/dashboard(.*)', '/admin(.*)', '/unbooked(.*)']);

export default clerkMiddleware(async (auth, req) => {
  // Without an explicit destination, protect() answers a signed-out visitor with
  // a 404, so /dashboard read as "no such page" rather than "sign in first".
  if (isProtectedRoute(req)) {
    await auth.protect({ unauthenticatedUrl: new URL('/sign-in', req.url).toString() });
  }
});

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
};