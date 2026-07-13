'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { useAuth, formatCurrency, formatDate, formatDateTime, maskAccountNumber } from '@/lib/store';
import {
  Users, TrendingUp, DollarSign, Activity, Search, Plus, MoreHorizontal,
  Pencil, Trash2, KeyRound, Shield, AlertTriangle, CheckCircle2, XCircle,
  Flag, Eye, ArrowUpRight, ArrowDownLeft, LogOut, Building2, Crown,
  RefreshCw, ChevronRight,
} from 'lucide-react';
import {
  BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend, AreaChart, Area,
} from 'recharts';
import { useRouter } from 'next/navigation';
import { AdminCustomerDetail } from './admin-customer-detail';
import { InactivityGuard } from '@/components/banking/inactivity-guard';
import { NotificationBell } from '@/components/banking/notification-bell';
import { AddressAutocomplete } from '@/components/banking/address-autocomplete';

interface Stats {
  totals: { users: number; accounts: number; transactions: number; totalBalance: number; pending: number; flagged: number };
  dailyActivity: Array<{ date: string; credits: number; debits: number; count: number }>;
  categories: Array<{ category: string; count: number; total: number }>;
  audit: Array<{ id: string; actor: string; action: string; detail: string | null; createdAt: string; userId: string | null }>;
  topCustomers: Array<{ id: string; name: string; email: string; totalBalance: number }>;
}

interface Customer {
  id: string; name: string; email: string; phone: string | null; address: string | null;
  avatarUrl: string | null; createdAt: string; totalBalance: number;
  accountCount: number; transactionCount: number;
  accounts: Array<{ id: string; type: string; nickname: string; balance: number; accountNumber: string }>;
}

interface Transaction {
  id: string; amount: number; description: string; counterparty: string | null;
  category: string; status: string; date: string; memo: string | null;
  fromAccount: { id: string; nickname: string; accountNumber: string; user: { id: string; name: string; email: string } } | null;
  toAccount: { id: string; nickname: string; accountNumber: string; user: { id: string; name: string; email: string } } | null;
}

// Use stable hex colors — Recharts SVG renderer handles these more reliably than oklch()
const ARVEST_CRIMSON = '#7a1d1d';
const ARVEST_GOLD = '#b88840';
const ARVEST_SLATE = '#5a6e8a';
const ARVEST_FOREST = '#3f6b46';
const ARVEST_TERRACOTTA = '#a04d2d';
const ARVEST_TAUPE = '#7a7066';
const PIE_COLORS = [ARVEST_CRIMSON, ARVEST_GOLD, ARVEST_SLATE, ARVEST_FOREST, ARVEST_TERRACOTTA, ARVEST_TAUPE];

export function AdminDashboard() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const router = useRouter();

  const [stats, setStats] = useState<Stats | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [refreshing, setRefreshing] = useState(false);

  // User mgmt
  const [editingUser, setEditingUser] = useState<Customer | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [resetPwUser, setResetPwUser] = useState<Customer | null>(null);

  // New user form
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newLoginId, setNewLoginId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newAvatar, setNewAvatar] = useState('');
  const [newDeposit, setNewDeposit] = useState('5000');
  const [newChecking, setNewChecking] = useState(true);
  const [newSavings, setNewSavings] = useState(true);
  const [newPrivateClient, setNewPrivateClient] = useState(true);
  const [newIssueCard, setNewIssueCard] = useState(true);
  const [creating, setCreating] = useState(false);

  // Edit form
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Reset pw form
  const [resetNewPw, setResetNewPw] = useState('');
  const [resetting, setResetting] = useState(false);

  // Tx action dialog
  const [txAction, setTxAction] = useState<{ tx: Transaction; action: 'APPROVE' | 'FLAG' | 'DECLINE' | 'REVERSE' } | null>(null);
  const [txReason, setTxReason] = useState('');
  const [acting, setActing] = useState(false);

  // Customer detail view (when admin clicks a customer row)
  const [detailViewCustomerId, setDetailViewCustomerId] = useState<string | null>(null);

  async function loadAll() {
    setRefreshing(true);
    try {
      const [sRes, uRes, tRes] = await Promise.all([
        fetch('/api/admin/stats'),
        fetch('/api/admin/users'),
        fetch('/api/transactions?limit=200'),
      ]);
      const sData = await sRes.json();
      const uData = await uRes.json();
      const tData = await tRes.json();
      setStats(sData);
      setCustomers(uData.users || []);
      setTransactions(tData.transactions || []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  const filteredCustomers = customers.filter(c => {
    if (!search) return true;
    const s = search.toLowerCase();
    return c.name.toLowerCase().includes(s) || c.email.toLowerCase().includes(s);
  });

  const filteredTx = transactions.filter(t => statusFilter === 'ALL' || t.status === statusFilter);

  function openEdit(c: Customer) {
    setEditName(c.name); setEditPhone(c.phone || ''); setEditAddress(c.address || ''); setEditAvatar(c.avatarUrl || '');
    setEditingUser(c);
  }

  async function saveEdit() {
    if (!editingUser) return;
    setSavingEdit(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'UPDATE', id: editingUser.id, name: editName, phone: editPhone, address: editAddress, avatarUrl: editAvatar }),
      });
      if (!res.ok) { toast.error('Failed to update user'); return; }
      toast.success('User updated');
      setEditingUser(null);
      loadAll();
    } finally { setSavingEdit(false); }
  }

  async function deleteUser(c: Customer) {
    if (!confirm(`Delete ${c.name}? This will remove all accounts and transactions. This cannot be undone.`)) return;
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'DELETE', id: c.id }),
    });
    if (!res.ok) { toast.error('Failed to delete user'); return; }
    toast.success('User deleted');
    loadAll();
  }

  async function createUser() {
    if (!newName || !newEmail || !newPassword) { toast.error('Name, email, password required'); return; }
    if (newPassword.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    const accountTypes: string[] = [];
    if (newChecking) accountTypes.push('CHECKING');
    if (newSavings) accountTypes.push('SAVINGS');
    if (newPrivateClient) accountTypes.push('PRIVATE_CLIENT');
    if (accountTypes.length === 0) { toast.error('Select at least one account type'); return; }
    setCreating(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CREATE', name: newName, email: newEmail, loginId: newLoginId, password: newPassword,
          phone: newPhone, address: newAddress, avatarUrl: newAvatar,
          initialDeposit: parseFloat(newDeposit) || 0,
          accountTypes, issueCard: newIssueCard,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Failed to create user'); return; }
      toast.success('Customer created');
      setShowCreate(false);
      setNewName(''); setNewEmail(''); setNewLoginId(''); setNewPassword(''); setNewPhone(''); setNewAddress(''); setNewAvatar(''); setNewDeposit('5000');
      setNewChecking(true); setNewSavings(true); setNewPrivateClient(true); setNewIssueCard(true);
      loadAll();
    } finally { setCreating(false); }
  }

  async function resetPassword() {
    if (!resetPwUser || !resetNewPw) return;
    if (resetNewPw.length < 8) { toast.error('Password must be ≥ 8 chars'); return; }
    setResetting(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'RESET_PASSWORD', id: resetPwUser.id, newPassword: resetNewPw }),
      });
      if (!res.ok) { toast.error('Failed to reset password'); return; }
      toast.success('Password reset');
      setResetPwUser(null); setResetNewPw('');
    } finally { setResetting(false); }
  }

  async function performTxAction() {
    if (!txAction) return;
    setActing(true);
    try {
      const res = await fetch('/api/admin/transaction-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId: txAction.tx.id, action: txAction.action, reason: txReason }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Failed'); return; }
      toast.success(`Transaction ${txAction.action.toLowerCase()}d`);
      setTxAction(null); setTxReason('');
      loadAll();
    } finally { setActing(false); }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
      </div>
    );
  }

  // Customer detail view takes over the main area when a customer is selected
  if (detailViewCustomerId) {
    return (
      <div className="min-h-screen flex bg-background">
        <InactivityGuard onLogout={async () => { await logout(); window.location.href = '/'; }} />
        <aside className="hidden lg:flex flex-col w-60 bg-sidebar text-sidebar-foreground shrink-0">
          <div className="p-5 border-b border-sidebar-border">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-md bg-sidebar-primary/15 border border-sidebar-primary/30 flex items-center justify-center">
                <span className="font-serif-display text-lg text-sidebar-primary">A</span>
              </div>
              <div>
                <div className="font-serif-display text-base tracking-wide">ARVEST</div>
                <div className="text-[8px] tracking-[0.3em] text-sidebar-foreground/60 -mt-0.5">PRIVATE · ADMIN</div>
              </div>
            </div>
          </div>
          <div className="p-4 border-b border-sidebar-border">
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-sidebar-primary/10 text-[10px] text-sidebar-primary tracking-wider mb-3">
              <Crown className="w-3 h-3" /> ADMINISTRATOR
            </div>
            <div className="text-xs text-sidebar-foreground/70">{user?.email}</div>
          </div>
          <nav className="flex-1 p-3 space-y-1 text-sm">
            <button onClick={() => setDetailViewCustomerId(null)} className="w-full flex items-center gap-2 px-3 py-2 rounded-md bg-sidebar-primary/15 text-sidebar-primary">
              <Activity className="w-4 h-4" /> Back to Overview
            </button>
          </nav>
          <div className="p-3 border-t border-sidebar-border">
            <button onClick={() => { logout().then(() => { window.location.href = '/'; }); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent">
              <LogOut className="w-4 h-4" /> Sign out
            </button>
          </div>
        </aside>
        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
            <div className="flex items-center gap-3 px-4 lg:px-8 h-16">
              <div>
                <div className="text-[11px] text-muted-foreground tracking-wider uppercase">Arvest Private · Admin Console</div>
                <div className="text-sm font-medium">Customer Detail</div>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <NotificationBell />
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => { logout().then(() => { window.location.href = '/'; }); }}>
                  <LogOut className="w-4 h-4 sm:mr-1.5" /><span className="hidden sm:inline">Sign out</span>
                </Button>
              </div>
            </div>
          </header>
          <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto">
            <AdminCustomerDetail customerId={detailViewCustomerId} onBack={() => setDetailViewCustomerId(null)} />
          </main>
          <footer className="mt-auto border-t border-border py-4 px-4 lg:px-8 text-center text-xs text-muted-foreground">
            <div className="max-w-7xl mx-auto">© 2026 Arvest Private Banking · Admin Console · NMLS #445836</div>
          </footer>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      <InactivityGuard onLogout={async () => { await logout(); window.location.href = '/'; }} />
      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col w-60 bg-sidebar text-sidebar-foreground shrink-0">
        <div className="p-5 border-b border-sidebar-border">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-md bg-sidebar-primary/15 border border-sidebar-primary/30 flex items-center justify-center">
              <span className="font-serif-display text-lg text-sidebar-primary">A</span>
            </div>
            <div>
              <div className="font-serif-display text-base tracking-wide">ARVEST</div>
              <div className="text-[8px] tracking-[0.3em] text-sidebar-foreground/60 -mt-0.5">PRIVATE · ADMIN</div>
            </div>
          </div>
        </div>

        <div className="p-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-sidebar-primary/10 text-[10px] text-sidebar-primary tracking-wider mb-3">
            <Crown className="w-3 h-3" />
            ADMINISTRATOR
          </div>
          <div className="text-xs text-sidebar-foreground/70">{user?.email}</div>
        </div>

        <nav className="flex-1 p-3 space-y-1 text-sm">
          <a href="#" className="flex items-center gap-2 px-3 py-2 rounded-md bg-sidebar-primary/15 text-sidebar-primary">
            <Activity className="w-4 h-4" /> Overview
          </a>
          <a href="#users" className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-sidebar-accent text-sidebar-foreground/80">
            <Users className="w-4 h-4" /> Customers
          </a>
          <a href="#transactions" className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-sidebar-accent text-sidebar-foreground/80">
            <TrendingUp className="w-4 h-4" /> Transactions
          </a>
          <a href="#audit" className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-sidebar-accent text-sidebar-foreground/80">
            <Shield className="w-4 h-4" /> Audit Log
          </a>
        </nav>

        <div className="p-3 border-t border-sidebar-border">
          <button onClick={() => { logout().then(() => { window.location.href = '/'; }); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent">
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
          <div className="flex items-center gap-3 px-4 lg:px-8 h-16">
            <div>
              <div className="text-[11px] text-muted-foreground tracking-wider uppercase">Arvest Private · Admin Console</div>
              <div className="text-sm font-medium">Operations Dashboard</div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <NotificationBell />
              <Button variant="outline" size="sm" onClick={loadAll} disabled={refreshing}>
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
              </Button>
              {user && (
                <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-muted/50">
                  <Avatar className="w-7 h-7">
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">{user.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm hidden sm:block">{user.name}</span>
                </div>
              )}
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => { logout().then(() => { window.location.href = '/'; }); }}>
                <LogOut className="w-4 h-4 sm:mr-1.5" /><span className="hidden sm:inline">Sign out</span>
              </Button>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* KPI tiles */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiTile
              icon={Users}
              label="Customers"
              value={stats?.totals.users.toString() || '0'}
              sub="Active private clients"
            />
            <KpiTile
              icon={DollarSign}
              label="AUM"
              value={formatCurrency(stats?.totals.totalBalance || 0)}
              sub="Assets under management"
            />
            <KpiTile
              icon={Activity}
              label="Transactions"
              value={(stats?.totals.transactions || 0).toString()}
              sub="All time"
            />
            <KpiTile
              icon={AlertTriangle}
              label="Pending Review"
              value={(stats?.totals.pending + stats?.totals.flagged || 0).toString()}
              sub={`${stats?.totals.pending || 0} pending · ${stats?.totals.flagged || 0} flagged`}
              accent="amber"
            />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Activity (last 14 days)</CardTitle>
                <CardDescription className="text-xs">Daily credits vs debits across all accounts</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={stats?.dailyActivity || []} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="creditsGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={ARVEST_FOREST} stopOpacity={0.4} />
                        <stop offset="100%" stopColor={ARVEST_FOREST} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="debitsGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={ARVEST_CRIMSON} stopOpacity={0.4} />
                        <stop offset="100%" stopColor={ARVEST_CRIMSON} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e6e0d8" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#7a7066' }} axisLine={false} tickLine={false} tickFormatter={(v) => v.slice(5)} />
                    <YAxis tick={{ fontSize: 10, fill: '#7a7066' }} axisLine={false} tickLine={false} width={50} tickFormatter={(v) => `$${(Number(v) / 1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e6e0d8', fontSize: '12px' }}
                      formatter={(v: any, n: string) => [formatCurrency(Number(v)), n === 'credits' ? 'Credits' : 'Debits']}
                    />
                    <Area type="monotone" dataKey="credits" stroke={ARVEST_FOREST} strokeWidth={2} fill="url(#creditsGrad)" />
                    <Area type="monotone" dataKey="debits" stroke={ARVEST_CRIMSON} strokeWidth={2} fill="url(#debitsGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">By Category</CardTitle>
                <CardDescription className="text-xs">Transaction volume distribution</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={stats?.categories || []}
                      dataKey="count"
                      nameKey="category"
                      cx="50%" cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={2}
                    >
                      {(stats?.categories || []).map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e6e0d8', fontSize: '12px' }}
                      formatter={(v: any, n: string) => [`${v} transactions`, n]}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Customer management */}
          <Card id="users">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="w-4 h-4" /> Customer Management
                  </CardTitle>
                  <CardDescription className="text-xs">{customers.length} private clients · Total AUM {formatCurrency(customers.reduce((s, c) => s + c.totalBalance, 0))}</CardDescription>
                </div>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Search customers…"
                      className="pl-8 h-9 w-56"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <Button onClick={() => setShowCreate(true)} size="sm" className="arvest-gradient text-white">
                    <Plus className="w-3.5 h-3.5 mr-1.5" /> Add customer
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="text-xs">Customer</TableHead>
                      <TableHead className="text-xs hidden md:table-cell">Contact</TableHead>
                      <TableHead className="text-xs hidden lg:table-cell">Member since</TableHead>
                      <TableHead className="text-xs text-right">Accounts</TableHead>
                      <TableHead className="text-xs text-right">Total Balance</TableHead>
                      <TableHead className="text-xs text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCustomers.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-8 text-sm text-muted-foreground">No customers match your search</TableCell></TableRow>
                    ) : filteredCustomers.map(c => (
                      <TableRow key={c.id} className="hover:bg-muted/40 cursor-pointer" onClick={() => setDetailViewCustomerId(c.id)}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="w-9 h-9">
                              <AvatarImage src={c.avatarUrl || undefined} />
                              <AvatarFallback className="text-xs bg-primary/10 text-primary">{c.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="text-sm font-medium">{c.name}</div>
                              <div className="text-[11px] text-muted-foreground">{c.email}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-xs">{c.phone || '—'}</TableCell>
                        <TableCell className="hidden lg:table-cell text-xs">{formatDate(c.createdAt)}</TableCell>
                        <TableCell className="text-right text-sm">{c.accountCount}</TableCell>
                        <TableCell className="text-right font-serif-display text-base">{formatCurrency(c.totalBalance)}</TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setDetailViewCustomerId(c.id)}>
                              <Eye className="w-3 h-3 mr-1" /> Open
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(c)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setResetPwUser(c)}>
                              <KeyRound className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deleteUser(c)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Top customers */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Crown className="w-4 h-4" /> Top Clients by AUM
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(stats?.topCustomers || []).map((c, i) => (
                  <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-muted text-muted-foreground'}`}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{c.name}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{c.email}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-serif-display text-base">{formatCurrency(c.totalBalance)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Transactions table */}
          <Card id="transactions">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" /> All Transactions
                  </CardTitle>
                  <CardDescription className="text-xs">Approve, flag, or reverse transactions across all customers</CardDescription>
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All statuses</SelectItem>
                    <SelectItem value="POSTED">Posted</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="FLAGGED">Flagged</SelectItem>
                    <SelectItem value="DECLINED">Declined</SelectItem>
                    <SelectItem value="REVERSED">Reversed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border border-border overflow-hidden max-h-[500px] overflow-y-auto arvest-scroll">
                <Table>
                  <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur z-10">
                    <TableRow>
                      <TableHead className="text-xs">Date</TableHead>
                      <TableHead className="text-xs">Customer</TableHead>
                      <TableHead className="text-xs">Description</TableHead>
                      <TableHead className="text-xs hidden md:table-cell">Category</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs text-right">Amount</TableHead>
                      <TableHead className="text-xs text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTx.slice(0, 100).map(t => {
                      const custName = t.fromAccount?.user?.name || t.toAccount?.user?.name || '—';
                      const isCredit = !!t.toAccount;
                      return (
                        <TableRow key={t.id} className="hover:bg-muted/40">
                          <TableCell className="text-xs whitespace-nowrap">{formatDate(t.date)}</TableCell>
                          <TableCell className="text-xs">{custName}</TableCell>
                          <TableCell className="text-xs">
                            <div className="flex items-center gap-2">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${isCredit ? 'bg-emerald-100 text-emerald-700' : 'bg-primary/10 text-primary'}`}>
                                {isCredit ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                              </div>
                              <span className="truncate max-w-[160px]">{t.description}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs hidden md:table-cell">
                            <Badge variant="outline" className="text-[10px]">{t.category}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={t.status === 'POSTED' ? 'default' : t.status === 'PENDING' ? 'secondary' : t.status === 'FLAGGED' ? 'destructive' : 'outline'}
                              className="text-[10px]"
                            >
                              {t.status}
                            </Badge>
                          </TableCell>
                          <TableCell className={`text-sm font-medium text-right ${isCredit ? 'text-emerald-700' : ''}`}>
                            {isCredit ? '+' : '−'}{formatCurrency(t.amount)}
                          </TableCell>
                          <TableCell className="text-right">
                            {t.status === 'PENDING' || t.status === 'FLAGGED' || t.status === 'POSTED' ? (
                              <div className="flex items-center justify-end gap-1">
                                {t.status === 'PENDING' && (
                                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setTxAction({ tx: t, action: 'APPROVE' })}>
                                    <CheckCircle2 className="w-3 h-3 mr-1" /> Approve
                                  </Button>
                                )}
                                {(t.status === 'POSTED' || t.status === 'PENDING') && (
                                  <Button size="sm" variant="outline" className="h-7 text-xs text-amber-700 border-amber-300 hover:bg-amber-50" onClick={() => setTxAction({ tx: t, action: 'FLAG' })}>
                                    <Flag className="w-3 h-3 mr-1" /> Flag
                                  </Button>
                                )}
                                {(t.status === 'POSTED' || t.status === 'FLAGGED' || t.status === 'PENDING') && (
                                  <Button size="sm" variant="outline" className="h-7 text-xs text-destructive hover:bg-destructive/10" onClick={() => setTxAction({ tx: t, action: 'DECLINE' })}>
                                    <XCircle className="w-3 h-3 mr-1" /> Reverse
                                  </Button>
                                )}
                              </div>
                            ) : (
                              <span className="text-[11px] text-muted-foreground">No actions</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Audit log */}
          <Card id="audit">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="w-4 h-4" /> Audit Log
              </CardTitle>
              <CardDescription className="text-xs">Recent admin and user activity</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-80 overflow-y-auto arvest-scroll">
                {(stats?.audit || []).map(a => (
                  <div key={a.id} className="flex items-start gap-3 p-3 rounded-md border border-border text-xs">
                    <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <Activity className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{a.action}</span>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-muted-foreground">{a.actor}</span>
                      </div>
                      {a.detail && <div className="text-muted-foreground mt-0.5">{a.detail}</div>}
                      <div className="text-[10px] text-muted-foreground mt-0.5">{formatDateTime(a.createdAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </main>

        <footer className="mt-auto border-t border-border py-4 px-4 lg:px-8 text-center text-xs text-muted-foreground">
          <div className="max-w-7xl mx-auto">© 2026 Arvest Private Banking · Admin Console · NMLS #445836</div>
        </footer>
      </div>

      {/* ===== Create user dialog ===== */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Customer</DialogTitle>
            <DialogDescription>Create a fully-functional private banking customer with accounts, opening deposit, and an optional debit card.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Profile section */}
            <div>
              <div className="text-xs font-medium text-muted-foreground tracking-wider mb-2">PROFILE</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2 md:col-span-2">
                  <Label>Full name</Label>
                  <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. John Doe" />
                </div>
                <div className="space-y-2">
                  <Label>Email (for profile & notifications)</Label>
                  <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="john.doe@example.com" />
                </div>
                <div className="space-y-2">
                  <Label>Login ID (for sign-in — leave blank to auto-generate)</Label>
                  <Input value={newLoginId} onChange={(e) => setNewLoginId(e.target.value)} placeholder="e.g. john.d7281" />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="+1 (xxx) xxx-xxxx" />
                </div>
                <div className="space-y-2">
                  <Label>Initial password</Label>
                  <Input type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min 8 characters" />
                </div>
                <div className="space-y-2">
                  <Label>Avatar URL (optional)</Label>
                  <Input value={newAvatar} onChange={(e) => setNewAvatar(e.target.value)} placeholder="https://…" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Address</Label>
                  <AddressAutocomplete
                    value={newAddress}
                    onChange={setNewAddress}
                    placeholder="Start typing address…"
                  />
                </div>
              </div>
            </div>

            {/* Accounts section */}
            <div className="pt-3 border-t border-border">
              <div className="text-xs font-medium text-muted-foreground tracking-wider mb-2">ACCOUNTS</div>
              <div className="space-y-2">
                <label className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/40 cursor-pointer">
                  <input type="checkbox" checked={newChecking} onChange={(e) => setNewChecking(e.target.checked)} className="w-4 h-4 accent-primary" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">Private Checking</div>
                    <div className="text-[11px] text-muted-foreground"> everyday transactions</div>
                  </div>
                </label>
                <label className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/40 cursor-pointer">
                  <input type="checkbox" checked={newSavings} onChange={(e) => setNewSavings(e.target.checked)} className="w-4 h-4 accent-primary" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">Premier Savings</div>
                    <div className="text-[11px] text-muted-foreground">Interest-bearing savings</div>
                  </div>
                </label>
                <label className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/40 cursor-pointer">
                  <input type="checkbox" checked={newPrivateClient} onChange={(e) => setNewPrivateClient(e.target.checked)} className="w-4 h-4 accent-primary" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">Private Client Reserve</div>
                    <div className="text-[11px] text-muted-foreground">Premium wealth account</div>
                  </div>
                </label>
              </div>
              <div className="mt-3 space-y-2">
                <Label>Opening deposit ($ — split across selected accounts)</Label>
                <Input type="number" value={newDeposit} onChange={(e) => setNewDeposit(e.target.value)} />
              </div>
            </div>

            {/* Card section */}
            <div className="pt-3 border-t border-border">
              <label className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/40 cursor-pointer">
                <input type="checkbox" checked={newIssueCard} onChange={(e) => setNewIssueCard(e.target.checked)} className="w-4 h-4 accent-primary" />
                <div className="flex-1">
                  <div className="text-sm font-medium">Issue Visa debit card</div>
                  <div className="text-[11px] text-muted-foreground">Linked to the checking account</div>
                </div>
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={createUser} disabled={creating} className="arvest-gradient text-white">
              {creating ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Create customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Edit user sheet ===== */}
      <Sheet open={!!editingUser} onOpenChange={(o) => !o && setEditingUser(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit Customer</SheetTitle>
            <SheetDescription>{editingUser?.email}</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
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
            <div className="space-y-2">
              <Label>Avatar URL</Label>
              <Input value={editAvatar} onChange={(e) => setEditAvatar(e.target.value)} />
            </div>

            {editingUser?.accounts && editingUser.accounts.length > 0 && (
              <div className="pt-3 border-t border-border">
                <div className="text-xs text-muted-foreground tracking-wider mb-2">ACCOUNTS</div>
                <div className="space-y-2">
                  {editingUser.accounts.map(a => (
                    <div key={a.id} className="flex items-center justify-between p-2 rounded-md bg-muted/40 text-xs">
                      <div>
                        <div className="font-medium">{a.nickname}</div>
                        <div className="text-muted-foreground font-mono">••••{a.accountNumber.slice(-4)}</div>
                      </div>
                      <div className="font-medium">{formatCurrency(a.balance)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-3">
              <Button variant="outline" className="flex-1" onClick={() => setEditingUser(null)}>Cancel</Button>
              <Button onClick={saveEdit} disabled={savingEdit} className="flex-1 arvest-gradient text-white">
                {savingEdit ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Save
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ===== Reset password dialog ===== */}
      <Dialog open={!!resetPwUser} onOpenChange={(o) => !o && setResetPwUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>Set a new password for {resetPwUser?.name} ({resetPwUser?.email}). The customer will need to use this new password on next sign-in.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>New password</Label>
            <Input type="text" value={resetNewPw} onChange={(e) => setResetNewPw(e.target.value)} placeholder="Minimum 8 characters" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetPwUser(null)}>Cancel</Button>
            <Button onClick={resetPassword} disabled={resetting} className="arvest-gradient text-white">
              {resetting ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <KeyRound className="w-4 h-4 mr-2" />}
              Reset password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Tx action dialog ===== */}
      <Dialog open={!!txAction} onOpenChange={(o) => !o && setTxAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {txAction?.action === 'APPROVE' && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
              {txAction?.action === 'FLAG' && <Flag className="w-5 h-5 text-amber-600" />}
              {(txAction?.action === 'DECLINE' || txAction?.action === 'REVERSE') && <XCircle className="w-5 h-5 text-destructive" />}
              {txAction?.action === 'APPROVE' ? 'Approve transaction' : txAction?.action === 'FLAG' ? 'Flag transaction' : 'Reverse transaction'}
            </DialogTitle>
            <DialogDescription>
              {txAction?.tx.description} · {formatCurrency(txAction?.tx.amount || 0)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Reason / note (optional)</Label>
            <Input value={txReason} onChange={(e) => setTxReason(e.target.value)} placeholder="e.g. Customer verification completed" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTxAction(null)}>Cancel</Button>
            <Button
              onClick={performTxAction}
              disabled={acting}
              className={`arvest-gradient text-white ${txAction?.action === 'FLAG' ? '!bg-amber-600' : ''} ${txAction?.action === 'DECLINE' || txAction?.action === 'REVERSE' ? '!bg-destructive' : ''}`}
            >
              {acting ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : null}
              Confirm {txAction?.action.toLowerCase()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KpiTile({ icon: Icon, label, value, sub, accent }: { icon: any; label: string; value: string; sub?: string; accent?: 'amber' }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[11px] text-muted-foreground tracking-wider uppercase mb-1">{label}</div>
            <div className="font-serif-display text-2xl">{value}</div>
            {sub && <div className="text-[11px] text-muted-foreground mt-1">{sub}</div>}
          </div>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${accent === 'amber' ? 'bg-amber-100 text-amber-700' : 'bg-primary/10 text-primary'}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
