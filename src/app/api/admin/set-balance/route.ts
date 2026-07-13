import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/route-auth';
import { notifyAdmin, notifyCustomer } from '@/lib/notify';

// POST /api/admin/set-balance
// Admin-only: sets an account's balance to a specific value.
// Optionally writes an adjusting transaction to record the change.
export async function POST(req: NextRequest) {
  const admin = await getUserFromRequest(req);
  if (!admin || admin.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const { accountId, newBalance, writeAdjustment, description } = body as {
    accountId: string;
    newBalance: number;
    writeAdjustment?: boolean;
    description?: string;
  };

  if (!accountId || newBalance === undefined || newBalance < 0) {
    return NextResponse.json({ error: 'accountId and non-negative newBalance are required' }, { status: 400 });
  }

  const account = await db.account.findUnique({ where: { id: accountId } });
  if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

  const diff = newBalance - account.balance;

  await db.$transaction(async (tx) => {
    await tx.account.update({
      where: { id: accountId },
      data: { balance: newBalance, available: newBalance },
    });

    if (writeAdjustment && Math.abs(diff) > 0.001) {
      const isCredit = diff > 0;
      await tx.transaction.create({
        data: {
          fromAccountId: isCredit ? null : account.id,
          toAccountId: isCredit ? account.id : null,
          userId: account.userId,
          amount: Math.abs(diff),
          description: description || (isCredit ? 'Admin balance adjustment (credit)' : 'Admin balance adjustment (debit)'),
          category: 'OTHER',
          status: 'POSTED',
          counterparty: 'Arvest Admin',
          memo: `Balance set from ${account.balance} to ${newBalance}`,
          date: new Date(),
        },
      });
    }
  });

  await db.auditLog.create({
    data: { userId: account.userId, actor: admin.email, action: 'ADMIN_SET_BALANCE', detail: `Set ${account.nickname} balance from ${account.balance} to ${newBalance}` },
  });

  // Get the customer's name for the notification
  const customer = await db.user.findUnique({ where: { id: account.userId }, select: { name: true } });
  await notifyAdmin('BALANCE_CHANGE', 'Balance adjusted', `Admin adjusted ${customer?.name || 'customer'}'s ${account.nickname} balance from $${account.balance.toFixed(2)} to $${newBalance.toFixed(2)}.`, account.userId);
  await notifyCustomer(account.userId, 'BALANCE_CHANGE', 'Account balance updated', `Your ${account.nickname} balance was updated by Arvest Private Banking from $${account.balance.toFixed(2)} to $${newBalance.toFixed(2)}.`);

  return NextResponse.json({ ok: true, newBalance });
}
