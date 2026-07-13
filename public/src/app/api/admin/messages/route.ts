import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/route-auth';
import { notifyCustomer } from '@/lib/notify';

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const messages = await db.message.findMany({
    include: { user: { select: { id: true, name: true, email: true, loginId: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return NextResponse.json({ messages });
}

export async function POST(req: NextRequest) {
  // Admin replying to a client message
  try {
    const admin = await getUserFromRequest(req);
    if (!admin || admin.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { userId, subject, body: msgBody, replyToId } = body as {
      userId: string;
      subject: string;
      body: string;
      replyToId?: string;
    };

    if (!userId || !subject || !msgBody) {
      return NextResponse.json({ error: 'User, subject, and message are required.' }, { status: 400 });
    }

    const message = await db.message.create({
      data: {
        userId,
        subject,
        body: msgBody,
        fromBank: true,
        read: false,
        replyToId: replyToId || null,
      },
    });

    await db.auditLog.create({
      data: { userId, actor: admin.email, action: 'ADMIN_REPLY', detail: `Admin replied to client: "${subject}"` },
    });

    await notifyCustomer(userId, 'MESSAGE', `Bank reply: ${subject}`, `Your private banker replied to your message "${subject}". Log in to view.`);

    return NextResponse.json({ ok: true, message });
  } catch (e) {
    console.error('Admin message error', e);
    return NextResponse.json({ error: 'Server error.' }, { status: 500 });
  }
}
