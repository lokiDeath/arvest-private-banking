import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/route-auth';

// GET /api/statements?accountId=xxx&from=YYYY-MM-DD&to=YYYY-MM-DD
// Returns structured statement data for PDF generation client-side.
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = req.nextUrl;
  const accountId = url.searchParams.get('accountId');
  if (!accountId) return NextResponse.json({ error: 'accountId required' }, { status: 400 });

  const account = await db.account.findUnique({
    where: { id: accountId },
    include: { user: { select: { id: true, name: true, email: true, address: true } } },
  });
  if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  if (user.role !== 'ADMIN' && account.userId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const fromStr = url.searchParams.get('from');
  const toStr = url.searchParams.get('to');
  const from = fromStr ? new Date(fromStr) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const to = toStr ? new Date(toStr) : new Date();

  const transactions = await db.transaction.findMany({
    where: {
      OR: [{ fromAccountId: accountId }, { toAccountId: accountId }],
      date: { gte: from, lte: to },
    },
    orderBy: { date: 'asc' },
  });

  // Compute running balance — approximate using ending balance back-calculated
  const credits = transactions.filter(t => t.toAccountId === accountId).reduce((s, t) => s + t.amount, 0);
  const debits = transactions.filter(t => t.fromAccountId === accountId).reduce((s, t) => s + t.amount, 0);

  return NextResponse.json({
    account: {
      id: account.id,
      nickname: account.nickname,
      type: account.type,
      accountNumber: account.accountNumber,
      routingNumber: account.routingNumber,
      currency: account.currency,
    },
    customer: account.user,
    period: { from: from.toISOString(), to: to.toISOString() },
    startingBalance: account.balance - credits + debits,
    endingBalance: account.balance,
    totalCredits: credits,
    totalDebits: debits,
    transactions: transactions.map(t => ({
      id: t.id,
      date: t.date.toISOString(),
      description: t.description,
      counterparty: t.counterparty,
      memo: t.memo,
      category: t.category,
      status: t.status,
      amount: t.amount,
      direction: t.toAccountId === accountId ? 'CREDIT' : 'DEBIT',
    })),
    generatedAt: new Date().toISOString(),
  });
}
