import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, verifyPassword } from '@/lib/auth';
import { getUserFromRequest } from '@/lib/route-auth';

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      address: user.address,
      avatarUrl: user.avatarUrl,
      role: user.role,
      createdAt: user.createdAt,
    },
  });
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { name, loginId, phone, address, avatarUrl, currentPassword, newPassword } = body as {
      name?: string; loginId?: string; phone?: string; address?: string; avatarUrl?: string;
      currentPassword?: string; newPassword?: string;
    };

    const data: any = {};
    if (name !== undefined) data.name = name;
    if (phone !== undefined) data.phone = phone;
    if (address !== undefined) data.address = address;
    if (avatarUrl !== undefined) data.avatarUrl = avatarUrl;

    // Login ID update — check uniqueness if changing
    if (loginId !== undefined && loginId.trim() !== '') {
      const normalized = loginId.trim().toLowerCase();
      // Make sure no OTHER user has this loginId
      const existing = await db.user.findFirst({
        where: { loginId: normalized, NOT: { id: user.id } },
      });
      if (existing) {
        return NextResponse.json({ error: 'This Login ID is already taken. Please choose another.' }, { status: 400 });
      }
      data.loginId = normalized;
    }

    if (newPassword) {
      if (!currentPassword) return NextResponse.json({ error: 'Current password required to change password.' }, { status: 400 });
      const full = await db.user.findUnique({ where: { id: user.id } });
      if (!full) return NextResponse.json({ error: 'User not found.' }, { status: 404 });
      const ok = await verifyPassword(currentPassword, full.passwordHash);
      if (!ok) return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 400 });
      if (newPassword.length < 8) return NextResponse.json({ error: 'New password must be at least 8 characters.' }, { status: 400 });
      data.passwordHash = await hashPassword(newPassword);
    }

    await db.user.update({ where: { id: user.id }, data });
    await db.auditLog.create({
      data: { userId: user.id, actor: user.email, action: 'PROFILE_UPDATE', detail: 'Profile updated' },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error.' }, { status: 500 });
  }
}
