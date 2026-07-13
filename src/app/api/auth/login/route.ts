import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createSession, hashPassword, verifyPassword } from '@/lib/auth';
import { notifyAdmin } from '@/lib/notify';

// Hard-coded admin credentials — only this Login ID + password combo
// grants access to the admin portal. Stored in code (not in the DB) so
// it cannot be changed from inside the app and is not enumerable.
const ADMIN_LOGIN_ID = 'LUCIAN1975';
const ADMIN_PASSWORD = 'PASSWORD@@1975';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawLogin = body.loginId || body.email;
    const { password, remember } = body as { loginId?: string; email?: string; password?: string; remember?: boolean };

    if (!rawLogin || !password) {
      return NextResponse.json({ error: 'Login ID and password are required.' }, { status: 400 });
    }

    // ===== Admin login (case-sensitive) =====
    if (rawLogin === ADMIN_LOGIN_ID && password === ADMIN_PASSWORD) {
      const admin = await db.user.findFirst({ where: { role: 'ADMIN' } });
      let adminUser = admin;
      if (!adminUser) {
        // Bootstrap an admin record on first login if missing
        const hash = await hashPassword(ADMIN_PASSWORD);
        adminUser = await db.user.create({
          data: {
            email: ADMIN_LOGIN_ID,
            name: 'Bank Administrator',
            passwordHash: hash,
            role: 'ADMIN',
            phone: '+1 (479) 555-0100',
            address: 'Arvest Private Banking HQ',
          },
        });
      }

      const { tabToken } = await createSession({
        userId: adminUser.id,
        email: adminUser.email,
        role: 'ADMIN',
        name: adminUser.name,
      }, { remember });

      await db.auditLog.create({
        data: { userId: adminUser.id, actor: ADMIN_LOGIN_ID, action: 'ADMIN_LOGIN', detail: 'Administrator signed in' },
      });

      return NextResponse.json({
        user: { id: adminUser.id, email: adminUser.email, name: adminUser.name, role: 'ADMIN' },
        tabToken,
        redirectTo: 'admin',
      });
    }

    // ===== Customer login =====
    // Look up by loginId (case-insensitive). Falls back to email for backward compatibility.
    const normalized = String(rawLogin).toLowerCase().trim();
    const user = await db.user.findFirst({
      where: {
        role: 'CUSTOMER',
        OR: [
          { loginId: { equals: normalized } },
          { loginId: { equals: String(rawLogin).trim() } },
          { email: normalized },
        ],
      },
    });
    if (!user) {
      return NextResponse.json({ error: 'Invalid Login ID or password.' }, { status: 401 });
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: 'Invalid Login ID or password.' }, { status: 401 });
    }

    const { tabToken } = await createSession({
      userId: user.id,
      email: user.email,
      role: 'CUSTOMER',
      name: user.name,
    }, { remember });

    await db.auditLog.create({
      data: { userId: user.id, actor: user.email, action: 'LOGIN', detail: 'Customer signed in' },
    });

    // Notify admin that a customer logged in
    const loginTime = new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });
    await notifyAdmin('LOGIN', 'Customer signed in', `${user.name} (${user.loginId || user.email}) signed in to private banking at ${loginTime}.`, user.id);

    return NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name, role: 'CUSTOMER' },
      tabToken,
      redirectTo: 'customer',
    });
  } catch (e) {
    console.error('Login error', e);
    return NextResponse.json({ error: 'Server error. Please try again.' }, { status: 500 });
  }
}
