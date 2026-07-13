import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/route-auth';
import { genAccountNumber, ARVEST_ROUTING } from '@/lib/auth';
import { notifyAdmin, notifyCustomer } from '@/lib/notify';

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { type, nickname, initialDeposit } = body as {
      type: string;
      nickname?: string;
      initialDeposit?: number;
    };

    if (!type || !['CHECKING', 'SAVINGS'].includes(type)) {
      return NextResponse.json({ error: 'Please choose Checking or Savings.' }, { status: 400 });
    }

    const deposit = Number(initialDeposit) || 0;
    if (deposit < 0 || deposit > 1_000_000) {
      return NextResponse.json({ error: 'Initial deposit must be between $0 and $1,000,000.' }, { status: 400 });
    }

    const defaultNickname = type === 'CHECKING' ? 'Private Checking' : 'Premier Savings';
    const finalNickname = nickname?.trim() || defaultNickname;

    const accountNumber = genAccountNumber();
    const account = await db.account.create({
      data: {
        userId: user.id,
        type,
        nickname: finalNickname,
        accountNumber,
        routingNumber: ARVEST_ROUTING,
        balance: deposit,
        available: deposit,
        currency: 'USD',
        status: 'ACTIVE',
      },
    });

    if (deposit > 0) {
      await db.transaction.create({
        data: {
          toAccountId: account.id,
          fromAccountId: null,
          userId: user.id,
          amount: deposit,
          description: 'Opening deposit',
          category: 'DEPOSIT',
          status: 'POSTED',
          counterparty: 'Arvest Bank',
          memo: `Initial deposit into ${finalNickname}`,
          date: new Date(),
        },
      });
    }

    await db.auditLog.create({
      data: { userId: user.id, actor: user.email, action: 'ACCOUNT_OPENED', detail: `Opened ${type} account ${finalNickname} (••••${accountNumber.slice(-4)})` },
    });

    await notifyAdmin('ACCOUNT_OPENED', 'New account opened', `${user.name} opened a new ${type} account "${finalNickname}" with an opening deposit of $${deposit.toFixed(2)}.`, user.id);
    await notifyCustomer(user.id, 'ACCOUNT_OPENED', 'Account opened successfully', `Your new ${type} account "${finalNickname}" has been opened. Account number: ••••${accountNumber.slice(-4)}, Routing: ${ARVEST_ROUTING}.`);

    return NextResponse.json({ ok: true, account });
  } catch (e) {
    console.error('Open account error', e);
    return NextResponse.json({ error: 'Server error.' }, { status: 500 });
  }
}
