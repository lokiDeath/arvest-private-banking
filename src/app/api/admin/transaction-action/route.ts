import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/route-auth';
import { notifyCustomer } from '@/lib/notify';

// Approve / flag / decline a pending transaction
export async function POST(req: NextRequest) {
  try {
    const admin = await getUserFromRequest(req);
    if (!admin || admin.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { transactionId, action, reason } = body as { transactionId: string; action: 'APPROVE' | 'FLAG' | 'DECLINE' | 'REVERSE'; reason?: string };

    if (!transactionId || !action) return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });

    const tx = await db.transaction.findUnique({
      where: { id: transactionId },
      include: { fromAccount: true, toAccount: true },
    });
    if (!tx) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });

    if (action === 'APPROVE') {
      // NOW move the money — since we no longer move it at submission time,
      // approval is when the actual balance changes happen.
      await db.$transaction(async (txClient) => {
        // Decrement source account
        if (tx.fromAccount) {
          await txClient.account.update({
            where: { id: tx.fromAccount.id },
            data: { balance: { decrement: tx.amount }, available: { decrement: tx.amount } },
          });
        }
        // Increment destination account (for internal transfers)
        if (tx.toAccount) {
          await txClient.account.update({
            where: { id: tx.toAccount.id },
            data: { balance: { increment: tx.amount }, available: { increment: tx.amount } },
          });
        }
        // Mark transaction as posted
        await txClient.transaction.update({ where: { id: transactionId }, data: { status: 'POSTED' } });

        // If this is a bill payment, also mark the bill as PAID
        if (tx.category === 'PAYMENT') {
          await txClient.billPay.updateMany({
            where: { reference: tx.memo || '' },
            data: { status: 'PAID' },
          });
        }
      });

      await db.auditLog.create({ data: { userId: tx.userId || null, actor: admin.email, action: 'TX_APPROVE', detail: `Approved tx ${transactionId}: ${tx.description} ($${tx.amount})` } });

      // Notify the customer their transaction was approved
      if (tx.userId) {
        const customer = await db.user.findUnique({ where: { id: tx.userId }, select: { name: true } });
        const accountName = tx.fromAccount?.nickname || tx.toAccount?.nickname || 'your account';
        await notifyCustomer(tx.userId, 'TX_APPROVE', 'Transaction approved', `Your ${tx.description.toLowerCase()} of $${tx.amount.toFixed(2)} ${tx.toAccount ? `to ${tx.toAccount.nickname}` : ''} has been approved and posted to ${accountName}.`);
      }

      return NextResponse.json({ ok: true, status: 'POSTED' });
    }

    if (action === 'FLAG') {
      await db.transaction.update({ where: { id: transactionId }, data: { status: 'FLAGGED' } });
      await db.auditLog.create({ data: { userId: tx.userId || null, actor: admin.email, action: 'TX_FLAG', detail: `Flagged tx ${transactionId}: ${reason || 'no reason given'}` } });
      return NextResponse.json({ ok: true, status: 'FLAGGED' });
    }

    if (action === 'DECLINE' || action === 'REVERSE') {
      // For DECLINE of a pending transaction: no money was moved, so just change status
      // For REVERSE of a POSTED transaction: money was already moved, so reverse it
      if (tx.status === 'POSTED') {
        // Reverse the balance changes
        await db.$transaction(async (txClient) => {
          if (tx.fromAccount) {
            await txClient.account.update({
              where: { id: tx.fromAccount.id },
              data: { balance: { increment: tx.amount }, available: { increment: tx.amount } },
            });
          }
          if (tx.toAccount) {
            await txClient.account.update({
              where: { id: tx.toAccount.id },
              data: { balance: { decrement: tx.amount }, available: { decrement: tx.amount } },
            });
          }
          await txClient.transaction.update({ where: { id: transactionId }, data: { status: action === 'DECLINE' ? 'DECLINED' : 'REVERSED' } });
        });
      } else {
        // Pending transaction — just change status, no money to reverse
        await db.transaction.update({ where: { id: transactionId }, data: { status: action === 'DECLINE' ? 'DECLINED' : 'REVERSED' } });
      }

      await db.auditLog.create({ data: { userId: tx.userId || null, actor: admin.email, action: `TX_${action}`, detail: `${action} tx ${transactionId}: ${reason || 'no reason given'}` } });

      // Notify the customer their transaction was declined
      if (tx.userId) {
        await notifyCustomer(tx.userId, 'TX_DECLINE', 'Transaction declined', `Your ${tx.description.toLowerCase()} of $${tx.amount.toFixed(2)} was ${action === 'DECLINE' ? 'declined' : 'reversed'} by Arvest Private Banking${reason ? `: ${reason}` : ''}.`);
      }

      return NextResponse.json({ ok: true, status: action === 'DECLINE' ? 'DECLINED' : 'REVERSED' });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
