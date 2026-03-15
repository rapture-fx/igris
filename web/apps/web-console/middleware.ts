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

// Read the raw Cookie header to avoid any cookie-name parsing issues with
// dots and __Secure- prefix. Matches both:
//   better-auth.session_token  (HTTP / local dev)
//   __Secure-better-auth.session_token  (HTTPS / production)
function hasSession(req: NextRequest): boolean {
  const cookieHeader = req.headers.get('cookie') ?? '';
  return cookieHeader.includes('better-auth.session_token=');
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
