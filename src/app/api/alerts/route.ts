import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/route-auth';

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const where = user.role === 'ADMIN' ? {} : { userId: user.id };
  const alerts = await db.alert.findMany({
    where,
    include: user.role === 'ADMIN' ? { user: { select: { id: true, name: true } } } : undefined,
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ alerts });
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { type, threshold, accountId, enabled } = body as {
      type: string;
      threshold?: number;
      accountId?: string;
      enabled?: boolean;
    };

    if (!type) return NextResponse.json({ error: 'Alert type is required.' }, { status: 400 });

    // Verify account ownership if provided
    if (accountId) {
      const acct = await db.account.findUnique({ where: { id: accountId } });
      if (!acct || (user.role !== 'ADMIN' && acct.userId !== user.id)) {
        return NextResponse.json({ error: 'Invalid account.' }, { status: 400 });
      }
    }

    const alert = await db.alert.create({
      data: {
        userId: user.id,
        type,
        threshold: threshold ?? null,
        accountId: accountId || null,
        enabled: enabled !== false,
      },
    });

    return NextResponse.json({ ok: true, alert });
  } catch (e) {
    console.error('Alert create error', e);
    return NextResponse.json({ error: 'Server error.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { id, enabled } = body as { id: string; enabled?: boolean };

    if (!id) return NextResponse.json({ error: 'Alert id required.' }, { status: 400 });

    const existing = await db.alert.findUnique({ where: { id } });
    if (!existing || (user.role !== 'ADMIN' && existing.userId !== user.id)) {
      return NextResponse.json({ error: 'Alert not found.' }, { status: 404 });
    }

    const data: any = {};
    if (enabled !== undefined) data.enabled = enabled;

    const alert = await db.alert.update({ where: { id }, data });
    return NextResponse.json({ ok: true, alert });
  } catch (e) {
    console.error('Alert update error', e);
    return NextResponse.json({ error: 'Server error.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Alert id required.' }, { status: 400 });

    const existing = await db.alert.findUnique({ where: { id } });
    if (!existing || (user.role !== 'ADMIN' && existing.userId !== user.id)) {
      return NextResponse.json({ error: 'Alert not found.' }, { status: 404 });
    }

    await db.alert.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Alert delete error', e);
    return NextResponse.json({ error: 'Server error.' }, { status: 500 });
  }
}
