import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/route-auth';
import { notifyAdmin, notifyCustomer } from '@/lib/notify';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { walletId, toAddress, amount, memo } = body as {
      walletId: string;
      toAddress: string;
      amount: number;
      memo?: string;
    };

    if (!walletId || !toAddress || !amount || amount <= 0) {
      return NextResponse.json({ error: 'Wallet, recipient address, and valid amount are required.' }, { status: 400 });
    }

    const wallet = await db.wallet.findUnique({ where: { id: walletId } });
    if (!wallet || (user.role !== 'ADMIN' && wallet.userId !== user.id)) {
      return NextResponse.json({ error: 'Wallet not found.' }, { status: 404 });
    }
    if (wallet.balance < amount) {
      return NextResponse.json({ error: 'Insufficient wallet balance.' }, { status: 400 });
    }
    if (toAddress === wallet.address) {
      return NextResponse.json({ error: 'Cannot send to the same address.' }, { status: 400 });
    }

    const txHash = '0x' + crypto.randomBytes(32).toString('hex');

    // Create PENDING wallet transaction (will be confirmed by admin/fraud review)
    const tx = await db.walletTransaction.create({
      data: {
        walletId,
        type: 'SEND',
        amount,
        currency: wallet.walletType,
        toAddress,
        fromAddress: wallet.address,
        status: 'PENDING',
        txHash,
        memo: memo || `Send ${amount} ${wallet.walletType}`,
        date: new Date(),
      },
    });

    await db.auditLog.create({
      data: { userId: user.id, actor: user.email, action: 'WALLET_SEND', detail: `${amount} ${wallet.walletType} from ${wallet.address.slice(0, 8)}… to ${toAddress.slice(0, 8)}… (PENDING)` },
    });

    await notifyAdmin('WALLET', 'Crypto send pending review', `${user.name} initiated a ${wallet.walletType} send of ${amount} from ${wallet.address.slice(0, 12)}… to ${toAddress.slice(0, 12)}…. Awaiting review.`, user.id);
    await notifyCustomer(user.id, 'WALLET', 'Crypto send submitted', `Your send of ${amount} ${wallet.walletType} has been submitted and is pending review. Tx hash: ${txHash.slice(0, 18)}…`);

    return NextResponse.json({ ok: true, tx });
  } catch (e) {
    console.error('Wallet send error', e);
    return NextResponse.json({ error: 'Server error.' }, { status: 500 });
  }
}
