import { auth } from '@/lib/auth';
import { toNextJsHandler } from 'better-auth/next-js';

// Force Node.js runtime — pg driver requires it (not compatible with edge)
export const runtime = 'nodejs';

export const { GET, POST } = toNextJsHandler(auth);
