'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { safeJsonFetch } from '@/lib/safe-fetch';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/store';
import {
  Bitcoin, Coins, DollarSign, Wallet as WalletIcon, Plus, Trash2, ArrowLeft,
  Send, Eye, EyeOff, ShieldAlert, Loader2, ArrowUpRight, ArrowDownLeft, KeyRound, Download,
} from 'lucide-react';

type WalletType = 'BTC' | 'ETH' | 'USDT' | 'USD';

interface Wallet {
  id: string;
  label: string;
  type: WalletType;
  address: string;
  balance: number;
  createdAt: string;
}

interface WalletTransaction {
  id: string;
  type: 'SEND' | 'RECEIVE';
  amount: number;
  toAddress: string | null;
  fromAddress: string | null;
  status: string;
  txHash: string | null;
  createdAt: string;
  memo: string | null;
}

const WALLET_TYPE_META: Record<WalletType, { icon: any; color: string; label: string }> = {
  BTC:   { icon: Bitcoin,     color: 'bg-amber-100 text-amber-700',      label: 'Bitcoin'   },
  ETH:   { icon: Coins,        color: 'bg-indigo-100 text-indigo-700',    label: 'Ethereum'  },
  USDT:  { icon: DollarSign,  color: 'bg-emerald-100 text-emerald-700',  label: 'Tether'    },
  USD:   { icon: DollarSign,  color: 'bg-slate-100 text-slate-700',      label: 'US Dollar' },
};

function detectWalletType(address: string): WalletType | null {
  const a = address.trim();
  if (!a) return null;
  if (a.startsWith('bc1')) return 'BTC';
  if (a.startsWith('0x')) return 'ETH';
  if (a.startsWith('T')) return 'USDT';
  return null;
}

// Generate a plausible-looking address for the given wallet type
function generateAddress(type: WalletType): string {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const rand = (n: number) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  switch (type) {
    case 'BTC':  return `bc1q${rand(38)}`;
    case 'ETH':  return `0x${rand(40)}`;
    case 'USDT': return `T${rand(33)}`;
    case 'USD':  return `ACCT-${rand(12).toUpperCase()}`;
  }
}

function generatePrivateKey(type: WalletType): string {
  const chars = '0123456789abcdef';
  const hex = (n: number) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  if (type === 'BTC') return `L${hex(51)}`;
  if (type === 'ETH') return `0x${hex(64)}`;
  if (type === 'USDT') return hex(64);
  return `PK-${hex(32).toUpperCase()}`;
}

export function CustomerWallet() {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Wallet | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Create form
  const [newType, setNewType] = useState<WalletType>('BTC');
  const [newLabel, setNewLabel] = useState('');
  const [creating, setCreating] = useState(false);

  // Import form
  const [importAddress, setImportAddress] = useState('');
  const [importLabel, setImportLabel] = useState('');
  const [importing, setImporting] = useState(false);

  // Private key reveal
  const [privKeyWallet, setPrivKeyWallet] = useState<Wallet | null>(null);
  const [privKeyValue, setPrivKeyValue] = useState<string | null>(null);
  const [privKeyRevealed, setPrivKeyRevealed] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await safeJsonFetch('/api/wallet').catch(() => ({ wallets: [] }));
      setWallets(data.wallets || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function createWallet() {
    setCreating(true);
    try {
      await safeJsonFetch('/api/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: newType, label: newLabel || `${WALLET_TYPE_META[newType].label} wallet` }),
      });
      toast.success(`${WALLET_TYPE_META[newType].label} wallet created`);
      setShowCreate(false);
      setNewLabel('');
      load();
    } catch (e: any) {
      toast.error(e.message || 'Failed to create wallet');
    } finally {
      setCreating(false);
    }
  }

  async function importWallet() {
    const type = detectWalletType(importAddress);
    if (!type) {
      toast.error('Could not detect wallet type. BTC addresses start with “bc1”, ETH with “0x”, USDT with “T”.');
      return;
    }
    setImporting(true);
    try {
      await safeJsonFetch('/api/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          label: importLabel || `Imported ${WALLET_TYPE_META[type].label} wallet`,
          address: importAddress,
          import: true,
        }),
      });
      toast.success(`${WALLET_TYPE_META[type].label} wallet imported`);
      setImportAddress('');
      setImportLabel('');
      load();
    } catch (e: any) {
      toast.error(e.message || 'Failed to import wallet');
    } finally {
      setImporting(false);
    }
  }

  async function deleteWallet(w: Wallet) {
    if (!confirm(`Delete wallet “${w.label}”? This cannot be undone.`)) return;
    try {
      await safeJsonFetch(`/api/wallet/${w.id}`, { method: 'DELETE' });
      toast.success('Wallet deleted');
      if (selected?.id === w.id) setSelected(null);
      load();
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete wallet');
    }
  }

  function revealPrivateKey(w: Wallet) {
    setPrivKeyWallet(w);
    setPrivKeyValue(generatePrivateKey(w.type));
    setPrivKeyRevealed(false);
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  // ===== Wallet detail view =====
  if (selected) {
    return <WalletDetail wallet={selected} onBack={() => setSelected(null)} onDelete={() => deleteWallet(selected)} onRevealKey={() => revealPrivateKey(selected)} />;
  }

  // ===== Private key reveal dialog =====
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif-display text-2xl mb-1">Crypto Wallet</h1>
        <p className="text-sm text-muted-foreground">Generate new wallets or import existing ones. Send crypto to any address.</p>
      </div>

      <div className="p-3 rounded-md bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
        <ShieldAlert className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span>Crypto wallets on Arvest Private Banking are simulated for demonstration. Never send real cryptocurrency to addresses generated here. No real blockchain transactions occur.</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Create new wallet */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="w-4 h-4" /> Generate New Wallet
            </CardTitle>
            <CardDescription className="text-xs">Pick a currency and give your wallet a nickname.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Currency</Label>
              <div className="grid grid-cols-4 gap-2">
                {(Object.keys(WALLET_TYPE_META) as WalletType[]).map(t => {
                  const meta = WALLET_TYPE_META[t];
                  const Icon = meta.icon;
                  const active = newType === t;
                  return (
                    <button
                      key={t}
                      onClick={() => setNewType(t)}
                      className={`flex flex-col items-center gap-1 py-2 rounded-md border transition-colors ${
                        active ? 'arvest-gradient text-white border-transparent' : 'border-border hover:border-primary/40'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-[10px] font-medium">{t}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Wallet label (optional)</Label>
              <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder={`My ${WALLET_TYPE_META[newType].label} wallet`} />
            </div>
            <Button onClick={() => setShowCreate(true)} className="w-full arvest-gradient text-white">
              <Plus className="w-4 h-4 mr-2" /> Generate wallet
            </Button>
          </CardContent>
        </Card>

        {/* Import external wallet */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Download className="w-4 h-4" /> Import External Wallet
            </CardTitle>
            <CardDescription className="text-xs">Paste a public address — we'll auto-detect the currency.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Wallet address</Label>
              <Input
                value={importAddress}
                onChange={(e) => setImportAddress(e.target.value)}
                placeholder="bc1… / 0x… / T…"
                className="font-mono text-xs"
              />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {(['BTC', 'ETH', 'USDT'] as WalletType[]).map(t => (
                  <span key={t} className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border ${
                    detectWalletType(importAddress) === t ? 'bg-primary text-white border-transparent' : 'border-border text-muted-foreground'
                  }`}>
                    {WALLET_TYPE_META[t].label}
                  </span>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Label (optional)</Label>
              <Input value={importLabel} onChange={(e) => setImportLabel(e.target.value)} placeholder="Imported wallet" />
            </div>
            <Button onClick={importWallet} disabled={importing || !importAddress} className="w-full">
              {importing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importing…</> : <><Download className="w-4 h-4 mr-2" /> Import wallet</>}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Wallet list */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <WalletIcon className="w-4 h-4" /> My Wallets ({wallets.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {wallets.length === 0 ? (
            <div className="text-center py-12">
              <WalletIcon className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-sm text-muted-foreground">No wallets yet</p>
              <p className="text-xs text-muted-foreground mt-1">Generate or import one above to get started</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {wallets.map(w => {
                const meta = WALLET_TYPE_META[w.type];
                const Icon = meta.icon;
                return (
                  <div key={w.id} className="p-4 rounded-lg border border-border hover:border-primary/40 transition-colors group">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center ${meta.color}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-sm font-medium">{w.label}</div>
                          <div className="text-[10px] text-muted-foreground">{meta.label} · {w.type}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => deleteWallet(w)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-destructive/10 text-destructive"
                        title="Delete wallet"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="font-mono-balance text-xl mb-1">
                      {w.type === 'USD' ? formatCurrency(w.balance) : `${w.balance.toLocaleString('en-US', { maximumFractionDigits: 8 })} ${w.type}`}
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono truncate mb-3">{w.address}</div>
                    <Button size="sm" variant="outline" className="w-full h-8 text-xs" onClick={() => setSelected(w)}>
                      Open wallet
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create confirmation dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate {WALLET_TYPE_META[newType].label} wallet?</DialogTitle>
            <DialogDescription>
              A new wallet address will be created. {newLabel ? `Label: “${newLabel}”.` : ''} You'll be able to send and receive simulated {WALLET_TYPE_META[newType].label} from this wallet.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={createWallet} disabled={creating} className="arvest-gradient text-white">
              {creating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating…</> : 'Generate wallet'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Private key reveal dialog */}
      <Dialog open={!!privKeyWallet} onOpenChange={(o) => { if (!o) { setPrivKeyWallet(null); setPrivKeyValue(null); setPrivKeyRevealed(false); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-4 h-4" /> Private Key
            </DialogTitle>
            <DialogDescription>
              Your private key grants full control of this wallet. Anyone with this key can spend its funds.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="p-3 rounded-md bg-destructive/10 border border-destructive/30 text-xs text-destructive flex items-start gap-2">
              <ShieldAlert className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <div>
                <strong>Never share this key with anyone.</strong> Arvest support will never ask for it. Store it offline in a secure location. This key will not be shown again.
              </div>
            </div>
            <div className="p-3 rounded-md bg-muted font-mono text-xs break-all min-h-12 flex items-center justify-center">
              {privKeyRevealed && privKeyValue ? privKeyValue : '••••••••••••••••••••••••••••••••'}
            </div>
            <div className="flex gap-2">
              {!privKeyRevealed ? (
                <Button variant="outline" className="flex-1" onClick={() => setPrivKeyRevealed(true)}>
                  <Eye className="w-4 h-4 mr-2" /> Reveal private key
                </Button>
              ) : (
                <Button variant="outline" className="flex-1" onClick={() => { if (privKeyValue) navigator.clipboard?.writeText(privKeyValue); toast.success('Copied to clipboard'); }}>
                  <KeyRound className="w-4 h-4 mr-2" /> Copy key
                </Button>
              )}
              <Button variant="outline" onClick={() => { setPrivKeyWallet(null); setPrivKeyValue(null); setPrivKeyRevealed(false); }}>Close</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===== Wallet detail sub-component =====
function WalletDetail({
  wallet, onBack, onDelete, onRevealKey,
}: {
  wallet: Wallet; onBack: () => void; onDelete: () => void; onRevealKey: () => void;
}) {
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');

  const meta = WALLET_TYPE_META[wallet.type];
  const Icon = meta.icon;

  async function loadTx() {
    setLoading(true);
    try {
      const data = await safeJsonFetch(`/api/wallet/${wallet.id}/transactions`).catch(() => ({ transactions: [] }));
      setTransactions(data.transactions || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadTx(); /* eslint-disable-next-line */ }, [wallet.id]);

  async function send() {
    const amt = parseFloat(amount);
    if (!toAddress) { toast.error('Enter a destination address'); return; }
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return; }
    if (amt > wallet.balance) { toast.error('Insufficient wallet balance'); return; }
    setSending(true);
    try {
      await safeJsonFetch('/api/wallet/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletId: wallet.id, toAddress, amount: amt, memo }),
      });
      toast.success('Transaction submitted · pending confirmation');
      setToAddress(''); setAmount(''); setMemo('');
      loadTx();
    } catch (e: any) {
      toast.error(e.message || 'Send failed');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Back to wallets
        </button>
        <Button variant="ghost" size="sm" onClick={onDelete} className="text-destructive hover:text-destructive">
          <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete
        </Button>
      </div>

      {/* Wallet header */}
      <Card className="arvest-gradient text-white">
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center">
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-medium">{wallet.label}</div>
                <div className="text-[11px] text-white/70">{meta.label} · {wallet.type}</div>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={onRevealKey} className="bg-white/10 border-white/20 text-white hover:bg-white/20">
              <KeyRound className="w-3.5 h-3.5 mr-1.5" /> Private key
            </Button>
          </div>
          <div className="font-mono-balance text-3xl mb-1">
            {wallet.type === 'USD' ? formatCurrency(wallet.balance) : `${wallet.balance.toLocaleString('en-US', { maximumFractionDigits: 8 })} ${wallet.type}`}
          </div>
          <div className="text-[11px] text-white/70 font-mono break-all">{wallet.address}</div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Send form */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Send className="w-4 h-4" /> Send {wallet.type}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>To address</Label>
              <Input value={toAddress} onChange={(e) => setToAddress(e.target.value)} placeholder={`Recipient ${wallet.type} address`} className="font-mono text-xs" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input type="number" step="0.0001" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="font-mono-balance" />
              </div>
              <div className="space-y-2">
                <Label>Memo (optional)</Label>
                <Input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Note" />
              </div>
            </div>
            <div className="text-[11px] text-muted-foreground">
              Available: <span className="font-medium text-foreground font-mono-balance">
                {wallet.type === 'USD' ? formatCurrency(wallet.balance) : `${wallet.balance} ${wallet.type}`}
              </span>
            </div>
            <Button onClick={send} disabled={sending || !toAddress || !amount} className="w-full arvest-gradient text-white">
              {sending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending…</> : <><Send className="w-4 h-4 mr-2" /> Send {wallet.type}</>}
            </Button>
          </CardContent>
        </Card>

        {/* Transaction history */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Transaction History</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-10">
                <Send className="w-7 h-7 text-muted-foreground mx-auto mb-2 opacity-40" />
                <p className="text-sm text-muted-foreground">No transactions yet</p>
              </div>
            ) : (
              <div className="space-y-1 max-h-[400px] overflow-y-auto arvest-scroll">
                {transactions.map(t => {
                  const isSend = t.type === 'SEND';
                  return (
                    <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/40 border-b border-border last:border-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isSend ? 'bg-destructive/10 text-destructive' : 'bg-emerald-100 text-emerald-700'}`}>
                        {isSend ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium truncate">{isSend ? 'Sent' : 'Received'}</span>
                          <span className={`font-mono-balance text-sm shrink-0 ${isSend ? 'text-destructive' : 'text-emerald-600'}`}>
                            {isSend ? '-' : '+'}{t.amount} {wallet.type}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <span className="text-[11px] text-muted-foreground truncate font-mono">
                            {isSend ? t.toAddress : t.fromAddress}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] text-muted-foreground">{formatDate(t.createdAt)}</span>
                            <Badge variant="outline" className="text-[9px] h-3.5 px-1">{t.status}</Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
