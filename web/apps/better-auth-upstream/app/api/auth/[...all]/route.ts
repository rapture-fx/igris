import { toNextJsHandler } from 'better-auth/next-js';
import { createAuthHandler } from '@/lib/auth-server';

const auth = createAuthHandler();
const handler = auth ? toNextJsHandler(auth) : null;

function notConfigured() {
  return Response.json(
    { error: 'auth_not_configured', code: 'AUTH_NOT_CONFIGURED' },
    { status: 503 },
  );
}

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!handler) return notConfigured();
  return handler.GET(request);
}

export async function POST(request: Request) {
  if (!handler) return notConfigured();
  return handler.POST(request);
}

export async function PUT(request: Request) {
  if (!handler) return notConfigured();
  return handler.PUT(request);
}

export async function PATCH(request: Request) {
  if (!handler) return notConfigured();
  return handler.PATCH(request);
}

export async function DELETE(request: Request) {
  if (!handler) return notConfigured();
  return handler.DELETE(request);
}