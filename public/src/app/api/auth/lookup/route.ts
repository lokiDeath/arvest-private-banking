import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const ADMIN_LOGIN_ID = 'LUCIAN1975';

// Step 1 of the Arvest-style login: user enters Login ID, we look them up
// and return minimal identity info so the next screen can show a personal
// greeting + avatar. We do NOT reveal whether the Login ID exists —
// instead we return a placeholder greeting for unknown IDs to prevent enumeration.
export async function POST(req: NextRequest) {
  try {
    const { loginId } = await req.json() as { loginId?: string };
    if (!loginId || !loginId.trim()) {
      return NextResponse.json({ error: 'Login ID is required.' }, { status: 400 });
    }

    const trimmed = loginId.trim();

    // Admin login — case-sensitive exact match
    if (trimmed === ADMIN_LOGIN_ID) {
      return NextResponse.json({
        loginId: ADMIN_LOGIN_ID,
        displayName: 'Bank Administrator',
        avatarUrl: null,
        isAdmin: true,
        placeholder: false,
      });
    }

    // Customer login — case-insensitive loginId match
    // Login IDs are separate from email; admin can set them per customer.
    const user = await db.user.findFirst({
      where: {
        role: 'CUSTOMER',
        OR: [
          { loginId: { equals: trimmed.toLowerCase() } },
          { loginId: { equals: trimmed } },
        ],
      },
      select: { id: true, name: true, email: true, loginId: true, avatarUrl: true, role: true },
    });

    if (!user) {
      // Return a placeholder identity — the subsequent password step will fail
      // with "Invalid Login ID or password" so attackers can't enumerate accounts.
      return NextResponse.json({
        loginId: trimmed,
        displayName: 'Private Client',
        avatarUrl: null,
        placeholder: true,
      });
    }

    return NextResponse.json({
      loginId: user.loginId || user.email,
      displayName: user.name,
      avatarUrl: user.avatarUrl,
      placeholder: false,
    });
  } catch (e) {
    console.error('Lookup error', e);
    return NextResponse.json({ error: 'Server error.' }, { status: 500 });
  }
}
