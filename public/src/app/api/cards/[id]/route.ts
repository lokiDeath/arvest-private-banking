import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/route-auth';

// PATCH /api/cards/[id] — update card status (freeze/unfreeze/close) or other fields (admin only for full edit)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const card = await db.card.findUnique({ where: { id } });
  if (!card) return NextResponse.json({ error: 'Card not found' }, { status: 404 });

  // Customer can only freeze/unfreeze their own card
  if (user.role !== 'ADMIN' && card.userId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { status, color, pin, creditLimit, cardholder, expiryMonth, expiryYear } = body as any;

  const data: any = {};
  // Customer can only change status (freeze/unfreeze)
  if (status !== undefined) data.status = status;
  // Admin can change everything
  if (user.role === 'ADMIN') {
    if (color !== undefined) data.color = color;
    if (pin !== undefined) data.pin = pin;
    if (creditLimit !== undefined) data.creditLimit = creditLimit;
    if (cardholder !== undefined) data.cardholder = cardholder;
    if (expiryMonth !== undefined) data.expiryMonth = expiryMonth;
    if (expiryYear !== undefined) data.expiryYear = expiryYear;
  }

  const updated = await db.card.update({ where: { id }, data });

  if (user.role === 'ADMIN') {
    await db.auditLog.create({
      data: { userId: card.userId, actor: user.email, action: 'CARD_UPDATE', detail: `Updated card ••••${card.cardNumber.slice(-4)}` },
    });
  }

  return NextResponse.json({ ok: true, card: updated });
}

// DELETE /api/cards/[id] — admin only
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getUserFromRequest(req);
  if (!admin || admin.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const card = await db.card.findUnique({ where: { id } });
  if (!card) return NextResponse.json({ error: 'Card not found' }, { status: 404 });

  await db.card.delete({ where: { id } });
  await db.auditLog.create({
    data: { userId: card.userId, actor: admin.email, action: 'CARD_DELETED', detail: `Closed card ••••${card.cardNumber.slice(-4)}` },
  });

  return NextResponse.json({ ok: true });
}
