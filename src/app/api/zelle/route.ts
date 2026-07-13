import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/route-auth';
import { notifyAdmin, notifyCustomer } from '@/lib/notify';

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const where = user.role === 'ADMIN' ? {} : { userId: user.id };
  const transfers = await db.zelleTransfer.findMany({
    where,
    include: user.role === 'ADMIN' ? { user: { select: { id: true, name: true, email: true } } } : false,
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ transfers });
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { fromAccountId, recipientName, recipientEmail, recipientPhone, amount, memo } = body as {
      fromAccountId: string;
      recipientName: string;
      recipientEmail?: string;
      recipientPhone?: string;
      amount: number;
      memo?: string;
    };

    if (!fromAccountId || !recipientName || !amount || amount <= 0) {
      return NextResponse.json({ error: 'Account, recipient, and valid amount are required.' }, { status: 400 });
    }
    if (!recipientEmail && !recipientPhone) {
      return NextResponse.json({ error: 'Recipient email or phone is required.' }, { status: 400 });
    }
    if (amount > 5_000) {
      return NextResponse.json({ error: 'Zelle daily limit is $5,000.' }, { status: 400 });
    }

    const account = await db.account.findUnique({ where: { id: fromAccountId } });
    if (!account || (user.role !== 'ADMIN' && account.userId !== user.id)) {
      return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
    }
    if (account.balance < amount) {
      return NextResponse.json({ error: 'Insufficient funds.' }, { status: 400 });
    }

    // Create PENDING zelle + pending transaction (money NOT moved until admin approval)
    await db.$transaction(async (tx) => {
      await tx.zelleTransfer.create({
        data: {
          userId: user.id,
          fromAccountId,
          recipientName,
          recipientEmail: recipientEmail || null,
          recipientPhone: recipientPhone || null,
          amount,
          memo: memo || null,
          status: 'PENDING',
        },
      });
      await tx.transaction.create({
        data: {
          fromAccountId,
          toAccountId: null,
          userId: account.userId,
          amount,
          description: `Zelle to ${recipientName}`,
          category: 'PAYMENT',
          status: 'PENDING',
          counterparty: `${recipientName} (Zelle)`,
          memo: memo || `Zelle to ${recipientEmail || recipientPhone || recipientName}`,
          date: new Date(),
        },
      });
    });

    await db.auditLog.create({
      data: { userId: user.id, actor: user.email, action: 'ZELLE_TRANSFER', detail: `$${amount} to ${recipientName} (PENDING)` },
    });

    await notifyAdmin('ZELLE', 'Zelle transfer pending approval', `${user.name} submitted a Zelle transfer of $${amount.toFixed(2)} to ${recipientName} (${recipientEmail || recipientPhone}). Awaiting your approval.`, user.id);
    await notifyCustomer(user.id, 'ZELLE', 'Zelle sent', `Your Zelle transfer of $${amount.toFixed(2)} to ${recipientName} has been submitted and is pending admin approval. Funds will be sent once approved.`);

    return NextResponse.json({ ok: true, message: 'Zelle transfer submitted. Pending admin approval.' });
  } catch (e) {
    console.error('Zelle error', e);
    return NextResponse.json({ error: 'Server error.' }, { status: 500 });
  }
}
