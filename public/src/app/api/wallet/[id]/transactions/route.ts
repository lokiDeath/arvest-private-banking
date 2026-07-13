import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/route-auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;

    const wallet = await db.wallet.findUnique({ where: { id } });
    if (!wallet || (user.role !== 'ADMIN' && wallet.userId !== user.id)) {
      return NextResponse.json({ error: 'Wallet not found.' }, { status: 404 });
    }

    const transactions = await db.walletTransaction.findMany({
      where: { walletId: id },
      orderBy: { date: 'desc' },
    });

    return NextResponse.json({ wallet, transactions });
  } catch (e) {
    console.error('Wallet transactions error', e);
    return NextResponse.json({ error: 'Server error.' }, { status: 500 });
  }
}
