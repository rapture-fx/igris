import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  '/auth(.*)',
  '/auth/login(.*)',
  '/auth/register(.*)',
  '/onboarding(.*)',
  '/',
]);

// Routes that require authentication and onboarding completion
const requiresOnboarding = createRouteMatcher([
  '/dashboard(.*)',
  '/settings(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();

  // If trying to access protected route without authentication, redirect to /auth
  if (!isPublicRoute(req) && !userId) {
    const authUrl = new URL('/auth', req.url);
    return NextResponse.redirect(authUrl);
  }

  // If accessing dashboard or settings routes, check onboarding status
  if (requiresOnboarding(req) && userId) {
    // Get user metadata to check onboarding status
    const { user } = await auth();
    const userMetadata = user?.unsafeMetadata as { onboardingCompleted?: boolean } | undefined;
    const onboardingCompleted = userMetadata?.onboardingCompleted || false;

    // If onboarding not completed, redirect to onboarding page
    // Skip this check if there's a query parameter to bypass (e.g., after completing onboarding)
    if (!onboardingCompleted && !req.nextUrl.searchParams.has('onboarding')) {
      const onboardingUrl = new URL('/onboarding', req.url);
      return NextResponse.redirect(onboardingUrl);
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
