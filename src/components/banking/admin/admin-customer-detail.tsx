'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AddressAutocomplete } from '@/components/banking/address-autocomplete';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { ChevronLeft, RefreshCw, Plus, Edit, Trash2, Banknote,
  ArrowDownLeft, ArrowUpRight, Save, AlertCircle, CreditCard, Snowflake, Unlock, Eye, MapPin, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, formatDate, maskAccountNumber } from '@/lib/store';

interface Customer {
  id: string; name: string; email: string; phone: string | null; address: string | null;
  avatarUrl: string | null; createdAt: string; totalBalance: number;
  accountCount: number; transactionCount: number;
  accounts: Account[];
}
interface Account {
  id: string; type: string; nickname: string; accountNumber: string;
  routingNumber?: string; balance: number; available?: number; status?: string;
}
interface Transaction {
  id: string; amount: number; description: string; counterparty: string | null;
  category: string; status: string; date: string; memo: string | null;
  fromAccount: { id: string; nickname: string; accountNumber: string } | null;
  toAccount: { id: string; nickname: string; accountNumber: string } | null;
}
interface BankCard {
  id: string; userId?: string; issuedBy?: string; cardType: string; network: string; cardholder: string;
  cardNumber: string; expiryMonth: number; expiryYear: number; cvv: string; pin?: string;
  color: string; status: string; creditLimit: number; creditUsed: number;
  nickname?: string | null;
  billingAddress?: string | null; billingCity?: string | null; billingState?: string | null; billingZip?: string | null;
  billingCountry?: string | null;
  account: { id: string; nickname: string; accountNumber: string } | null;
}

const colorStyles: Record<string, string> = {
  CRIMSON: 'from-[#5a1818] via-[#7a1d1d] to-[#3d0f0f]',
  GOLD: 'from-[#6b5520] via-[#8a6e2b] to-[#4d3a14]',
  OBSIDIAN: 'from-[#1a1a1a] via-[#2a2a2a] to-[#0a0a0a]',
  PLATINUM: 'from-[#5a5a5a] via-[#7c7c7c] to-[#3a3a3a]',
};

export function AdminCustomerDetail({ customerId, onBack }: { customerId: string; onBack: () => void }) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cards, setCards] = useState<BankCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Profile edit form
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Balance edit
  const [editingBalance, setEditingBalance] = useState<Account | null>(null);
  const [newBalance, setNewBalance] = useState('');
  const [writeAdj, setWriteAdj] = useState(true);
  const [savingBalance, setSavingBalance] = useState(false);

  // Write transaction
  const [writeOpen, setWriteOpen] = useState(false);
  const [wtAccount, setWtAccount] = useState('');
  const [wtDirection, setWtDirection] = useState<'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER'>('DEPOSIT');
  const [wtAmount, setWtAmount] = useState('');
  const [wtDesc, setWtDesc] = useState('');
  const [wtCounterparty, setWtCounterparty] = useState('');
  const [wtMemo, setWtMemo] = useState('');
  const [wtToAccount, setWtToAccount] = useState('');
  const [wtWriting, setWtWriting] = useState(false);

  // Edit transaction
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [txAmount, setTxAmount] = useState('');
  const [txDesc, setTxDesc] = useState('');
  const [txStatus, setTxStatus] = useState('');
  const [txDate, setTxDate] = useState('');
  const [savingTx, setSavingTx] = useState(false);

  // Issue card
  const [cardOpen, setCardOpen] = useState(false);
  const [cardAccount, setCardAccount] = useState('');
  const [cardType, setCardType] = useState<'DEBIT' | 'CREDIT'>('DEBIT');
  const [cardNetwork, setCardNetwork] = useState<'VISA' | 'MASTERCARD' | 'AMEX'>('VISA');
  const [cardColor, setCardColor] = useState('CRIMSON');
  const [cardCredit, setCardCredit] = useState('25000');

  // Card full details viewer (admin can see ALL details of any card)
  const [cardDetailsOpen, setCardDetailsOpen] = useState<BankCard | null>(null);
  const [issuingCard, setIssuingCard] = useState(false);

  async function load() {
    setRefreshing(true);
    try {
      const [uRes, aRes, tRes, cRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/accounts'),
        fetch(`/api/transactions?limit=500`),
        fetch('/api/cards'),
      ]);
      const uData = await uRes.json();
      const aData = await aRes.json();
      const tData = await tRes.json();
      const cData = await cRes.json();

      const found = (uData.users || []).find((u: Customer) => u.id === customerId) || null;
      setCustomer(found);
      if (found) {
        setEditName(found.name);
        setEditPhone(found.phone || '');
        setEditAddress(found.address || '');
        setEditAvatar(found.avatarUrl || '');
      }
      setAccounts((aData.accounts || []).filter((a: Account) => a.userId === undefined || found?.accounts.some(fa => fa.id === a.id)));
      setTransactions((tData.transactions || []).filter((t: Transaction) => {
        if (!found) return false;
        return t.fromAccount?.id && found.accounts.some(a => a.id === t.fromAccount!.id) ||
               t.toAccount?.id && found.accounts.some(a => a.id === t.toAccount!.id);
      }));
      // Show ALL cards belonging to this customer — both Arvest-issued (linked to an account)
      // and external cards (not linked to any account, added by the customer themselves).
      setCards((cData.cards || []).filter((c: any) => {
        if (!found) return false;
        // Match by userId (scalar on card) OR by user.id (from the included relation)
        const cardUserId = c.userId || c.user?.id;
        return cardUserId === found.id || (c.account && found.accounts.some(a => a.id === c.account.id));
      }));
      if (found?.accounts[0]) {
        if (!wtAccount) setWtAccount(found.accounts[0].id);
        if (!cardAccount) setCardAccount(found.accounts[0].id);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, [customerId]);

  async function saveProfile() {
    setSavingProfile(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'UPDATE', id: customerId, name: editName, phone: editPhone, address: editAddress, avatarUrl: editAvatar }),
      });
      if (!res.ok) { toast.error('Failed to update profile'); return; }
      toast.success('Profile updated');
      load();
    } finally { setSavingProfile(false); }
  }

  async function resetPassword() {
    if (!newPassword || newPassword.length < 8) { toast.error('Password must be at least 8 chars'); return; }
    setSavingProfile(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'RESET_PASSWORD', id: customerId, newPassword }),
      });
      if (!res.ok) { toast.error('Failed to reset password'); return; }
      toast.success('Password reset');
      setNewPassword('');
    } finally { setSavingProfile(false); }
  }

  async function saveBalance() {
    if (!editingBalance) return;
    setSavingBalance(true);
    try {
      const res = await fetch('/api/admin/set-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: editingBalance.id,
          newBalance: parseFloat(newBalance),
          writeAdjustment: writeAdj,
          description: 'Admin balance adjustment',
        }),
      });
      if (!res.ok) { toast.error('Failed to set balance'); return; }
      toast.success('Balance updated');
      setEditingBalance(null);
      load();
    } finally { setSavingBalance(false); }
  }

  async function writeTransaction() {
    if (!wtAccount || !wtAmount || parseFloat(wtAmount) <= 0) { toast.error('Account and positive amount required'); return; }
    setWtWriting(true);
    try {
      const res = await fetch('/api/admin/write-transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: wtAccount,
          direction: wtDirection,
          amount: parseFloat(wtAmount),
          description: wtDesc || undefined,
          counterparty: wtCounterparty || undefined,
          memo: wtMemo || undefined,
          toAccountId: wtDirection === 'TRANSFER' ? wtToAccount : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Failed to write transaction'); return; }
      toast.success('Transaction written');
      setWriteOpen(false);
      setWtAmount(''); setWtDesc(''); setWtCounterparty(''); setWtMemo('');
      load();
    } finally { setWtWriting(false); }
  }

  async function saveTxEdit() {
    if (!editTx) return;
    setSavingTx(true);
    try {
      const res = await fetch('/api/admin/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE',
          transactionId: editTx.id,
          amount: txAmount,
          description: txDesc,
          status: txStatus,
          date: txDate ? new Date(txDate).toISOString() : undefined,
        }),
      });
      if (!res.ok) { toast.error('Failed to update transaction'); return; }
      toast.success('Transaction updated');
      setEditTx(null);
      load();
    } finally { setSavingTx(false); }
  }

  async function deleteTx(tx: Transaction) {
    if (!confirm(`Delete transaction "${tx.description}" ($${tx.amount})?`)) return;
    const res = await fetch('/api/admin/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'DELETE', transactionId: tx.id }),
    });
    if (!res.ok) { toast.error('Failed to delete'); return; }
    toast.success('Transaction deleted');
    load();
  }

  async function issueCard() {
    if (!cardAccount) { toast.error('Select an account'); return; }
    setIssuingCard(true);
    try {
      const res = await fetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: customerId,
          accountId: cardAccount,
          cardType, network: cardNetwork, cardholder: editName.toUpperCase(),
          color: cardColor,
          creditLimit: cardType === 'CREDIT' ? parseFloat(cardCredit) : 0,
        }),
      });
      if (!res.ok) { toast.error('Failed to issue card'); return; }
      toast.success('Card issued');
      setCardOpen(false);
      load();
    } finally { setIssuingCard(false); }
  }

  async function toggleCardFreeze(card: BankCard) {
    const newStatus = card.status === 'FROZEN' ? 'ACTIVE' : 'FROZEN';
    const res = await fetch(`/api/cards/${card.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    if (!res.ok) { toast.error('Failed to update card'); return; }
    toast.success(newStatus === 'FROZEN' ? 'Card frozen' : 'Card activated');
    load();
  }

  async function deleteCard(card: BankCard) {
    if (!confirm(`Close card ••••${card.cardNumber.slice(-4)}?`)) return;
    const res = await fetch(`/api/cards/${card.id}`, { method: 'DELETE' });
    if (!res.ok) { toast.error('Failed to close card'); return; }
    toast.success('Card closed');
    load();
  }

  if (loading || !customer) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={onBack}><ChevronLeft className="w-4 h-4 mr-1" /> Back to all customers</Button>
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const totalBalance = customer.accounts.reduce((s, a) => s + a.balance, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}><ChevronLeft className="w-4 h-4 mr-1" /> All customers</Button>
        <Button variant="outline" size="sm" onClick={load} disabled={refreshing}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* Customer header */}
      <Card className="overflow-hidden">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-5">
            <Avatar className="w-20 h-20 ring-2 ring-primary/30">
              {customer.avatarUrl && <AvatarImage src={customer.avatarUrl} />}
              <AvatarFallback className="font-serif-display text-2xl bg-primary/10 text-primary">{customer.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h2 className="font-serif-display text-2xl mb-1">{customer.name}</h2>
              <div className="text-sm text-muted-foreground">{customer.email}</div>
              <div className="flex flex-wrap gap-4 mt-3 text-xs text-muted-foreground">
                <span>{customer.accounts.length} account{customer.accounts.length === 1 ? '' : 's'}</span>
                <span>·</span>
                <span>Total: <span className="font-medium text-foreground">{formatCurrency(totalBalance)}</span></span>
                <span>·</span>
                <span>{customer.transactionCount} transactions</span>
                <span>·</span>
                <span>Member since {formatDate(customer.createdAt)}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setWriteOpen(true)} className="arvest-gradient text-white">
                <Plus className="w-4 h-4 mr-1.5" /> Write transaction
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="accounts">
        <TabsList>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="cards">Cards</TabsTrigger>
          <TabsTrigger value="profile">Profile & Security</TabsTrigger>
        </TabsList>

        {/* Accounts tab */}
        <TabsContent value="accounts" className="mt-4 space-y-3">
          {customer.accounts.map(a => (
            <Card key={a.id}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Banknote className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{a.nickname}</span>
                        <Badge variant="outline" className="text-[9px]">{a.type.replace('_', ' ')}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">Acct ••••{a.accountNumber.slice(-4)} · Routing {a.routingNumber || '082900883'}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-serif-display text-2xl">{formatCurrency(a.balance)}</div>
                    <Button
                      size="sm" variant="outline" className="h-7 mt-1"
                      onClick={() => { setEditingBalance(a); setNewBalance(String(a.balance)); }}
                    >
                      <Edit className="w-3 h-3 mr-1" /> Adjust balance
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Transactions tab */}
        <TabsContent value="transactions" className="mt-4">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base">All Transactions ({transactions.length})</CardTitle>
              <Button size="sm" onClick={() => setWriteOpen(true)} className="arvest-gradient text-white">
                <Plus className="w-3.5 h-3.5 mr-1" /> Add transaction
              </Button>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border border-border max-h-[500px] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur">
                    <TableRow>
                      <TableHead className="text-xs">Date</TableHead>
                      <TableHead className="text-xs">Description</TableHead>
                      <TableHead className="text-xs hidden md:table-cell">Account</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs text-right">Amount</TableHead>
                      <TableHead className="text-xs text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-8 text-sm text-muted-foreground">No transactions yet</TableCell></TableRow>
                    ) : transactions.slice(0, 200).map(t => {
                      const isCredit = !!t.toAccount;
                      return (
                        <TableRow key={t.id} className="hover:bg-muted/40">
                          <TableCell className="text-xs whitespace-nowrap">{formatDate(t.date)}</TableCell>
                          <TableCell className="text-sm">
                            <div className="flex items-center gap-2">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${isCredit ? 'bg-emerald-100 text-emerald-700' : 'bg-primary/10 text-primary'}`}>
                                {isCredit ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                              </div>
                              <span>{t.description}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs hidden md:table-cell">{t.fromAccount?.nickname || t.toAccount?.nickname || '—'}</TableCell>
                          <TableCell>
                            <Badge variant={t.status === 'POSTED' ? 'default' : t.status === 'PENDING' ? 'secondary' : 'destructive'} className="text-[10px]">{t.status}</Badge>
                          </TableCell>
                          <TableCell className={`text-sm font-medium text-right ${isCredit ? 'text-emerald-700' : ''}`}>
                            {isCredit ? '+' : '−'}{formatCurrency(t.amount)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                                setEditTx(t);
                                setTxAmount(String(t.amount));
                                setTxDesc(t.description);
                                setTxStatus(t.status);
                                setTxDate(t.date.slice(0, 10));
                              }}>
                                <Edit className="w-3 h-3" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteTx(t)}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cards tab */}
        <TabsContent value="cards" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setCardOpen(true)} className="arvest-gradient text-white">
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Issue new card
            </Button>
          </div>
          {cards.length === 0 ? (
            <Card><CardContent className="text-center py-12 text-sm text-muted-foreground">No cards issued yet</CardContent></Card>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {cards.map(c => (
                <Card key={c.id}>
                  <CardContent className="p-4">
                    {/* Mini card visual */}
                    <div className={`aspect-[1.586] rounded-xl p-4 bg-gradient-to-br ${colorStyles[c.color] || colorStyles.CRIMSON} text-white mb-3`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-[9px] tracking-widest text-white/70">
                            {c.issuedBy === 'EXTERNAL' ? 'EXTERNAL CARD' : 'ARVEST PRIVATE'}
                          </div>
                          <div className="text-xs font-medium">{c.nickname && c.issuedBy === 'EXTERNAL' ? c.nickname : c.cardType}</div>
                        </div>
                        <div className="text-[10px] font-serif-display italic">{c.network}</div>
                      </div>
                      <div className="font-mono text-sm mt-4">•••• •••• •••• {c.cardNumber.slice(-4)}</div>
                      <div className="flex justify-between items-end mt-3">
                        <div className="text-[10px]">{c.cardholder}</div>
                        <div className="text-[10px] font-mono">{String(c.expiryMonth).padStart(2, '0')}/{String(c.expiryYear).slice(-2)}</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="text-xs text-muted-foreground">
                          {c.issuedBy === 'EXTERNAL' ? 'Added by customer' : 'Linked to'}
                        </div>
                        <div className="text-sm font-medium">
                          {c.issuedBy === 'EXTERNAL' ? (c.nickname || `${c.network} ${c.cardType}`) : (c.account?.nickname || 'Standalone')}
                        </div>
                      </div>
                      <Badge variant={c.status === 'ACTIVE' ? 'default' : 'destructive'} className="text-[10px]">{c.status}</Badge>
                    </div>
                    {/* Show billing address for external cards */}
                    {c.issuedBy === 'EXTERNAL' && c.billingAddress && (
                      <div className="mb-3 p-2 rounded-md bg-muted/40 text-[11px] text-muted-foreground">
                        <div className="font-medium text-foreground mb-0.5">Billing address</div>
                        {c.billingAddress}<br />
                        {c.billingCity}, {c.billingState} {c.billingZip}
                      </div>
                    )}
                    <div className="flex gap-2 flex-wrap">
                      <Button size="sm" variant="outline" onClick={() => setCardDetailsOpen(c)}>
                        <Eye className="w-3 h-3 mr-1" /> Full Details
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => toggleCardFreeze(c)}>
                        {c.status === 'FROZEN' ? <><Unlock className="w-3 h-3 mr-1" /> Unfreeze</> : <><Snowflake className="w-3 h-3 mr-1" /> Freeze</>}
                      </Button>
                      <Button size="sm" variant="outline" className="text-destructive" onClick={() => deleteCard(c)}>
                        <Trash2 className="w-3 h-3 mr-1" /> Close
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Profile tab */}
        <TabsContent value="profile" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Profile Information</CardTitle>
              <CardDescription className="text-xs">Edit customer details. Changes take effect immediately.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="w-16 h-16">
                  {editAvatar && <AvatarImage src={editAvatar} />}
                  <AvatarFallback className="bg-primary/10 text-primary">{editName.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <Label className="text-xs">Avatar URL</Label>
                  <Input value={editAvatar} onChange={(e) => setEditAvatar(e.target.value)} placeholder="https://…" />
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Full name</Label>
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Email (read-only)</Label>
                  <Input value={customer.email} disabled className="bg-muted/50" />
                </div>
                <div className="space-y-2">
                  <Label>Login ID (read-only)</Label>
                  <Input value={(customer as any).loginId || customer.email} disabled className="bg-muted/50" />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <AddressAutocomplete
                    value={editAddress}
                    onChange={setEditAddress}
                    placeholder="Start typing address…"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <Button onClick={saveProfile} disabled={savingProfile} className="arvest-gradient text-white">
                  {savingProfile ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Save profile
                </Button>
              </div>

              <div className="pt-4 border-t border-border">
                <div className="text-sm font-medium mb-2">Reset Password</div>
                <div className="flex gap-2">
                  <Input
                    type="text" placeholder="New password (min 8 chars)"
                    value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <Button onClick={resetPassword} disabled={savingProfile || !newPassword} variant="outline">
                    Reset
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ===== Adjust balance dialog ===== */}
      <Dialog open={!!editingBalance} onOpenChange={(o) => !o && setEditingBalance(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Balance — {editingBalance?.nickname}</DialogTitle>
            <DialogDescription>
              Set this account's balance to a new value. Current balance: {editingBalance && formatCurrency(editingBalance.balance)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>New balance ($)</Label>
              <Input type="number" step="0.01" value={newBalance} onChange={(e) => setNewBalance(e.target.value)} />
            </div>
            <div className="flex items-center gap-2 p-3 rounded-md bg-muted/40">
              <input type="checkbox" id="writeAdj" checked={writeAdj} onChange={(e) => setWriteAdj(e.target.checked)} className="w-4 h-4 accent-primary" />
              <label htmlFor="writeAdj" className="text-sm cursor-pointer">Write adjusting transaction (recommended)</label>
            </div>
            <div className="p-3 rounded-md bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>This will directly overwrite the account balance. The change will be reflected in the customer's dashboard immediately.</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingBalance(null)}>Cancel</Button>
            <Button onClick={saveBalance} disabled={savingBalance} className="arvest-gradient text-white">
              {savingBalance ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Apply new balance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Write transaction dialog ===== */}
      <Dialog open={writeOpen} onOpenChange={setWriteOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Write Transaction</DialogTitle>
            <DialogDescription>Manually create a transaction on this customer's account.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Direction</Label>
                <Select value={wtDirection} onValueChange={(v) => setWtDirection(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DEPOSIT">Deposit (incoming)</SelectItem>
                    <SelectItem value="WITHDRAWAL">Withdrawal (outgoing)</SelectItem>
                    <SelectItem value="TRANSFER">Transfer between accounts</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Account</Label>
                <Select value={wtAccount} onValueChange={setWtAccount}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {customer.accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.nickname}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {wtDirection === 'TRANSFER' && (
              <div className="space-y-2">
                <Label>Destination account</Label>
                <Select value={wtToAccount} onValueChange={setWtToAccount}>
                  <SelectTrigger><SelectValue placeholder="Select destination" /></SelectTrigger>
                  <SelectContent>
                    {customer.accounts.filter(a => a.id !== wtAccount).map(a => <SelectItem key={a.id} value={a.id}>{a.nickname}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Amount ($)</Label>
              <Input type="number" step="0.01" value={wtAmount} onChange={(e) => setWtAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={wtDesc} onChange={(e) => setWtDesc(e.target.value)} placeholder="e.g. Wire transfer in" />
              </div>
              <div className="space-y-2">
                <Label>Counterparty</Label>
                <Input value={wtCounterparty} onChange={(e) => setWtCounterparty(e.target.value)} placeholder="e.g. Acme Corp" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Memo</Label>
              <Textarea rows={2} value={wtMemo} onChange={(e) => setWtMemo(e.target.value)} placeholder="Optional memo" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWriteOpen(false)}>Cancel</Button>
            <Button onClick={writeTransaction} disabled={wtWriting} className="arvest-gradient text-white">
              {wtWriting ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Write transaction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Edit transaction dialog ===== */}
      <Dialog open={!!editTx} onOpenChange={(o) => !o && setEditTx(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Transaction</DialogTitle>
            <DialogDescription>{editTx?.description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Amount ($)</Label>
                <Input type="number" step="0.01" value={txAmount} onChange={(e) => setTxAmount(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={txStatus} onValueChange={setTxStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="POSTED">Posted</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="FLAGGED">Flagged</SelectItem>
                    <SelectItem value="DECLINED">Declined</SelectItem>
                    <SelectItem value="REVERSED">Reversed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={txDesc} onChange={(e) => setTxDesc(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={txDate} onChange={(e) => setTxDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTx(null)}>Cancel</Button>
            <Button onClick={saveTxEdit} disabled={savingTx} className="arvest-gradient text-white">
              {savingTx ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Issue card dialog ===== */}
      <Dialog open={cardOpen} onOpenChange={setCardOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Issue New Card</DialogTitle>
            <DialogDescription>Create a new debit or credit card linked to one of this customer's accounts.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Linked account</Label>
              <Select value={cardAccount} onValueChange={setCardAccount}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {customer.accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.nickname} · ••••{a.accountNumber.slice(-4)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Card type</Label>
                <Select value={cardType} onValueChange={(v) => setCardType(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DEBIT">Debit</SelectItem>
                    <SelectItem value="CREDIT">Credit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Network</Label>
                <Select value={cardNetwork} onValueChange={(v) => setCardNetwork(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VISA">Visa</SelectItem>
                    <SelectItem value="MASTERCARD">Mastercard</SelectItem>
                    <SelectItem value="AMEX">American Express</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Color</Label>
                <Select value={cardColor} onValueChange={setCardColor}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CRIMSON">Crimson</SelectItem>
                    <SelectItem value="GOLD">Gold</SelectItem>
                    <SelectItem value="OBSIDIAN">Obsidian</SelectItem>
                    <SelectItem value="PLATINUM">Platinum</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {cardType === 'CREDIT' && (
                <div className="space-y-2">
                  <Label>Credit limit ($)</Label>
                  <Input type="number" value={cardCredit} onChange={(e) => setCardCredit(e.target.value)} />
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCardOpen(false)}>Cancel</Button>
            <Button onClick={issueCard} disabled={issuingCard} className="arvest-gradient text-white">
              {issuingCard ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <CreditCard className="w-4 h-4 mr-2" />}
              Issue card
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Card full details dialog (admin can see EVERYTHING) ===== */}
      <Dialog open={!!cardDetailsOpen} onOpenChange={(o) => !o && setCardDetailsOpen(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-4 h-4" /> Full Card Details
            </DialogTitle>
            <DialogDescription>
              {cardDetailsOpen?.issuedBy === 'EXTERNAL' ? 'External card added by customer' : 'Arvest-issued card'} — all fields visible to admin
            </DialogDescription>
          </DialogHeader>
          {cardDetailsOpen && (
            <div className="space-y-1">
              {/* Card visual */}
              <div className={`aspect-[1.586] rounded-xl p-4 bg-gradient-to-br ${colorStyles[cardDetailsOpen.color] || colorStyles.CRIMSON} text-white mb-4`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-[9px] tracking-widest text-white/70">
                      {cardDetailsOpen.issuedBy === 'EXTERNAL' ? 'EXTERNAL CARD' : 'ARVEST PRIVATE'}
                    </div>
                    <div className="text-xs font-medium">{cardDetailsOpen.cardType}</div>
                  </div>
                  <div className="text-[10px] font-serif-display italic">{cardDetailsOpen.network}</div>
                </div>
                <div className="font-mono text-sm mt-4">{cardDetailsOpen.cardNumber.match(/.{1,4}/g)?.join(' ')}</div>
                <div className="flex justify-between items-end mt-3">
                  <div className="text-[10px]">{cardDetailsOpen.cardholder}</div>
                  <div className="text-[10px] font-mono">{String(cardDetailsOpen.expiryMonth).padStart(2, '0')}/{String(cardDetailsOpen.expiryYear).slice(-2)}</div>
                </div>
              </div>

              {/* All details */}
              <DetailRow label="Card type" value={`${cardDetailsOpen.cardType} · ${cardDetailsOpen.network}`} />
              <DetailRow label="Issued by" value={cardDetailsOpen.issuedBy === 'EXTERNAL' ? 'External (customer-added)' : 'Arvest Bank'} />
              <DetailRow label="Cardholder" value={cardDetailsOpen.cardholder} />
              <DetailRow label="Card number" value={cardDetailsOpen.cardNumber.match(/.{1,4}/g)?.join(' ') || cardDetailsOpen.cardNumber} mono />
              <DetailRow label="Expiry" value={`${String(cardDetailsOpen.expiryMonth).padStart(2, '0')}/${cardDetailsOpen.expiryYear}`} mono />
              <DetailRow label="CVV" value={cardDetailsOpen.cvv} mono />
              <DetailRow label="PIN" value={cardDetailsOpen.pin || '1234'} mono />
              <DetailRow label="Status" value={cardDetailsOpen.status} />
              <DetailRow label="Color" value={cardDetailsOpen.color} />

              {cardDetailsOpen.nickname && (
                <DetailRow label="Nickname" value={cardDetailsOpen.nickname} />
              )}

              {cardDetailsOpen.account && (
                <DetailRow label="Linked account" value={`${cardDetailsOpen.account.nickname} (••••${cardDetailsOpen.account.accountNumber.slice(-4)})`} />
              )}

              {cardDetailsOpen.cardType === 'CREDIT' && (
                <>
                  <DetailRow label="Credit limit" value={formatCurrency(cardDetailsOpen.creditLimit)} />
                  <DetailRow label="Used" value={formatCurrency(cardDetailsOpen.creditUsed)} />
                  <DetailRow label="Available" value={formatCurrency(cardDetailsOpen.creditLimit - cardDetailsOpen.creditUsed)} />
                </>
              )}

              {/* Billing address — only for external cards */}
              {cardDetailsOpen.issuedBy === 'EXTERNAL' && cardDetailsOpen.billingAddress && (
                <div className="pt-3 border-t border-border mt-2">
                  <div className="text-xs text-muted-foreground tracking-wider mb-2 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> BILLING ADDRESS
                  </div>
                  <div className="text-sm">
                    {cardDetailsOpen.cardholder}<br />
                    {cardDetailsOpen.billingAddress}<br />
                    {cardDetailsOpen.billingCity}, {cardDetailsOpen.billingState} {cardDetailsOpen.billingZip}<br />
                    {cardDetailsOpen.billingCountry || 'USA'}
                  </div>
                </div>
              )}

              <div className="p-3 rounded-md bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2 mt-3">
                <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>These full card details are visible to administrators only. The customer sees masked card numbers by default.</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className={`text-sm font-medium ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}
