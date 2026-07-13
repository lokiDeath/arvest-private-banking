import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/route-auth';
import { notifyAdmin, notifyCustomer } from '@/lib/notify';

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const where = user.role === 'ADMIN' ? {} : { userId: user.id };
  const deposits = await db.checkDeposit.findMany({
    where,
    include: user.role === 'ADMIN' ? { user: { select: { id: true, name: true, email: true } } } : false,
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ deposits });
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { accountId, amount, checkNumber, frontImage, backImage, memo } = body as {
      accountId: string;
      amount: number;
      checkNumber?: string;
      frontImage?: string;
      backImage?: string;
      memo?: string;
    };

    if (!accountId || !amount || amount <= 0) {
      return NextResponse.json({ error: 'Account and valid amount are required.' }, { status: 400 });
    }
    if (amount > 50_000) {
      return NextResponse.json({ error: 'Mobile deposit limit is $50,000 per check.' }, { status: 400 });
    }

    const account = await db.account.findUnique({ where: { id: accountId } });
    if (!account || (user.role !== 'ADMIN' && account.userId !== user.id)) {
      return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
    }

    // ALL mobile deposits are PENDING until admin approves.
    const deposit = await db.checkDeposit.create({
      data: {
        userId: user.id,
        accountId,
        amount,
        checkNumber: checkNumber || null,
        frontImage: frontImage || null,
        backImage: backImage || null,
        status: 'PENDING',
        memo,
      },
    });

    await db.auditLog.create({
      data: { userId: user.id, actor: user.email, action: 'CHECK_DEPOSIT', detail: `$${amount} to ${account.nickname} (PENDING)` },
    });

    await notifyAdmin('CHECK_DEPOSIT', 'Mobile deposit pending review', `${user.name} submitted a mobile deposit of $${amount.toFixed(2)} to ${account.nickname}. Awaiting your approval.`, user.id);
    await notifyCustomer(user.id, 'CHECK_DEPOSIT', 'Deposit submitted', `Your mobile deposit of $${amount.toFixed(2)} to ${account.nickname} has been submitted and is pending review. Funds will be available once approved.`);

    return NextResponse.json({ ok: true, deposit });
  } catch (e) {
    console.error('Check deposit error', e);
    return NextResponse.json({ error: 'Server error.' }, { status: 500 });
  }
}
