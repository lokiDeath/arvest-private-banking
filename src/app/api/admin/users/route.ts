import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, genAccountNumber, ARVEST_ROUTING } from '@/lib/auth';
import { getUserFromRequest } from '@/lib/route-auth';

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const users = await db.user.findMany({
    where: { role: 'CUSTOMER' },
    select: {
      id: true, email: true, loginId: true, name: true, role: true, phone: true, address: true, avatarUrl: true, createdAt: true,
      accounts: { select: { id: true, type: true, nickname: true, balance: true, accountNumber: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Add summary stats per user
  const enriched = await Promise.all(users.map(async (u) => {
    const totalBalance = u.accounts.reduce((s, a) => s + a.balance, 0);
    const txCount = await db.transaction.count({ where: { userId: u.id } });
    return { ...u, totalBalance, accountCount: u.accounts.length, transactionCount: txCount };
  }));

  return NextResponse.json({ users: enriched });
}

export async function POST(req: NextRequest) {
  try {
    const admin = await getUserFromRequest(req);
    if (!admin || admin.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { action } = body as { action: 'CREATE' | 'UPDATE' | 'DELETE' | 'RESET_PASSWORD' };

    if (action === 'CREATE') {
      const { name, email, loginId, password, phone, address, avatarUrl, initialDeposit, accountTypes, issueCard } = body as {
        name: string; email: string; loginId?: string; password: string; phone?: string; address?: string; avatarUrl?: string;
        initialDeposit?: number; accountTypes?: string[]; issueCard?: boolean;
      };
      if (!name || !email || !password) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
      if (password.length < 8) return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
      const exists = await db.user.findUnique({ where: { email: email.toLowerCase() } });
      if (exists) return NextResponse.json({ error: 'Email already in use.' }, { status: 400 });

      // Auto-generate a loginId from email if not provided
      const finalLoginId = loginId?.trim() || email.toLowerCase().split('@')[0] + Math.floor(1000 + Math.random() * 9000);
      const loginExists = await db.user.findFirst({ where: { loginId: finalLoginId.toLowerCase() } });
      if (loginExists) return NextResponse.json({ error: 'Login ID already in use. Try another.' }, { status: 400 });

      const hash = await hashPassword(password);
      const newUser = await db.user.create({
        data: {
          name, email: email.toLowerCase(), loginId: finalLoginId.toLowerCase(), passwordHash: hash, role: 'CUSTOMER',
          phone, address, avatarUrl,
        },
      });

      // Default to Checking + Savings + Private Client Reserve unless specified
      const types = accountTypes && accountTypes.length > 0
        ? accountTypes
        : ['CHECKING', 'SAVINGS', 'PRIVATE_CLIENT'];

      const typeLabels: Record<string, string> = {
        CHECKING: 'Private Checking',
        SAVINGS: 'Premier Savings',
        PRIVATE_CLIENT: 'Private Client Reserve',
      };

      const bal = Number(initialDeposit) || 0;
      // Distribute opening deposit across accounts (first account gets it all if only one)
      const openingPerAccount = types.length === 1 ? bal : Math.floor(bal / types.length);

      let firstAccount: any = null;
      for (const t of types) {
        const acct = await db.account.create({
          data: {
            userId: newUser.id,
            type: t,
            nickname: typeLabels[t] || t,
            accountNumber: genAccountNumber(),
            routingNumber: ARVEST_ROUTING,
            balance: 0,
            available: 0,
            currency: 'USD',
            status: 'ACTIVE',
          },
        });
        if (!firstAccount) firstAccount = acct;
        if (openingPerAccount > 0) {
          await db.account.update({
            where: { id: acct.id },
            data: { balance: openingPerAccount, available: openingPerAccount },
          });
          await db.transaction.create({
            data: {
              toAccountId: acct.id, fromAccountId: null, userId: newUser.id,
              amount: openingPerAccount, description: 'Opening deposit', category: 'DEPOSIT',
              status: 'POSTED', counterparty: 'Arvest Bank', memo: `Initial deposit into ${typeLabels[t]}`, date: new Date(),
            },
          });
        }
      }

      // Issue a default Visa debit card linked to first (checking) account
      if (issueCard !== false && firstAccount) {
        const cardNumber = '4' + Array.from({ length: 15 }, () => Math.floor(Math.random() * 10)).join('');
        const cvv = Math.floor(100 + Math.random() * 900).toString();
        await db.card.create({
          data: {
            userId: newUser.id,
            accountId: firstAccount.id,
            cardType: 'DEBIT',
            network: 'VISA',
            cardholder: name.toUpperCase(),
            cardNumber,
            cvv,
            expiryMonth: Math.floor(Math.random() * 12) + 1,
            expiryYear: 28 + Math.floor(Math.random() * 5),
            color: 'CRIMSON',
            status: 'ACTIVE',
            pin: '1234',
          },
        });
      }

      await db.auditLog.create({
        data: { userId: newUser.id, actor: admin.email, action: 'USER_CREATE', detail: `Created customer ${newUser.email} with ${types.length} account(s)` },
      });
      return NextResponse.json({ ok: true, userId: newUser.id });
    }

    if (action === 'UPDATE') {
      const { id, name, email, loginId, phone, address, avatarUrl } = body as any;
      if (!id) return NextResponse.json({ error: 'User id required' }, { status: 400 });

      // Build update data — only include fields that are provided
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (phone !== undefined) updateData.phone = phone;
      if (address !== undefined) updateData.address = address;
      if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;

      // Email uniqueness check (if changing)
      if (email !== undefined && email !== '') {
        const existing = await db.user.findFirst({ where: { email: email.toLowerCase(), NOT: { id } } });
        if (existing) return NextResponse.json({ error: 'Email already in use by another customer.' }, { status: 400 });
        updateData.email = email.toLowerCase();
      }

      // Login ID uniqueness check (if changing)
      if (loginId !== undefined && loginId !== '') {
        const existingLogin = await db.user.findFirst({ where: { loginId: loginId.toLowerCase(), NOT: { id } } });
        if (existingLogin) return NextResponse.json({ error: 'Login ID already in use by another customer.' }, { status: 400 });
        updateData.loginId = loginId.toLowerCase();
      }

      await db.user.update({ where: { id }, data: updateData });
      await db.auditLog.create({ data: { userId: id, actor: admin.email, action: 'USER_UPDATE', detail: `Admin updated customer profile (fields: ${Object.keys(updateData).join(', ')})` } });
      return NextResponse.json({ ok: true });
    }

    if (action === 'DELETE') {
      const { id } = body as any;
      if (!id) return NextResponse.json({ error: 'User id required' }, { status: 400 });
      await db.user.delete({ where: { id } });
      await db.auditLog.create({ data: { actor: admin.email, action: 'USER_DELETE', detail: `Deleted user ${id}` } });
      return NextResponse.json({ ok: true });
    }

    if (action === 'RESET_PASSWORD') {
      const { id, newPassword } = body as any;
      if (!id || !newPassword) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
      if (newPassword.length < 8) return NextResponse.json({ error: 'Password must be ≥ 8 chars.' }, { status: 400 });
      const hash = await hashPassword(newPassword);
      const target = await db.user.update({ where: { id }, data: { passwordHash: hash } });
      await db.auditLog.create({ data: { userId: id, actor: admin.email, action: 'ADMIN_PASSWORD_RESET', detail: `Admin reset password for ${target.email}` } });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    console.error('Admin users error', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
