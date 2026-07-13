import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/route-auth';
import { notifyAdmin, notifyCustomer } from '@/lib/notify';

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const where = user.role === 'ADMIN' ? {} : { userId: user.id };
  const bills = await db.billPay.findMany({
    where,
    include: { account: { select: { id: true, nickname: true, accountNumber: true } } },
    orderBy: { payDate: 'desc' },
  });
  return NextResponse.json({ bills });
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { accountId, payee, amount, memo, payDate } = body as {
      accountId: string;
      payee: string;
      amount: number;
      memo?: string;
      payDate?: string;
    };

    if (!accountId || !payee || !amount || amount <= 0) {
      return NextResponse.json({ error: 'All fields are required.' }, { status: 400 });
    }

    const account = await db.account.findUnique({ where: { id: accountId } });
    if (!account) return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
    if (user.role !== 'ADMIN' && account.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }
    if (account.balance < amount) {
      return NextResponse.json({ error: 'Insufficient funds for this payment.' }, { status: 400 });
    }

    const reference = `ARP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const scheduledDate = payDate ? new Date(payDate) : new Date();
    // ALL bill payments are PENDING until admin approves.
    // Money is NOT moved until approval.
    await db.$transaction(async (tx) => {
      await tx.billPay.create({
        data: {
          userId: account.userId,
          accountId,
          payee,
          amount,
          memo,
          payDate: scheduledDate,
          status: 'SCHEDULED',
          reference,
        },
      });
      // Create a PENDING transaction — money will be moved when admin approves
      await tx.transaction.create({
        data: {
          fromAccountId: accountId,
          toAccountId: null,
          userId: account.userId,
          amount,
          description: `Bill payment — ${payee}`,
          category: 'PAYMENT',
          status: 'PENDING',
          counterparty: payee,
          memo: memo || `Ref: ${reference}`,
          date: new Date(),
        },
      });
    });

    await db.auditLog.create({
      data: { userId: user.id, actor: user.email, action: 'BILL_PAY', detail: `$${amount} to ${payee} (ref ${reference}) (PENDING)` },
    });

    await notifyAdmin('BILL_PAY', 'Bill payment pending approval', `${user.name} submitted a bill payment of $${amount.toFixed(2)} to ${payee} (Ref: ${reference}). Awaiting your approval.`);
    await notifyCustomer(user.id, 'BILL_PAY', 'Payment submitted', `Your payment of $${amount.toFixed(2)} to ${payee} has been submitted and is pending admin approval (Ref: ${reference}). Funds will be sent once approved.`);

    return NextResponse.json({
      ok: true,
      reference,
      message: 'Payment submitted. Your private banker will review and approve this payment. Funds will be sent once approved.',
    });
  } catch (e) {
    console.error('Bill pay error', e);
    return NextResponse.json({ error: 'Server error during payment.' }, { status: 500 });
  }
}
