import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/route-auth';
import { notifyAdmin } from '@/lib/notify';

// GET /api/cards — returns cards for the current customer, or all cards for admin
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const where = user.role === 'ADMIN' ? {} : { userId: user.id };
  const cards = await db.card.findMany({
    where,
    include: {
      account: { select: { id: true, nickname: true, accountNumber: true, type: true } },
      user: { select: { id: true, name: true, email: true, loginId: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json({ cards });
}

// POST /api/cards
// - Admin: issues an Arvest-issued card (issuedBy: ARVEST, no billing address exposed)
// - Customer: adds an external card (issuedBy: EXTERNAL, billing address required)
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const {
    // Shared
    cardType, network, cardholder, cardNumber, expiryMonth, expiryYear, cvv, color, nickname,
    // Admin-issued
    userId, accountId, creditLimit,
    // External card fields
    billingAddress, billingCity, billingState, billingZip, billingCountry,
  } = body as {
    cardType: 'DEBIT' | 'CREDIT'; network: 'VISA' | 'MASTERCARD' | 'AMEX' | 'DISCOVER';
    cardholder: string; cardNumber: string; expiryMonth: number; expiryYear: number; cvv: string;
    color?: string; nickname?: string;
    userId?: string; accountId?: string; creditLimit?: number;
    billingAddress?: string; billingCity?: string; billingState?: string; billingZip?: string; billingCountry?: string;
  };

  if (!cardType || !network || !cardholder || !cardNumber || !cvv || !expiryMonth || !expiryYear) {
    return NextResponse.json({ error: 'Missing required card fields' }, { status: 400 });
  }
  if (cardNumber.length < 13 || cardNumber.length > 19) {
    return NextResponse.json({ error: 'Invalid card number' }, { status: 400 });
  }

  // Check uniqueness
  const existing = await db.card.findUnique({ where: { cardNumber } });
  if (existing) return NextResponse.json({ error: 'This card is already linked.' }, { status: 400 });

  if (user.role === 'ADMIN') {
    // Admin issuing Arvest card
    if (!userId) return NextResponse.json({ error: 'userId required for admin card issuance' }, { status: 400 });
    const targetUser = await db.user.findUnique({ where: { id: userId } });
    if (!targetUser) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

    const card = await db.card.create({
      data: {
        userId,
        accountId: accountId || null,
        issuedBy: 'ARVEST',
        cardType, network, cardholder,
        cardNumber, cvv, expiryMonth, expiryYear,
        color: color || 'CRIMSON',
        status: 'ACTIVE',
        creditLimit: cardType === 'CREDIT' ? (creditLimit || 25000) : 0,
        creditUsed: 0,
        pin: '1234',
        // No billing address stored for Arvest-issued cards
      },
    });

    await db.auditLog.create({
      data: { userId, actor: user.email, action: 'CARD_ISSUED', detail: `Issued ${network} ${cardType} card to ${cardholder}` },
    });

    return NextResponse.json({ ok: true, card });
  }

  // Customer adding external card
  if (!billingAddress || !billingCity || !billingState || !billingZip) {
    return NextResponse.json({ error: 'Billing address is required for external cards' }, { status: 400 });
  }

  // SERVER-SIDE auto-detection of card network from the card number.
  // This is the source of truth — regardless of what the client sent,
  // the network is determined by the BIN (first digits) of the card number.
  const cleanNum = cardNumber.replace(/\s/g, '');
  let detectedNetwork: string = network;
  if (cleanNum.startsWith('4')) detectedNetwork = 'VISA';
  else if (/^5[1-5]/.test(cleanNum) || /^2(2[2-9]|[3-6][0-9]|7[0-1]|720)/.test(cleanNum)) detectedNetwork = 'MASTERCARD';
  else if (cleanNum.startsWith('34') || cleanNum.startsWith('37')) detectedNetwork = 'AMEX';
  else if (cleanNum.startsWith('6011') || cleanNum.startsWith('65') || /^64[4-9]/.test(cleanNum)) detectedNetwork = 'DISCOVER';
  // If no match, keep the client-provided network as fallback

  const card = await db.card.create({
    data: {
      userId: user.id,
      accountId: null,
      issuedBy: 'EXTERNAL',
      cardType, network: detectedNetwork, cardholder,
      cardNumber, cvv, expiryMonth, expiryYear,
      color: color || 'OBSIDIAN',
      status: 'ACTIVE',
      nickname: nickname || `${detectedNetwork} ${cardType}`.toLowerCase(),
      billingAddress, billingCity, billingState, billingZip,
      billingCountry: billingCountry || 'USA',
    },
  });

  await db.auditLog.create({
    data: { userId: user.id, actor: user.email, action: 'CARD_ADDED_EXTERNAL', detail: `Added external ${detectedNetwork} card ending ${cardNumber.slice(-4)}` },
  });

  await notifyAdmin('CARD_ADDED', 'External card added', `${user.name} added an external ${detectedNetwork} ${cardType} card ending in ${cardNumber.slice(-4)} (${billingCity}, ${billingState}).`, user.id);

  return NextResponse.json({ ok: true, card });
}
