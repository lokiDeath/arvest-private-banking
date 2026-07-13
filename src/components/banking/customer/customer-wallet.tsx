'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Bitcoin, Plus, Trash2, ArrowRight, Eye, EyeOff, Loader2, ShieldAlert,
  Copy, ChevronRight, ArrowDownLeft, ArrowUpRight, Wallet as WalletIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '@/lib/store';

interface Wallet {
  id: string; walletType: string; address: string; privateKey: string;
  balance: number; label: string | null; createdAt: string;
}

interface WalletTransaction {
  id: string; type: string; amount: number; currency: string;
  toAddress: string | null; fromAddress: string | null; status: string;
  txHash: string | null; memo: string | null; date: string;
}

const WALLET_TYPES = [
  { type: 'BTC', label: 'Bitcoin', icon: '₿', color: 'bg-amber-500' },
  { type: 'ETH', label: 'Ethereum', icon: 'Ξ', color: 'bg-blue-500' },
  { type: 'USDT', label: 'Tether', icon: '₮', color: 'bg-emerald-500' },
  { type: 'USD', label: 'USD Reserve', icon: '$', color: 'bg-primary' },
];

function maskAddress(addr: string): string {
  if (!addr) return '';
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function CustomerWallet() {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);
  const [revealKey, setRevealKey] = useState<{ key: string; label: string } | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);

  const [newType, setNewType] = useState('BTC');
  const [newLabel, setNewLabel] = useState('');
  const [importAddress, setImportAddress] = useState('');
  const [importLabel, setImportLabel] = useState('');

  // Send form
  const [sendTo, setSendTo] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [sendMemo, setSendMemo] = useState('');
  const [sending, setSending] = useState(false);

  async function load() {
    try {
      const res = await fetch('/api/wallet');
      const data = await res.json();
      setWallets(data.wallets || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function openWallet(w: Wallet) {
    setSelectedWallet(w);
    setLoadingTx(true);
    setSendTo(''); setSendAmount(''); setSendMemo('');
    try {
      const res = await fetch(`/api/wallet/${w.id}/transactions`);
      const data = await res.json();
      setTransactions(data.transactions || []);
    } finally {
      setLoadingTx(false);
    }
  }

  async function createWallet() {
    setCreating(true);
    try {
      const res = await fetch('/api/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletType: newType, label: newLabel || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Create failed'); return; }
      toast.success(`${newType} wallet created`);
      setShowCreateDialog(false);
      setNewLabel('');
      // Reveal the private key ONCE
      setRevealKey({ key: data.privateKeyRevealed, label: `${newType} Wallet` });
      load();
    } finally {
      setCreating(false);
    }
  }

  async function importWallet() {
    if (!importAddress.trim()) { toast.error('Enter an address to import'); return; }
    setImporting(true);
    try {
      const res = await fetch('/api/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ importAddress: importAddress.trim(), label: importLabel || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Import failed'); return; }
      toast.success(`${data.wallet?.walletType} wallet imported`);
      setShowImportDialog(false);
      setImportAddress(''); setImportLabel('');
      load();
    } finally {
      setImporting(false);
    }
  }

  async function deleteWallet(w: Wallet) {
    if (!confirm(`Delete ${w.walletType} wallet "${w.label || maskAddress(w.address)}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/wallet/${w.id}`, { method: 'DELETE' });
      if (!res.ok) { toast.error('Delete failed'); return; }
      toast.success('Wallet deleted');
      if (selectedWallet?.id === w.id) setSelectedWallet(null);
      load();
    } catch {
      toast.error('Delete failed');
    }
  }

  async function sendFunds() {
    if (!selectedWallet) return;
    const amt = parseFloat(sendAmount) || 0;
    if (!sendTo.trim()) { toast.error('Enter recipient address'); return; }
    if (amt <= 0) { toast.error('Enter a valid amount'); return; }
    if (amt > selectedWallet.balance) { toast.error('Insufficient wallet balance'); return; }
    setSending(true);
    try {
      const res = await fetch('/api/wallet/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletId: selectedWallet.id,
          toAddress: sendTo.trim(),
          amount: amt,
          memo: sendMemo || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Send failed'); return; }
      toast.success('Send submitted — pending review');
      setSendTo(''); setSendAmount(''); setSendMemo('');
      // Refresh transactions
      openWallet(selectedWallet);
      load();
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif-display text-2xl mb-1 flex items-center gap-2">
          <Bitcoin className="w-6 h-6 text-primary" /> Crypto Wallet
        </h1>
        <p className="text-sm text-muted-foreground">Generate or import a cryptocurrency wallet. All sends are pending review by your banker.</p>
      </div>

      {/* Security warning */}
      <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 border border-amber-200 text-[11px] text-amber-800">
        <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          <strong>Security:</strong> Arvest Private Banking's crypto wallet is a custodial demonstration. Never share your private key.
          Funds sent to wrong addresses cannot be recovered. Always verify the recipient address.
        </span>
      </div>

      {selectedWallet ? (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <Button variant="ghost" size="sm" className="mb-1 h-7 px-2" onClick={() => setSelectedWallet(null)}>
                  <ChevronRight className="w-3.5 h-3.5 rotate-180 mr-1" /> Back to wallets
                </Button>
                <CardTitle className="text-base flex items-center gap-2">
                  <WalletIcon className="w-4 h-4" /> {selectedWallet.label || selectedWallet.walletType + ' Wallet'}
                </CardTitle>
                <CardDescription className="text-xs font-mono mt-1">{selectedWallet.address}</CardDescription>
              </div>
              <Badge variant="outline" className="text-[10px]">{selectedWallet.walletType}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-md bg-muted/40">
              <div className="text-[11px] text-muted-foreground">Available balance</div>
              <div className="font-serif-display text-2xl">
                {selectedWallet.balance.toLocaleString('en-US', { maximumFractionDigits: 6 })} {selectedWallet.walletType}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="text-sm font-medium">Send {selectedWallet.walletType}</div>
                <div className="space-y-2">
                  <Label>Recipient address</Label>
                  <Input value={sendTo} onChange={(e) => setSendTo(e.target.value)} placeholder={`${selectedWallet.walletType} address`} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label>Amount</Label>
                    <Input type="number" inputMode="decimal" value={sendAmount} onChange={(e) => setSendAmount(e.target.value)} placeholder="0.0" />
                  </div>
                  <div className="space-y-2">
                    <Label>Memo</Label>
                    <Input value={sendMemo} onChange={(e) => setSendMemo(e.target.value)} placeholder="optional" />
                  </div>
                </div>
                <Button onClick={sendFunds} disabled={sending} className="w-full arvest-gradient text-white">
                  {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowUpRight className="w-4 h-4 mr-2" />}
                  Send
                </Button>
              </div>

              <div>
                <div className="text-sm font-medium mb-2">Recent transactions</div>
                <div className="space-y-2 max-h-64 overflow-y-auto arvest-scroll">
                  {loadingTx ? (
                    <div className="text-xs text-muted-foreground p-3">Loading…</div>
                  ) : transactions.length === 0 ? (
                    <div className="text-xs text-muted-foreground p-3 text-center">No transactions yet</div>
                  ) : transactions.map((tx) => {
                    const isSend = tx.type === 'SEND';
                    return (
                      <div key={tx.id} className="flex items-center gap-2 p-2 rounded-md border border-border text-xs">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center ${isSend ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {isSend ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownLeft className="w-3 h-3" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{isSend ? 'Sent' : 'Received'} {tx.amount} {tx.currency}</div>
                          <div className="text-[10px] text-muted-foreground truncate">
                            {isSend ? `To: ${maskAddress(tx.toAddress || '')}` : `From: ${maskAddress(tx.fromAddress || '')}`}
                          </div>
                        </div>
                        <Badge variant={tx.status === 'CONFIRMED' || tx.status === 'POSTED' ? 'default' : 'secondary'} className="text-[9px]">{tx.status}</Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteWallet(selectedWallet)}>
              <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete wallet
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setShowCreateDialog(true)} className="arvest-gradient text-white">
              <Plus className="w-4 h-4 mr-1.5" /> Generate new wallet
            </Button>
            <Button variant="outline" onClick={() => setShowImportDialog(true)}>
              <ArrowRight className="w-4 h-4 mr-1.5" /> Import external wallet
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {wallets.length === 0 ? (
              <Card className="md:col-span-2">
                <CardContent className="text-center py-12">
                  <Bitcoin className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
                  <div className="text-sm font-medium">No wallets yet</div>
                  <div className="text-xs text-muted-foreground mt-1">Generate a new wallet or import an existing one to get started.</div>
                </CardContent>
              </Card>
            ) : wallets.map((w) => (
              <Card key={w.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <button onClick={() => openWallet(w)} className="flex items-center gap-3 text-left flex-1 min-w-0">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold ${
                        WALLET_TYPES.find(t => t.type === w.walletType)?.color || 'bg-primary'
                      }`}>
                        {WALLET_TYPES.find(t => t.type === w.walletType)?.icon || '₿'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{w.label || `${w.walletType} Wallet`}</div>
                        <div className="text-[11px] text-muted-foreground font-mono truncate">{maskAddress(w.address)}</div>
                      </div>
                    </button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteWallet(w)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <Badge variant="outline" className="text-[10px]">{w.walletType}</Badge>
                    <div className="text-sm font-medium">
                      {w.balance.toLocaleString('en-US', { maximumFractionDigits: 6 })} {w.walletType}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Create wallet dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate New Wallet</DialogTitle>
            <DialogDescription>Choose a coin type. Your private key will be revealed once after creation — save it securely.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-4 gap-2">
              {WALLET_TYPES.map((t) => (
                <button
                  key={t.type}
                  onClick={() => setNewType(t.type)}
                  className={`p-3 rounded-lg border-2 flex flex-col items-center gap-1 transition-colors ${
                    newType === t.type ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${t.color}`}>
                    {t.icon}
                  </div>
                  <span className="text-[11px] font-medium">{t.label}</span>
                </button>
              ))}
            </div>
            <div className="space-y-2">
              <Label>Wallet label (optional)</Label>
              <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="e.g. My Bitcoin Wallet" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={createWallet} disabled={creating} className="arvest-gradient text-white">
              {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Generate wallet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import wallet dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import External Wallet</DialogTitle>
            <DialogDescription>
              Paste a public address. We'll auto-detect the chain:
              <span className="block mt-1 text-[11px]">bc1… = Bitcoin · 0x… = Ethereum · T… = USDT (TRC20)</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Wallet address</Label>
              <Input value={importAddress} onChange={(e) => setImportAddress(e.target.value)} placeholder="bc1… or 0x… or T…" className="font-mono text-xs" />
            </div>
            <div className="space-y-2">
              <Label>Label (optional)</Label>
              <Input value={importLabel} onChange={(e) => setImportLabel(e.target.value)} placeholder="e.g. Cold storage" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>Cancel</Button>
            <Button onClick={importWallet} disabled={importing} className="arvest-gradient text-white">
              {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRight className="w-4 h-4 mr-2" />}
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Private key reveal */}
      {revealKey && (
        <Dialog open={!!revealKey} onOpenChange={(o) => !o && setRevealKey(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-600" /> Save your private key
              </DialogTitle>
              <DialogDescription>
                This is the <strong>only time</strong> we will show your private key. Copy it and store it in a secure location. Arvest cannot recover it for you.
              </DialogDescription>
            </DialogHeader>
            <div className="py-2 space-y-2">
              <div className="p-3 rounded-md bg-muted/60 border border-border">
                <div className="text-[10px] text-muted-foreground tracking-wider mb-1">PRIVATE KEY — {revealKey.label}</div>
                <div className="font-mono text-xs break-all">{revealKey.key}</div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  navigator.clipboard.writeText(revealKey.key);
                  toast.success('Private key copied');
                }}
              >
                <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy private key
              </Button>
            </div>
            <DialogFooter>
              <Button onClick={() => setRevealKey(null)} className="arvest-gradient text-white">
                I've saved my key
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
