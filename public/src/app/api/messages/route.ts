import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/route-auth';
import { notifyAdmin, notifyCustomer } from '@/lib/notify';

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const where = user.role === 'ADMIN' ? {} : { userId: user.id };
  const messages = await db.message.findMany({
    where,
    include: user.role === 'ADMIN' ? { user: { select: { id: true, name: true, email: true } } } : false,
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ messages });
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { subject, body: msgBody, replyToId } = body as {
      subject: string;
      body: string;
      replyToId?: string;
    };

    if (!subject || !msgBody) {
      return NextResponse.json({ error: 'Subject and message are required.' }, { status: 400 });
    }

    const message = await db.message.create({
      data: {
        userId: user.id,
        subject,
        body: msgBody,
        fromBank: false,
        read: false,
        replyToId: replyToId || null,
      },
    });

    await db.auditLog.create({
      data: { userId: user.id, actor: user.email, action: 'MESSAGE_SENT', detail: `Subject: ${subject}` },
    });

    await notifyAdmin('MESSAGE', 'New client message', `${user.name} sent a new message: "${subject}".`, user.id);
    await notifyCustomer(user.id, 'MESSAGE', 'Message sent', `Your message "${subject}" has been sent to your private banking team. You will receive a reply shortly.`);

    return NextResponse.json({ ok: true, message });
  } catch (e) {
    console.error('Message create error', e);
    return NextResponse.json({ error: 'Server error.' }, { status: 500 });
  }
}
