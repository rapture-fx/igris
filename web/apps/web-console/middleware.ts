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

// Routes that should redirect to onboarding if user hasn't completed it
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

  // Don't enforce onboarding checks - let the app handle it client-side
  // This avoids issues with session claim sync delays

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
