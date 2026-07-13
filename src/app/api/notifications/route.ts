import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/route-auth';

// GET /api/notifications — returns notifications for the current user.
// Admin sees all admin notifications. Customer sees their own notifications.
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let where: any;
  if (user.role === 'ADMIN') {
    // Admin sees all notifications directed to ADMIN role
    where = { recipientRole: 'ADMIN' };
  } else {
    // Customer sees their own notifications
    where = { recipientId: user.id };
  }

  const notifications = await db.notification.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true, loginId: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return NextResponse.json({ notifications });
}
