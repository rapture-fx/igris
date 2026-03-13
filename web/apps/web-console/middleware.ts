import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextMiddleware, NextResponse } from 'next/server';

// DEV MODE: bypasses Clerk entirely. Set NEXT_PUBLIC_DEV_MODE=true in .env.local.
const DEV_MODE = process.env.NEXT_PUBLIC_DEV_MODE === 'true';

const isPublicRoute = createRouteMatcher([
  '/auth(.*)',
  '/auth/login(.*)',
  '/auth/register(.*)',
  '/sso-callback(.*)',
  '/onboarding(.*)',
  '/',
  '/preview(.*)',
  '/clear-session(.*)',
]);

const devMiddleware: NextMiddleware = () => NextResponse.next();

const prodMiddleware = clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();

  if (!isPublicRoute(req) && !userId) {
    console.log('[AUTH] No userId, redirecting to /auth from:', req.nextUrl.pathname);
    const authUrl = new URL('/auth?mode=signin', req.url);
    return NextResponse.redirect(authUrl);
  }

  return NextResponse.next();
});

export default DEV_MODE ? devMiddleware : prodMiddleware;

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
