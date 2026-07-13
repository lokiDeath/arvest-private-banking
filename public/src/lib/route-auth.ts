// Server-side helper for reading the per-tab session token from request headers.
import { NextRequest } from 'next/server';
import { getCurrentUserFromToken } from '@/lib/auth';

// Returns the current user based on the X-Tab-Session header.
// Use this in route handlers (not server components).
export async function getUserFromRequest(req: NextRequest) {
  const tabToken = req.headers.get('X-Tab-Session');
  return getCurrentUserFromToken(tabToken);
}

export function getTabTokenFromRequest(req: NextRequest): string | null {
  return req.headers.get('X-Tab-Session');
}
