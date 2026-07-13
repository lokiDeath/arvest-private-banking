import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/route-auth';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;

    const wallet = await db.wallet.findUnique({ where: { id } });
    if (!wallet || (user.role !== 'ADMIN' && wallet.userId !== user.id)) {
      return NextResponse.json({ error: 'Wallet not found.' }, { status: 404 });
    }

    await db.walletTransaction.deleteMany({ where: { walletId: id } });
    await db.wallet.delete({ where: { id } });

    await db.auditLog.create({
      data: { userId: user.id, actor: user.email, action: 'WALLET_DELETED', detail: `${wallet.walletType} wallet ${wallet.address.slice(0, 8)}…` },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Wallet delete error', e);
    return NextResponse.json({ error: 'Server error.' }, { status: 500 });
  }
}
