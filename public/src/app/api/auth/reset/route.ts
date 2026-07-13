import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { email, code, password } = await req.json() as { email?: string; code?: string; password?: string };
    if (!email || !code || !password) {
      return NextResponse.json({ error: 'Email, code, and new password are required.' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 });
    }

    const record = await db.resetCode.findFirst({
      where: { email: email.toLowerCase().trim(), code, used: false },
      orderBy: { createdAt: 'desc' },
    });

    if (!record || record.expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: 'Invalid or expired code.' }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { email: record.email } });
    if (!user) return NextResponse.json({ error: 'User not found.' }, { status: 404 });

    const hash = await hashPassword(password);
    await db.user.update({ where: { id: user.id }, data: { passwordHash: hash } });
    await db.resetCode.update({ where: { id: record.id }, data: { used: true } });
    await db.auditLog.create({
      data: { userId: user.id, actor: user.email, action: 'PASSWORD_RESET', detail: 'Password reset via email code' },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error.' }, { status: 500 });
  }
}
