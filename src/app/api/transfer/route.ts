import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/route-auth';
import { notifyAdmin, notifyCustomer } from '@/lib/notify';

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { fromAccountId, toAccountId, amount, memo, recipientName, recipientAccount, recipientRouting, transferType } = body as {
      fromAccountId: string;
      toAccountId?: string | null;
      amount: number;
      memo?: string;
      recipientName?: string;
      recipientAccount?: string;
      recipientRouting?: string;
      transferType?: 'INTERNAL' | 'EXTERNAL';
    };

    if (!fromAccountId || !amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid transfer details.' }, { status: 400 });
    }
    if (amount > 1000000) {
      return NextResponse.json({ error: 'Amount exceeds single-transfer limit.' }, { status: 400 });
    }

    // Verify source account ownership for customers
    const fromAccount = await db.account.findUnique({ where: { id: fromAccountId } });
    if (!fromAccount) return NextResponse.json({ error: 'Source account not found.' }, { status: 404 });
    if (user.role !== 'ADMIN' && fromAccount.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }
    if (fromAccount.balance < amount) {
      return NextResponse.json({ error: 'Insufficient funds.' }, { status: 400 });
    }
    if (fromAccount.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Source account is not active.' }, { status: 400 });
    }

    // ALL customer transfers are PENDING until the admin approves them.
    // The money is NOT moved until approval — the admin can take as long as needed.
    const status = 'PENDING';

    // External transfer (to others)
    if (transferType === 'EXTERNAL' || !toAccountId) {
      // Create the pending transaction WITHOUT moving any money.
      // Money will be moved when the admin approves it.
      await db.transaction.create({
        data: {
          fromAccountId,
          toAccountId: null,
          userId: fromAccount.userId,
          amount,
          description: `External transfer to ${recipientName || 'recipient'}`,
          category: 'TRANSFER',
          status,
          counterparty: recipientName || 'External Recipient',
          memo: memo || `Transfer to ${recipientAccount || 'N/A'}`,
          date: new Date(),
        },
      });

      await db.auditLog.create({
        data: { userId: user.id, actor: user.email, action: 'TRANSFER_EXTERNAL', detail: `$${amount} to ${recipientName || 'recipient'} (PENDING)` },
      });

      await notifyAdmin('TRANSFER', 'Transfer pending approval', `${user.name} submitted an external transfer of $${amount.toFixed(2)} to ${recipientName || 'recipient'} from ${fromAccount.nickname}. Awaiting your approval.`);
      await notifyCustomer(user.id, 'TRANSFER', 'Transfer submitted', `Your transfer of $${amount.toFixed(2)} to ${recipientName || 'recipient'} from ${fromAccount.nickname} has been submitted and is pending admin approval. Funds will be sent once approved.`);

      return NextResponse.json({
        ok: true,
        status,
        message: 'Transfer submitted. Your private banker will review and approve this transfer. Funds will be sent once approved.',
      });
    }

    // Internal transfer (between own accounts)
    const toAccount = await db.account.findUnique({ where: { id: toAccountId } });
    if (!toAccount) return NextResponse.json({ error: 'Destination account not found.' }, { status: 404 });
    if (user.role !== 'ADMIN' && toAccount.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    // Create pending transactions WITHOUT moving any money.
    // Money will be moved when the admin approves it.
    await db.transaction.create({
      data: {
        fromAccountId,
        toAccountId,
        userId: fromAccount.userId,
        amount,
        description: `Transfer to ${toAccount.nickname}`,
        category: 'TRANSFER',
        status,
        counterparty: toAccount.nickname,
        memo: memo || 'Internal transfer',
        date: new Date(),
      },
    });

    await db.auditLog.create({
      data: { userId: user.id, actor: user.email, action: 'TRANSFER_INTERNAL', detail: `$${amount} from ${fromAccount.nickname} to ${toAccount.nickname} (PENDING)` },
    });

    await notifyAdmin('TRANSFER', 'Transfer pending approval', `${user.name} submitted an internal transfer of $${amount.toFixed(2)} from ${fromAccount.nickname} to ${toAccount.nickname}. Awaiting your approval.`);
    await notifyCustomer(user.id, 'TRANSFER', 'Transfer submitted', `Your transfer of $${amount.toFixed(2)} from ${fromAccount.nickname} to ${toAccount.nickname} has been submitted and is pending admin approval. Funds will be moved once approved.`);

    return NextResponse.json({
      ok: true,
      status,
      message: 'Transfer submitted. Your private banker will review and approve this transfer. Funds will be moved once approved.',
    });
  } catch (e) {
    console.error('Transfer error', e);
    return NextResponse.json({ error: 'Server error during transfer.' }, { status: 500 });
  }
}
