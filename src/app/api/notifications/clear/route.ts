import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/route-auth';

// POST /api/notifications/clear — delete ALL notifications for the current user
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const where = user.role === 'ADMIN'
    ? { recipientRole: 'ADMIN' }
    : { recipientId: user.id };

  await db.notification.deleteMany({ where });
  return NextResponse.json({ ok: true });
}
