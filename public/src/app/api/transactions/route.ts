import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/route-auth';

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = req.nextUrl;
  const accountId = url.searchParams.get('accountId') || undefined;
  const search = url.searchParams.get('search') || undefined;
  const category = url.searchParams.get('category') || undefined;
  const status = url.searchParams.get('status') || undefined;
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const limit = parseInt(url.searchParams.get('limit') || '200', 10);

  const where: any = {};
  if (user.role !== 'ADMIN') where.userId = user.id;
  if (accountId) where.OR = [{ fromAccountId: accountId }, { toAccountId: accountId }];
  if (category && category !== 'ALL') where.category = category;
  if (status && status !== 'ALL') where.status = status;
  if (from || to) {
    where.date = {};
    if (from) where.date.gte = new Date(from);
    if (to) where.date.lte = new Date(to);
  }
  if (search) {
    where.OR = [
      ...(where.OR || []),
      { description: { contains: search } },
      { counterparty: { contains: search } },
      { memo: { contains: search } },
    ];
  }

  const transactions = await db.transaction.findMany({
    where,
    include: {
      fromAccount: { select: { id: true, nickname: true, accountNumber: true, userId: true, user: { select: { id: true, name: true, email: true } } } },
      toAccount: { select: { id: true, nickname: true, accountNumber: true, userId: true, user: { select: { id: true, name: true, email: true } } } },
    },
    orderBy: { date: 'desc' },
    take: Math.min(limit, 1000),
  });

  return NextResponse.json({ transactions });
}
