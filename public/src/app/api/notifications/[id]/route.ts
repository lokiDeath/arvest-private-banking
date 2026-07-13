import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/route-auth';

// DELETE /api/notifications/[id] — delete a single notification
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  // Find the notification
  const notif = await db.notification.findUnique({ where: { id } });
  if (!notif) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Authorization: admin can delete any admin notification; customer can only delete their own
  if (user.role === 'ADMIN') {
    if (notif.recipientRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  } else {
    if (notif.recipientId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  await db.notification.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
