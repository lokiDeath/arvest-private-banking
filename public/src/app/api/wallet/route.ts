import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/route-auth';
import crypto from 'crypto';

function genAddress(prefix: string): string {
  const bytes = crypto.randomBytes(20).toString('hex');
  if (prefix === 'bc1') return `bc1q${bytes.slice(0, 38)}`;
  if (prefix === '0x') return `0x${bytes}`;
  if (prefix === 'T') return `T${bytes.slice(0, 33).toUpperCase()}`;
  return bytes;
}

function genPrivateKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

function detectWalletType(address: string): string | null {
  if (address.startsWith('bc1')) return 'BTC';
  if (address.startsWith('0x') && address.length === 42) return 'ETH';
  if (address.startsWith('T') && address.length === 34) return 'USDT';
  return null;
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const where = user.role === 'ADMIN' ? {} : { userId: user.id };
  const wallets = await db.wallet.findMany({
    where,
    include: user.role === 'ADMIN' ? { user: { select: { id: true, name: true, email: true } } } : false,
    orderBy: { createdAt: 'desc' },
  });
  // Mask private keys for list view
  const masked = wallets.map((w) => ({ ...w, privateKey: '••••••••' + w.privateKey.slice(-6) }));
  return NextResponse.json({ wallets: masked });
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { walletType, label, importAddress } = body as {
      walletType?: string;
      label?: string;
      importAddress?: string;
    };

    let finalType: string;
    let address: string;
    let privateKey: string;

    if (importAddress) {
      // External wallet import — auto-detect chain
      const detected = detectWalletType(importAddress);
      if (!detected) {
        return NextResponse.json({ error: 'Could not detect wallet type from address. Supported: BTC (bc1...), ETH (0x...), USDT TRC20 (T...).', status: 400 }, { status: 400 });
      }
      finalType = detected;
      address = importAddress;
      privateKey = 'EXTERNAL_WALLET_NO_KEY';
    } else {
      if (!walletType || !['BTC', 'ETH', 'USDT', 'USD'].includes(walletType)) {
        return NextResponse.json({ error: 'Invalid wallet type.' }, { status: 400 });
      }
      finalType = walletType;
      if (walletType === 'USD') {
        // USD "wallet" — stablecoin-like, internal
        address = `USD-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
        privateKey = 'USD_RESERVE';
      } else if (walletType === 'BTC') {
        address = genAddress('bc1');
        privateKey = genPrivateKey();
      } else if (walletType === 'ETH') {
        address = genAddress('0x');
        privateKey = genPrivateKey();
      } else {
        // USDT TRC20
        address = genAddress('T');
        privateKey = genPrivateKey();
      }
    }

    // Ensure address uniqueness
    const existing = await db.wallet.findUnique({ where: { address } });
    if (existing) {
      return NextResponse.json({ error: 'Wallet with this address already exists.' }, { status: 400 });
    }

    const wallet = await db.wallet.create({
      data: {
        userId: user.id,
        walletType: finalType,
        address,
        privateKey,
        balance: 0,
        label: label || `${finalType} Wallet`,
      },
    });

    await db.auditLog.create({
      data: { userId: user.id, actor: user.email, action: 'WALLET_CREATED', detail: `${finalType} wallet ${address.slice(0, 8)}…` },
    });

    // Return FULL private key ONCE so user can save it
    return NextResponse.json({ ok: true, wallet, privateKeyRevealed: privateKey });
  } catch (e) {
    console.error('Wallet create error', e);
    return NextResponse.json({ error: 'Server error.' }, { status: 500 });
  }
}
