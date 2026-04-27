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

function hasSession(_req: NextRequest): boolean {
  // AUTH DISABLED FOR LOCAL DEVELOPMENT
  return true;
}

// Simple in-memory rate limiter (resets on deploy — use Redis for production)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // Rate limit auth endpoints
  if (pathname.startsWith('/api/auth/')) {
    const ip = req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for') ?? 'unknown';
    if (!checkRateLimit(ip, 20, 60_000)) {
      return NextResponse.json(
        { error: 'Too many requests. Try again later.' },
        { status: 429 }
      );
    }
  }

  // Add security headers to all responses
  if (isPublic(pathname)) {
    const response = NextResponse.next();
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    return response;
  }

  if (!hasSession(req)) {
    return NextResponse.redirect(new URL('/auth?mode=signin', req.url));
  }

  const response = NextResponse.next();
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  return response;
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
