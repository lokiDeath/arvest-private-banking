// Arvest Private Banking — Auth library
// Stateless per-tab session tokens (JWT-like, signed with HMAC).
//
// How it works:
//   1. User logs in → server creates a signed token containing userId, role, tabId, expiry
//   2. Token is returned to the client and stored in sessionStorage (scoped to ONE tab)
//   3. Client sends token as X-Tab-Session header on every API request
//   4. Server verifies signature + expiry → authenticates the request
//   5. Closing the tab wipes sessionStorage → token is gone → must re-login
//   6. Opening a new tab (even by copying the URL) starts with empty sessionStorage → must re-login
//
// This means:
//   - Logging in tab A does NOT log in tab B
//   - Multiple users can be signed in simultaneously in different tabs
//   - No server-side session storage needed (stateless)
//   - Logout = clear sessionStorage on the client
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const REMEMBER_COOKIE = 'arvest_remember';
const SECRET = process.env.SESSION_SECRET || 'arvest-private-banking-demo-secret-2026';

export interface SessionPayload {
  userId: string;
  email: string;
  role: 'CUSTOMER' | 'ADMIN';
  name: string;
  tabId: string;       // unique per tab/session
  iat: number;
  exp: number;
}

function sign(payload: SessionPayload): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verify(token: string): SessionPayload | null {
  try {
    const [data, sig] = token.split('.');
    if (!data || !sig) return null;
    const expected = crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
    if (sig !== expected) return null;
    const payload: SessionPayload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Create a per-tab session token. Stateless — no server-side storage needed.
export async function createSession(payload: Omit<SessionPayload, 'iat' | 'exp' | 'tabId'>, opts?: { remember?: boolean }): Promise<{ tabToken: string; tabId: string }> {
  const now = Date.now();
  const ttlMs = 8 * 60 * 60 * 1000; // 8 hours per tab session
  const tabId = crypto.randomBytes(16).toString('hex');
  const full: SessionPayload = {
    ...payload,
    tabId,
    iat: now,
    exp: now + ttlMs,
  };
  const token = sign(full);

  // Remember-me cookie: stores userId so we could offer a "resume" later
  // (not currently used for auto-resume — every new tab requires fresh login,
  // which is exactly what the user requested).
  if (opts?.remember) {
    const cookieStore = await cookies();
    cookieStore.set(REMEMBER_COOKIE, JSON.stringify({ userId: payload.userId, exp: now + 30 * 24 * 60 * 60 * 1000 }), {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    });
  }

  return { tabToken: token, tabId };
}

export async function destroySession(_tabId?: string) {
  // Stateless — nothing to destroy server-side. The client clears sessionStorage.
  // We also clear the remember-me cookie on explicit logout.
  const cookieStore = await cookies();
  cookieStore.delete(REMEMBER_COOKIE);
}

// Verify a tab token (from X-Tab-Session header). Stateless signature check.
export function verifyTabToken(tabToken: string): SessionPayload | null {
  return verify(tabToken);
}

export async function getSession(): Promise<SessionPayload | null> {
  // Server components don't have access to custom request headers easily,
  // so this method is limited. Route handlers should use getSessionFromToken()
  // with the X-Tab-Session header instead.
  return null;
}

export function getSessionFromToken(tabToken: string | null | undefined): SessionPayload | null {
  if (!tabToken) return null;
  return verify(tabToken);
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, loginId: true, name: true, role: true, phone: true, address: true, avatarUrl: true, createdAt: true },
  });
  return user;
}

// Get current user from an explicit tab token (used by route handlers).
export async function getCurrentUserFromToken(tabToken: string | null | undefined) {
  const session = getSessionFromToken(tabToken);
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, loginId: true, name: true, role: true, phone: true, address: true, avatarUrl: true, createdAt: true },
  });
  return user;
}

export async function requireCustomer() {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');
  if (user.role !== 'CUSTOMER') throw new Error('FORBIDDEN');
  return user;
}

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) throw new Error('UNAUTHORIZED');
  if (user.role !== 'ADMIN') throw new Error('FORBIDDEN');
  return user;
}

export function genResetCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function genAccountNumber(): string {
  let s = '';
  for (let i = 0; i < 10; i++) s += Math.floor(Math.random() * 10).toString();
  return s;
}

export const ARVEST_ROUTING = '082900883';
