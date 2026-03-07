import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher([
  '/auth(.*)',
  '/auth/login(.*)',
  '/auth/register(.*)',
  '/onboarding(.*)',
  '/',
  '/preview(.*)',
  '/clear-session(.*)',
]);

const requiresOnboarding = createRouteMatcher([
  '/dashboard(.*)',
  '/settings(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();

  if (!isPublicRoute(req) && !userId) {
    console.log('[AUTH] No userId, redirecting to /auth from:', req.nextUrl.pathname);
    const authUrl = new URL('/auth?mode=signin', req.url);
    return NextResponse.redirect(authUrl);
  }

  if (requiresOnboarding(req) && userId) {
    const { user } = await auth();
    const userMetadata = user?.unsafeMetadata as { onboardingCompleted?: boolean } | undefined;
    const onboardingCompleted = userMetadata?.onboardingCompleted || false;

    console.log('[ONBOARDING] User:', userId, 'Completed:', onboardingCompleted, 'Path:', req.nextUrl.pathname);

    if (!onboardingCompleted && req.nextUrl.pathname !== '/onboarding') {
      console.log('[ONBOARDING] Redirecting to /onboarding');
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
