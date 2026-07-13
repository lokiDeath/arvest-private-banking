import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/route-auth';

// POST /api/admin/transactions
// Admin-only: edit or delete any transaction
export async function POST(req: NextRequest) {
  const admin = await getUserFromRequest(req);
  if (!admin || admin.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const { action, transactionId } = body as { action: 'UPDATE' | 'DELETE'; transactionId: string };

  if (!action || !transactionId) return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });

  const tx = await db.transaction.findUnique({ where: { id: transactionId } });
  if (!tx) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });

  if (action === 'DELETE') {
    await db.transaction.delete({ where: { id: transactionId } });
    await db.auditLog.create({
      data: { userId: tx.userId || null, actor: admin.email, action: 'ADMIN_TX_DELETE', detail: `Deleted transaction: ${tx.description} ($${tx.amount})` },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === 'UPDATE') {
    const { amount, description, counterparty, category, status, memo, date } = body as any;
    const data: any = {};
    if (amount !== undefined) data.amount = parseFloat(amount);
    if (description !== undefined) data.description = description;
    if (counterparty !== undefined) data.counterparty = counterparty;
    if (category !== undefined) data.category = category;
    if (status !== undefined) data.status = status;
    if (memo !== undefined) data.memo = memo;
    if (date !== undefined) data.date = new Date(date);

    const updated = await db.transaction.update({ where: { id: transactionId }, data });
    await db.auditLog.create({
      data: { userId: tx.userId || null, actor: admin.email, action: 'ADMIN_TX_UPDATE', detail: `Edited transaction ${transactionId}` },
    });
    return NextResponse.json({ ok: true, transaction: updated });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
