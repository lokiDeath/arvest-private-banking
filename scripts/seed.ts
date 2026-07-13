// Arvest Private Banking — Database seed (v2)
// - Admin login: LUCIAN1975 / PASSWORD@@1975 (case-sensitive Login ID)
// - Customers get checking + savings + private client accounts + a Visa debit card
// Run: bun run /home/z/my-project/scripts/seed.ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();

const ARVEST_ROUTING = '082900883';

function randAccount(): string {
  let s = '';
  for (let i = 0; i < 10; i++) s += Math.floor(Math.random() * 10).toString();
  return s;
}

function randCardNumber(): string {
  // 16-digit Visa-style number starting with 4
  let s = '4';
  for (let i = 0; i < 15; i++) s += Math.floor(Math.random() * 10).toString();
  return s;
}

function randCvv(): string {
  return Math.floor(100 + Math.random() * 900).toString();
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(randInt(0, 23), randInt(0, 59), randInt(0, 59), 0);
  return d;
}

async function main() {
  console.log('Seeding Arvest Private Banking database (v2)...');

  // Wipe (so re-running is idempotent)
  await db.card.deleteMany();
  await db.transaction.deleteMany();
  await db.billPay.deleteMany();
  await db.account.deleteMany();
  await db.resetCode.deleteMany();
  await db.auditLog.deleteMany();
  await db.user.deleteMany();

  // ---- Admin (LUCIAN1975 / PASSWORD@@1975) ----
  // We store the admin's email as 'LUCIAN1975' (case-preserved) so the lookup API
  // can find them. The login API also hard-codes the admin credentials.
  const adminHash = await bcrypt.hash('PASSWORD@@1975', 10);
  const admin = await db.user.create({
    data: {
      email: 'LUCIAN1975',
      name: 'Lucian (Administrator)',
      passwordHash: adminHash,
      role: 'ADMIN',
      phone: '+1 (479) 555-0100',
      address: '100 Arvest Plaza, Fayetteville, AR 72701',
    },
  });

  // ---- Demo customers ----
  const demoUsers = [
    {
      loginId: 'alexandra.s7281',
      email: 'alexandra.sterling@arvestprivate.com',
      name: 'Alexandra Sterling',
      password: 'Sterling@2026',
      phone: '+1 (479) 555-0142',
      address: '4103 Crimson Ridge Dr, Fayetteville, AR 72703',
      avatar: 'https://i.pravatar.cc/150?img=47',
    },
    {
      loginId: 'james.w4920',
      email: 'james.whitfield@arvestprivate.com',
      name: 'James Whitfield',
      password: 'Whitfield@2026',
      phone: '+1 (918) 555-0177',
      address: '22 Riverfront Terrace, Tulsa, OK 74103',
      avatar: 'https://i.pravatar.cc/150?img=12',
    },
    {
      loginId: 'maria.c8841',
      email: 'maria.castillo@arvestprivate.com',
      name: 'Maria Castillo',
      password: 'Castillo@2026',
      phone: '+1 (816) 555-0119',
      address: '815 Country Club Plaza, Kansas City, MO 64112',
      avatar: 'https://i.pravatar.cc/150?img=32',
    },
    {
      loginId: 'robert.c2273',
      email: 'robert.chen@arvestprivate.com',
      name: 'Robert Chen',
      password: 'Chen@2026',
      phone: '+1 (501) 555-0188',
      address: '210 Capitol Mall, Little Rock, AR 72201',
      avatar: 'https://i.pravatar.cc/150?img=15',
    },
  ];

  for (const u of demoUsers) {
    const hash = await bcrypt.hash(u.password, 10);
    const user = await db.user.create({
      data: {
        email: u.email.toLowerCase(),
        loginId: u.loginId,
        name: u.name,
        passwordHash: hash,
        role: 'CUSTOMER',
        phone: u.phone,
        address: u.address,
        avatarUrl: u.avatar,
      },
    });

    // ---- Accounts ----
    const checking = await db.account.create({
      data: {
        userId: user.id,
        type: 'CHECKING',
        nickname: 'Private Checking',
        accountNumber: randAccount(),
        routingNumber: ARVEST_ROUTING,
        balance: randInt(15000, 85000),
        available: 0,
        currency: 'USD',
        status: 'ACTIVE',
      },
    });

    const savings = await db.account.create({
      data: {
        userId: user.id,
        type: 'SAVINGS',
        nickname: 'Premier Savings',
        accountNumber: randAccount(),
        routingNumber: ARVEST_ROUTING,
        balance: randInt(75000, 350000),
        available: 0,
        currency: 'USD',
        status: 'ACTIVE',
      },
    });

    const privateClient = await db.account.create({
      data: {
        userId: user.id,
        type: 'PRIVATE_CLIENT',
        nickname: 'Private Client Reserve',
        accountNumber: randAccount(),
        routingNumber: ARVEST_ROUTING,
        balance: randInt(250000, 1500000),
        available: 0,
        currency: 'USD',
        status: 'ACTIVE',
      },
    });

    // Set available = balance
    await db.account.update({ where: { id: checking.id }, data: { available: checking.balance } });
    await db.account.update({ where: { id: savings.id }, data: { available: savings.balance } });
    await db.account.update({ where: { id: privateClient.id }, data: { available: privateClient.balance } });

    // ---- Linked Cards ----
    // Primary debit card on checking
    await db.card.create({
      data: {
        userId: user.id,
        accountId: checking.id,
        cardType: 'DEBIT',
        network: 'VISA',
        cardholder: u.name.toUpperCase(),
        cardNumber: randCardNumber(),
        expiryMonth: randInt(1, 12),
        expiryYear: 28 + randInt(0, 4),
        cvv: randCvv(),
        color: 'CRIMSON',
        status: 'ACTIVE',
        pin: '1234',
      },
    });

    // Secondary credit card (Arvest Private Platinum)
    await db.card.create({
      data: {
        userId: user.id,
        accountId: privateClient.id,
        cardType: 'CREDIT',
        network: 'MASTERCARD',
        cardholder: u.name.toUpperCase(),
        cardNumber: '5' + randCardNumber().slice(1), // Mastercard starts with 5
        expiryMonth: randInt(1, 12),
        expiryYear: 28 + randInt(0, 4),
        cvv: randCvv(),
        color: 'PLATINUM',
        status: 'ACTIVE',
        creditLimit: 50000,
        creditUsed: randInt(1000, 15000),
        pin: '5678',
      },
    });

    // ---- Transactions ----
    const merchants = [
      'Whole Foods Market', 'Apple Inc.', 'Shell Gas Station', 'Amazon.com', 'Starbucks',
      'Delta Airlines', 'Neiman Marcus', 'Tiffany & Co.', 'Equinox Fitness', 'Williams Sonoma',
      'Direct Deposit', 'Interest Paid', 'Wire Transfer In', 'ATM Withdrawal', 'Uber',
      'Airbnb', 'Mortgage Payment', 'Utility - Electric', 'Utility - Water', 'Cell Phone Bill',
      'Restoration Hardware', 'Williams Jewelry', 'Polo Ralph Lauren', 'Brooks Brothers',
    ];

    for (let i = 0; i < 60; i++) {
      const acct = [checking, savings, privateClient][randInt(0, 2)];
      const isIncome = Math.random() < 0.25;
      const amount = isIncome ? randInt(250, 8000) + Math.random() : randInt(15, 1200) + Math.random();
      const desc = isIncome
        ? ['Direct Deposit', 'Interest Paid', 'Wire Transfer In', 'Dividend Payment'][randInt(0, 3)]
        : merchants[randInt(0, merchants.length - 1)];
      const cat = isIncome
        ? (desc === 'Interest Paid' ? 'INTEREST' : 'DEPOSIT')
        : (desc.includes('ATM') ? 'WITHDRAWAL' : ['PAYMENT', 'TRANSFER', 'OTHER'][randInt(0, 2)]);

      await db.transaction.create({
        data: {
          fromAccountId: isIncome ? null : acct.id,
          toAccountId: isIncome ? acct.id : null,
          userId: user.id,
          amount: parseFloat(amount.toFixed(2)),
          currency: 'USD',
          description: desc,
          category: cat,
          status: Math.random() < 0.05 ? 'PENDING' : 'POSTED',
          counterparty: isIncome ? 'Arvest Bank' : desc,
          memo: ['Monthly service', 'Online payment', 'Recurring', 'One-time'][randInt(0, 3)],
          date: daysAgo(randInt(0, 90)),
        },
      });
    }
  }

  await db.auditLog.create({
    data: { actor: 'LUCIAN1975', action: 'SYSTEM_SEED', detail: 'Database initialized with admin + 4 demo customers + cards' },
  });

  console.log('✅ Seed (v3) completed.');
  console.log('   Admin Login ID: LUCIAN1975');
  console.log('   Admin Password: PASSWORD@@1975');
  console.log('   Customer logins (Login ID / password):');
  console.log('     alexandra.s7281 / Sterling@2026');
  console.log('     james.w4920 / Whitfield@2026');
  console.log('     maria.c8841 / Castillo@2026');
  console.log('     robert.c2273 / Chen@2026');
  console.log('   (email is separate — used for profile/notifications, not for login)');
}

main()
  .then(() => db.$disconnect())
  .catch((e) => {
    console.error(e);
    db.$disconnect();
    process.exit(1);
  });
