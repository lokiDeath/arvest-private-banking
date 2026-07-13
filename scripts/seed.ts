// Arvest Private Banking — Database seed v5
// Creates admin + demo customers + Christopher with 2 YEARS of realistic transactions
// Christopher total balance: $80,000
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();
const ARVEST_ROUTING = '082900883';

function randAccount(): string {
  let s = '';
  for (let i = 0; i < 10; i++) s += Math.floor(Math.random() * 10).toString();
  return s;
}
function randCard(): string {
  let s = '4';
  for (let i = 0; i < 15; i++) s += Math.floor(Math.random() * 10).toString();
  return s;
}
function randCvv(): string { return Math.floor(100 + Math.random() * 900).toString(); }
function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(randInt(0, 23), randInt(0, 59), randInt(0, 59), 0);
  return d;
}

async function main() {
  console.log('Seeding Arvest Private Banking database (v5)...');

  // Wipe
  await db.walletTransaction.deleteMany();
  await db.wallet.deleteMany();
  await db.zelleTransfer.deleteMany();
  await db.checkDeposit.deleteMany();
  await db.alert.deleteMany();
  await db.appointment.deleteMany();
  await db.message.deleteMany();
  await db.loan.deleteMany();
  await db.notification.deleteMany();
  await db.auditLog.deleteMany();
  await db.billPay.deleteMany();
  await db.transaction.deleteMany();
  await db.card.deleteMany();
  await db.account.deleteMany();
  await db.resetCode.deleteMany();
  await db.user.deleteMany();

  // ---- Admin ----
  const adminHash = await bcrypt.hash('PASSWORD@@1975', 10);
  await db.user.create({
    data: {
      email: 'LUCIAN1975', name: 'Bank Administrator', passwordHash: adminHash,
      role: 'ADMIN', phone: '+1 (479) 555-0100', address: 'Arvest Private Banking HQ',
    },
  });

  // ---- Christopher Larosa (2-year-old account, $80,000 total) ----
  const chrisHash = await bcrypt.hash('1975@1975', 10);
  const chris = await db.user.create({
    data: {
      email: 'christopher.larosa@arvestprivate.com',
      loginId: 'christopher111',
      name: 'Christopher Larosa',
      passwordHash: chrisHash,
      role: 'CUSTOMER',
      phone: '+1 (615) 659 1539',
      address: '301 Commerce St, Nashville, TN 37201',
      avatarUrl: 'https://i.pravatar.cc/150?img=68',
      createdAt: new Date('2024-01-15'), // Account opened ~2 years ago
    },
  });

  // Christopher's accounts (total = $80,000)
  // Checking: $25,000 | Savings: $30,000 | Private Client Reserve: $25,000
  const chrisChecking = await db.account.create({
    data: {
      userId: chris.id, type: 'CHECKING', nickname: 'Everyday Checking',
      accountNumber: randAccount(), routingNumber: ARVEST_ROUTING,
      balance: 25000, available: 25000, currency: 'USD', status: 'ACTIVE',
      createdAt: new Date('2024-01-15'),
    },
  });
  const chrisSavings = await db.account.create({
    data: {
      userId: chris.id, type: 'SAVINGS', nickname: 'Premier Savings',
      accountNumber: randAccount(), routingNumber: ARVEST_ROUTING,
      balance: 30000, available: 30000, currency: 'USD', status: 'ACTIVE',
      createdAt: new Date('2024-01-15'),
    },
  });
  const chrisReserve = await db.account.create({
    data: {
      userId: chris.id, type: 'PRIVATE_CLIENT', nickname: 'Private Client Reserve',
      accountNumber: randAccount(), routingNumber: ARVEST_ROUTING,
      balance: 25000, available: 25000, currency: 'USD', status: 'ACTIVE',
      createdAt: new Date('2024-01-15'),
    },
  });

  // Christopher's debit card
  await db.card.create({
    data: {
      userId: chris.id, accountId: chrisChecking.id, issuedBy: 'ARVEST',
      cardType: 'DEBIT', network: 'VISA', cardholder: 'CHRISTOPHER LAROSA',
      cardNumber: '4716420038194657', cvv: '317', expiryMonth: 10, expiryYear: 29,
      color: 'CRIMSON', status: 'ACTIVE', pin: '1975',
      createdAt: new Date('2024-01-15'),
    },
  });

  // Christopher's credit card
  await db.card.create({
    data: {
      userId: chris.id, accountId: chrisReserve.id, issuedBy: 'ARVEST',
      cardType: 'CREDIT', network: 'MASTERCARD', cardholder: 'CHRISTOPHER LAROSA',
      cardNumber: '5412837465019283', cvv: '829', expiryMonth: 7, expiryYear: 28,
      color: 'PLATINUM', status: 'ACTIVE', pin: '5678',
      creditLimit: 50000, creditUsed: 8450,
      createdAt: new Date('2024-01-15'),
    },
  });

  // ===== 2 YEARS OF REALISTIC TRANSACTIONS FOR CHRISTOPHER =====
  // Mix of: payroll deposits, ATM withdrawals, shopping, bills, transfers, interest, dining, gas, travel
  const merchants = [
    { name: 'Whole Foods Market', cat: 'PAYMENT', amt: [35, 180] },
    { name: 'Amazon.com', cat: 'PAYMENT', amt: [15, 350] },
    { name: 'Shell Gas Station', cat: 'PAYMENT', amt: [40, 75] },
    { name: 'Starbucks', cat: 'PAYMENT', amt: [5, 18] },
    { name: 'Target', cat: 'PAYMENT', amt: [25, 200] },
    { name: 'Apple Store', cat: 'PAYMENT', amt: [50, 1200] },
    { name: 'Delta Airlines', cat: 'PAYMENT', amt: [250, 850] },
    { name: 'ATM Withdrawal', cat: 'WITHDRAWAL', amt: [100, 400] },
    { name: 'Neiman Marcus', cat: 'PAYMENT', amt: [100, 800] },
    { name: 'Equinox Fitness', cat: 'PAYMENT', amt: [85, 185] },
    { name: 'Williams Sonoma', cat: 'PAYMENT', amt: [30, 250] },
    { name: 'Tiffany & Co.', cat: 'PAYMENT', amt: [200, 2000] },
    { name: 'Restoration Hardware', cat: 'PAYMENT', amt: [150, 1500] },
    { name: 'Uber', cat: 'PAYMENT', amt: [12, 65] },
    { name: 'Comcast Internet', cat: 'PAYMENT', amt: [89, 120] },
    { name: 'Nashville Electric', cat: 'PAYMENT', amt: [120, 280] },
    { name: 'Metro Water Services', cat: 'PAYMENT', amt: [45, 95] },
    { name: 'Verizon Wireless', cat: 'PAYMENT', amt: [75, 130] },
    { name: 'State Farm Insurance', cat: 'PAYMENT', amt: [180, 320] },
    { name: 'Mortgage Payment', cat: 'PAYMENT', amt: [1850, 1850] },
  ];

  const incomeSources = [
    { name: 'Direct Deposit - TechCorp Inc', cat: 'DEPOSIT', amt: [4200, 4800] },
    { name: 'Wire Transfer In', cat: 'DEPOSIT', amt: [500, 5000] },
    { name: 'Interest Paid', cat: 'INTEREST', amt: [12, 85] },
    { name: 'Dividend Payment', cat: 'DEPOSIT', amt: [150, 600] },
    { name: 'Tax Refund', cat: 'DEPOSIT', amt: [800, 2400] },
  ];

  // Generate ~250 transactions spread over 2 years (roughly 2-3 per week)
  let txCount = 0;
  for (let weekOffset = 0; weekOffset < 104; weekOffset++) {
    // 1-3 transactions per week
    const numTx = randInt(1, 3);
    for (let t = 0; t < numTx; t++) {
      const dayInWeek = randInt(0, 6);
      const daysBack = weekOffset * 7 + dayInWeek;
      const date = daysAgo(daysBack);

      // 70% expense, 30% income
      if (Math.random() < 0.7) {
        const merchant = merchants[randInt(0, merchants.length - 1)];
        const amount = randInt(merchant.amt[0], merchant.amt[1]) + Math.random();
        const acct = [chrisChecking, chrisChecking, chrisChecking, chrisSavings][randInt(0, 3)]; // mostly checking

        await db.transaction.create({
          data: {
            fromAccountId: acct.id, toAccountId: null, userId: chris.id,
            amount: parseFloat(amount.toFixed(2)),
            description: merchant.name,
            category: merchant.cat,
            status: 'POSTED',
            counterparty: merchant.name,
            memo: ['Monthly service', 'Online payment', 'Recurring', 'One-time', 'Auto-pay'][randInt(0, 4)],
            date,
          },
        });
      } else {
        const income = incomeSources[randInt(0, incomeSources.length - 1)];
        const amount = randInt(income.amt[0], income.amt[1]) + Math.random();
        const acct = income.name.includes('Interest') ? chrisSavings : chrisChecking;

        await db.transaction.create({
          data: {
            fromAccountId: null, toAccountId: acct.id, userId: chris.id,
            amount: parseFloat(amount.toFixed(2)),
            description: income.name,
            category: income.cat,
            status: 'POSTED',
            counterparty: 'Arvest Bank',
            memo: income.name.includes('Direct') ? 'Bi-weekly payroll' : 'Bank transfer',
            date,
          },
        });
      }
      txCount++;
    }
  }

  // Add some internal transfers between accounts
  for (let i = 0; i < 15; i++) {
    const daysBack = randInt(7, 700);
    const amount = randInt(200, 3000) + Math.random();
    const fromAcct = [chrisChecking, chrisSavings, chrisReserve][randInt(0, 2)];
    let toAcct = [chrisChecking, chrisSavings, chrisReserve][randInt(0, 2)];
    while (toAcct.id === fromAcct.id) toAcct = [chrisChecking, chrisSavings, chrisReserve][randInt(0, 2)];

    await db.transaction.create({
      data: {
        fromAccountId: fromAcct.id, toAccountId: toAcct.id, userId: chris.id,
        amount: parseFloat(amount.toFixed(2)),
        description: `Transfer to ${toAcct.nickname}`,
        category: 'TRANSFER', status: 'POSTED',
        counterparty: toAcct.nickname, memo: 'Internal transfer',
        date: daysAgo(daysBack),
      },
    });
    txCount++;
  }

  // Add a few pending transactions
  await db.transaction.create({
    data: {
      fromAccountId: chrisChecking.id, toAccountId: null, userId: chris.id,
      amount: 450.00, description: 'Zelle to Sarah Johnson',
      category: 'PAYMENT', status: 'PENDING',
      counterparty: 'Sarah Johnson', memo: 'Dinner split', date: new Date(),
    },
  });
  await db.transaction.create({
    data: {
      fromAccountId: chrisChecking.id, toAccountId: null, userId: chris.id,
      amount: 1200.00, description: 'Bill payment - State Farm Insurance',
      category: 'PAYMENT', status: 'PENDING',
      counterparty: 'State Farm Insurance', memo: 'Monthly auto insurance', date: new Date(),
    },
  });

  // ===== NOTIFICATIONS for Christopher (past + recent) =====
  const notifTypes = [
    { type: 'DEPOSIT', title: 'Direct deposit received', body: 'Direct Deposit - TechCorp Inc of $4,521.50 was deposited to your Everyday Checking.' },
    { type: 'TRANSFER', title: 'Transfer completed', body: 'Your transfer of $1,500.00 from Everyday Checking to Premier Savings has been completed.' },
    { type: 'BILL_PAY', title: 'Payment completed', body: 'Your payment of $89.00 to Comcast Internet has been completed.' },
    { type: 'BALANCE_CHANGE', title: 'Account balance updated', body: 'Your Premier Savings balance was updated by Arvest Private Banking.' },
    { type: 'INTEREST', title: 'Interest paid', body: 'Interest of $42.18 was credited to your Premier Savings account.' },
    { type: 'TX_APPROVE', title: 'Transaction approved', body: 'Your transfer of $500.00 has been approved and posted to your account.' },
    { type: 'DEPOSIT', title: 'Wire transfer received', body: 'Wire Transfer In of $2,500.00 was deposited to your Everyday Checking.' },
    { type: 'CARD_ADDED', title: 'Card activity', body: 'A purchase of $127.45 was made at Whole Foods Market using your Visa debit card.' },
    { type: 'BALANCE_CHANGE', title: 'Large withdrawal posted', body: 'ATM Withdrawal of $300.00 was posted from your Everyday Checking.' },
    { type: 'TRANSFER', title: 'Transfer submitted', body: 'Your transfer of $750.00 to Private Client Reserve is pending admin approval.' },
  ];

  for (let i = 0; i < notifTypes.length; i++) {
    const n = notifTypes[i];
    const daysBack = randInt(1, 60);
    await db.notification.create({
      data: {
        recipientId: chris.id, userId: chris.id,
        type: n.type, title: n.title, body: n.body,
        read: i > 5, // first 5 are unread
        createdAt: daysAgo(daysBack),
      },
    });
  }

  // ===== Admin notifications =====
  await db.notification.create({
    data: { recipientRole: 'ADMIN', type: 'LOGIN', title: 'Customer signed in', body: 'Christopher Larosa (christopher111) signed in to private banking.', createdAt: daysAgo(1) },
  });
  await db.notification.create({
    data: { recipientRole: 'ADMIN', type: 'TRANSFER', title: 'Transfer pending approval', body: 'Christopher Larosa submitted a transfer of $750.00. Awaiting approval.', createdAt: daysAgo(1) },
  });

  // ===== Other demo customers (simpler) =====
  const demoUsers = [
    { loginId: 'alexandra.s7281', email: 'alexandra.sterling@arvestprivate.com', name: 'Alexandra Sterling', password: 'Sterling@2026', avatar: 'https://i.pravatar.cc/150?img=47' },
    { loginId: 'james.w4920', email: 'james.whitfield@arvestprivate.com', name: 'James Whitfield', password: 'Whitfield@2026', avatar: 'https://i.pravatar.cc/150?img=12' },
    { loginId: 'maria.c8841', email: 'maria.castillo@arvestprivate.com', name: 'Maria Castillo', password: 'Castillo@2026', avatar: 'https://i.pravatar.cc/150?img=32' },
  ];

  for (const u of demoUsers) {
    const hash = await bcrypt.hash(u.password, 10);
    const user = await db.user.create({
      data: { email: u.email, loginId: u.loginId, name: u.name, passwordHash: hash, role: 'CUSTOMER', avatarUrl: u.avatar },
    });
    const checking = await db.account.create({
      data: { userId: user.id, type: 'CHECKING', nickname: 'Private Checking', accountNumber: randAccount(), routingNumber: ARVEST_ROUTING, balance: randInt(15000, 85000), available: 0, currency: 'USD', status: 'ACTIVE' },
    });
    const savings = await db.account.create({
      data: { userId: user.id, type: 'SAVINGS', nickname: 'Premier Savings', accountNumber: randAccount(), routingNumber: ARVEST_ROUTING, balance: randInt(75000, 350000), available: 0, currency: 'USD', status: 'ACTIVE' },
    });
    await db.account.update({ where: { id: checking.id }, data: { available: checking.balance } });
    await db.account.update({ where: { id: savings.id }, data: { available: savings.balance } });

    // Simple transactions
    for (let i = 0; i < 40; i++) {
      const isIncome = Math.random() < 0.25;
      const amount = isIncome ? randInt(500, 5000) + Math.random() : randInt(15, 800) + Math.random();
      const acct = [checking, savings][randInt(0, 1)];
      await db.transaction.create({
        data: {
          fromAccountId: isIncome ? null : acct.id, toAccountId: isIncome ? acct.id : null,
          userId: user.id, amount: parseFloat(amount.toFixed(2)),
          description: isIncome ? ['Direct Deposit', 'Interest Paid', 'Wire Transfer In'][randInt(0, 2)] : merchants[randInt(0, merchants.length - 1)].name,
          category: isIncome ? 'DEPOSIT' : 'PAYMENT', status: 'POSTED',
          counterparty: isIncome ? 'Arvest Bank' : 'Merchant',
          date: daysAgo(randInt(0, 90)),
        },
      });
    }
  }

  await db.auditLog.create({
    data: { actor: 'LUCIAN1975', action: 'SYSTEM_SEED', detail: 'Database seeded v5 with Christopher (2yr history, $80K balance)' },
  });

  console.log(`✅ Seed v5 completed. ${txCount} transactions created for Christopher.`);
  console.log('   Admin: LUCIAN1975 / PASSWORD@@1975');
  console.log('   Christopher: christopher111 / 1975@1975');
  console.log('   Christopher balance: $80,000 (Checking $25K + Savings $30K + Reserve $25K)');
  console.log(`   ${notifTypes.length} notifications for Christopher`);
}

main().then(() => db.$disconnect()).catch(e => { console.error(e); db.$disconnect(); process.exit(1); });
