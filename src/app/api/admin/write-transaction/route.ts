import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/route-auth';
import { notifyAdmin, notifyCustomer } from '@/lib/notify';

// POST /api/admin/write-transaction
// Admin-only: writes a transaction into any customer's account.
// Supports DEPOSIT (incoming), WITHDRAWAL (outgoing), TRANSFER (between two accounts).
// Adjusts balances accordingly.
export async function POST(req: NextRequest) {
  const admin = await getUserFromRequest(req);
  if (!admin || admin.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const {
    accountId, direction, amount, description, counterparty, category, memo, status, date,
    // For transfer between two accounts
    toAccountId,
  } = body as {
    accountId: string;
    direction: 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER';
    amount: number;
    description?: string;
    counterparty?: string;
    category?: string;
    memo?: string;
    status?: string;
    date?: string;
    toAccountId?: string;
  };

  if (!accountId || !amount || amount <= 0 || !direction) {
    return NextResponse.json({ error: 'accountId, direction, and positive amount are required' }, { status: 400 });
  }

  const account = await db.account.findUnique({ where: { id: accountId } });
  if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

  const txDate = date ? new Date(date) : new Date();
  const txStatus = status || 'POSTED';

  if (direction === 'TRANSFER' && toAccountId) {
    const toAccount = await db.account.findUnique({ where: { id: toAccountId } });
    if (!toAccount) return NextResponse.json({ error: 'Destination account not found' }, { status: 404 });
    if (account.balance < amount) return NextResponse.json({ error: 'Source account has insufficient funds' }, { status: 400 });

    await db.$transaction(async (tx) => {
      await tx.account.update({ where: { id: account.id }, data: { balance: { decrement: amount }, available: { decrement: amount } } });
      await tx.account.update({ where: { id: toAccount.id }, data: { balance: { increment: amount }, available: { increment: amount } } });
      await tx.transaction.create({
        data: {
          fromAccountId: account.id,
          toAccountId: toAccount.id,
          userId: account.userId,
          amount,
          description: description || `Transfer to ${toAccount.nickname}`,
          category: category || 'TRANSFER',
          status: txStatus,
          counterparty: counterparty || toAccount.nickname,
          memo: memo || 'Admin-initiated transfer',
          date: txDate,
        },
      });
      await tx.transaction.create({
        data: {
          fromAccountId: null,
          toAccountId: toAccount.id,
          userId: toAccount.userId,
          amount,
          description: description || `Transfer from ${account.nickname}`,
          category: category || 'TRANSFER',
          status: txStatus,
          counterparty: counterparty || account.nickname,
          memo: memo || 'Admin-initiated transfer',
          date: txDate,
        },
      });
    });

    await db.auditLog.create({
      data: { userId: account.userId, actor: admin.email, action: 'ADMIN_TRANSFER', detail: `Admin moved $${amount} from ${account.nickname} to ${toAccount.nickname}` },
    });

    const transferCustomer = await db.user.findUnique({ where: { id: account.userId }, select: { name: true } });
    await notifyAdmin('TX_WRITE', 'Admin transfer', `Admin transferred $${amount.toFixed(2)} from ${transferCustomer?.name || 'customer'}'s ${account.nickname} to ${toAccount.nickname}.`, account.userId);
    await notifyCustomer(account.userId, 'TX_WRITE', 'Transfer posted', `A transfer of $${amount.toFixed(2)} from your ${account.nickname} to ${toAccount.nickname} was posted by Arvest Private Banking.`);

    return NextResponse.json({ ok: true });
  }

  // DEPOSIT or WITHDRAWAL on a single account
  const isDeposit = direction === 'DEPOSIT';
  const delta = isDeposit ? amount : -amount;

  if (!isDeposit && account.balance < amount) {
    return NextResponse.json({ error: 'Account has insufficient funds for withdrawal' }, { status: 400 });
  }

  await db.$transaction(async (tx) => {
    await tx.account.update({
      where: { id: account.id },
      data: { balance: { increment: delta }, available: { increment: delta } },
    });
    await tx.transaction.create({
      data: {
        fromAccountId: isDeposit ? null : account.id,
        toAccountId: isDeposit ? account.id : null,
        userId: account.userId,
        amount,
        description: description || (isDeposit ? 'Deposit' : 'Withdrawal'),
        category: category || (isDeposit ? 'DEPOSIT' : 'WITHDRAWAL'),
        status: txStatus,
        counterparty: counterparty || (isDeposit ? 'External Deposit' : 'External Withdrawal'),
        memo: memo || 'Admin-initiated entry',
        date: txDate,
      },
    });
  });

  await db.auditLog.create({
    data: { userId: account.userId, actor: admin.email, action: 'ADMIN_TX_WRITE', detail: `Admin wrote ${direction} of $${amount} to ${account.nickname}` },
  });

  const txCustomer = await db.user.findUnique({ where: { id: account.userId }, select: { name: true } });
  await notifyAdmin('TX_WRITE', 'Admin transaction', `Admin wrote a ${direction.toLowerCase()} of $${amount.toFixed(2)} to ${txCustomer?.name || 'customer'}'s ${account.nickname} (${description || direction.toLowerCase()}).`, account.userId);
  await notifyCustomer(account.userId, 'TX_WRITE', direction === 'DEPOSIT' ? 'Deposit received' : 'Withdrawal posted', `A ${direction.toLowerCase()} of $${amount.toFixed(2)} ${direction === 'DEPOSIT' ? 'was deposited into' : 'was posted from'} your ${account.nickname} by Arvest Private Banking${description ? ` (${description})` : ''}.`);

  return NextResponse.json({ ok: true });
}
