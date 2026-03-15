import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = [
  '/auth',
  '/reset-password',
  '/onboarding',
  '/sso-callback',
  '/clear-session',
  '/preview',
  '/api/auth',
  '/',
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + '/') || pathname.startsWith(p + '?')
  );
}

// Better Auth uses __Secure- prefix on HTTPS (production).
// Check both names so the middleware works locally and in prod.
function hasSession(req: NextRequest): boolean {
  return !!(
    req.cookies.get('__Secure-better-auth.session_token')?.value ||
    req.cookies.get('better-auth.session_token')?.value
  );
}

export async function middleware(req: NextRequest) {
  if (isPublic(req.nextUrl.pathname)) {
    return NextResponse.next();
  }

  if (!hasSession(req)) {
    return NextResponse.redirect(new URL('/auth?mode=signin', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
