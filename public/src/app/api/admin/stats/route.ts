import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/route-auth';

export async function GET(req: NextRequest) {
  const admin = await getUserFromRequest(req);
  if (!admin || admin.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const [totalUsers, totalAccounts, totalTransactions, totalBalanceAgg, pendingCount, flaggedCount] = await Promise.all([
    db.user.count({ where: { role: 'CUSTOMER' } }),
    db.account.count(),
    db.transaction.count(),
    db.account.aggregate({ _sum: { balance: true } }),
    db.transaction.count({ where: { status: 'PENDING' } }),
    db.transaction.count({ where: { status: 'FLAGGED' } }),
  ]);

  // Daily activity for last 14 days
  const since = new Date();
  since.setDate(since.getDate() - 13);
  since.setHours(0, 0, 0, 0);

  const txs = await db.transaction.findMany({
    where: { date: { gte: since } },
    select: { date: true, amount: true, category: true, status: true },
  });

  const dailyMap = new Map<string, { date: string; credits: number; debits: number; count: number }>();
  for (let i = 0; i < 14; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    dailyMap.set(key, { date: key, credits: 0, debits: 0, count: 0 });
  }
  for (const t of txs) {
    const key = t.date.toISOString().slice(0, 10);
    const entry = dailyMap.get(key);
    if (!entry) continue;
    if (t.toAccountId) entry.credits += t.amount;
    else entry.debits += t.amount;
    entry.count++;
  }

  // Category breakdown
  const categoryTxs = await db.transaction.groupBy({
    by: ['category'],
    _count: { _all: true },
    _sum: { amount: true },
  });

  // Recent audit log
  const audit = await db.auditLog.findMany({
    take: 20,
    orderBy: { createdAt: 'desc' },
    select: { id: true, actor: true, action: true, detail: true, createdAt: true, userId: true },
  });

  // Top customers by balance
  const topCustomers = await db.user.findMany({
    where: { role: 'CUSTOMER' },
    select: {
      id: true, name: true, email: true,
      accounts: { select: { balance: true } },
    },
  });
  const topByBalance = topCustomers
    .map(u => ({ id: u.id, name: u.name, email: u.email, totalBalance: u.accounts.reduce((s, a) => s + a.balance, 0) }))
    .sort((a, b) => b.totalBalance - a.totalBalance)
    .slice(0, 5);

  return NextResponse.json({
    totals: {
      users: totalUsers,
      accounts: totalAccounts,
      transactions: totalTransactions,
      totalBalance: totalBalanceAgg._sum.balance || 0,
      pending: pendingCount,
      flagged: flaggedCount,
    },
    dailyActivity: Array.from(dailyMap.values()),
    categories: categoryTxs.map(c => ({ category: c.category, count: c._count._all, total: c._sum.amount || 0 })),
    audit,
    topCustomers: topByBalance,
  });
}
