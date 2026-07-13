'use client';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { safeJsonFetch } from '@/lib/safe-fetch';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/store';
import { Send, Loader2, AlertCircle, ArrowUpRight, ArrowDownLeft, Clock, CheckCircle2, XCircle } from 'lucide-react';

interface ZelleTransfer {
  id: string;
  recipientName: string;
  recipientEmail: string | null;
  recipientPhone: string | null;
  amount: number;
  memo: string | null;
  status: string;
  createdAt: string;
}

export function CustomerZelle() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<ZelleTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromAccountId, setFromAccountId] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [contactType, setContactType] = useState<'email' | 'phone'>('email');
  const [contactValue, setContactValue] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const aData = await safeJsonFetch('/api/accounts');
        const zData = await safeJsonFetch('/api/zelle').catch(() => ({ transfers: [] }));
        setAccounts(aData.accounts || []);
        setTransfers(zData.transfers || []);
        if (aData.accounts?.[0]) setFromAccountId(aData.accounts[0].id);
      } catch (e: any) {
        setError(e.message || 'Failed to load data');
      } finally { setLoading(false); }
    })();
  }, []);

  async function submit() {
    if (!fromAccountId || !recipientName || !contactValue || !amount) { toast.error('Fill all fields'); return; }
    setSubmitting(true);
    try {
      const body: any = { fromAccountId, recipientName, amount: parseFloat(amount), memo };
      if (contactType === 'email') body.recipientEmail = contactValue; else body.recipientPhone = contactValue;
      await safeJsonFetch('/api/zelle', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      toast.success('Zelle sent · pending admin approval');
      setRecipientName(''); setContactValue(''); setAmount(''); setMemo('');
      const zData = await safeJsonFetch('/api/zelle').catch(() => ({ transfers: [] }));
      setTransfers(zData.transfers || []);
    } catch (e: any) { toast.error(e.message || 'Failed'); }
    finally { setSubmitting(false); }
  }

  if (loading) return <div className="space-y-4"><div className="h-8 w-48 bg-muted animate-pulse rounded" /></div>;
  if (error) return <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/5 text-sm text-destructive flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div>;

  const totalSent = transfers.filter(t => t.status === 'SENT' || t.status === 'POSTED').reduce((s, t) => s + t.amount, 0);
  const pendingCount = transfers.filter(t => t.status === 'PENDING').length;

  function getStatusBadge(status: string) {
    if (status === 'PENDING') return <Badge variant="secondary" className="text-[10px] gap-1"><Clock className="w-2.5 h-2.5" /> Pending</Badge>;
    if (status === 'SENT' || status === 'POSTED') return <Badge className="text-[10px] gap-1 bg-emerald-600"><CheckCircle2 className="w-2.5 h-2.5" /> Sent</Badge>;
    if (status === 'FAILED' || status === 'DECLINED') return <Badge variant="destructive" className="text-[10px] gap-1"><XCircle className="w-2.5 h-2.5" /> Failed</Badge>;
    return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-serif-display text-2xl mb-1">Zelle</h1>
        <p className="text-sm text-muted-foreground">Send money to friends and family · pending admin approval</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card><CardContent className="p-4">
          <div className="text-[11px] text-muted-foreground tracking-wider mb-1">TOTAL SENT</div>
          <div className="font-mono-balance text-xl">{formatCurrency(totalSent)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-[11px] text-muted-foreground tracking-wider mb-1">PENDING</div>
          <div className="font-mono-balance text-xl">{pendingCount} {pendingCount === 1 ? 'payment' : 'payments'}</div>
        </CardContent></Card>
      </div>

      {/* Notice */}
      <div className="p-3 rounded-md bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
        Funds are sent after admin approval. This typically takes 1-2 business hours.
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Send form */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Send Money</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>From account</Label>
              <Select value={fromAccountId} onValueChange={setFromAccountId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.nickname} · {formatCurrency(a.balance)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Recipient name</Label>
              <Input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="John Doe" />
            </div>
            <div className="space-y-2">
              <Label>Contact method</Label>
              <Tabs value={contactType} onValueChange={(v) => setContactType(v as any)}>
                <TabsList className="grid grid-cols-2"><TabsTrigger value="email">Email</TabsTrigger><TabsTrigger value="phone">Phone</TabsTrigger></TabsList>
              </Tabs>
              <Input value={contactValue} onChange={(e) => setContactValue(e.target.value)} placeholder={contactType === 'email' ? 'john@example.com' : '+1 (555) 123-4567'} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Amount</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input type="number" step="0.01" className="pl-7 font-mono-balance" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Memo</Label>
                <Input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Dinner" />
              </div>
            </div>
            <Button onClick={submit} disabled={submitting} className="w-full arvest-gradient text-white">
              {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending…</> : <><Send className="w-4 h-4 mr-2" /> Send money</>}
            </Button>
          </CardContent>
        </Card>

        {/* Transaction history — professional bank style */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Transaction History</CardTitle>
          </CardHeader>
          <CardContent>
            {transfers.length === 0 ? (
              <div className="text-center py-12">
                <Send className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-40" />
                <p className="text-sm text-muted-foreground">No Zelle transfers yet</p>
                <p className="text-xs text-muted-foreground mt-1">Your sent payments will appear here</p>
              </div>
            ) : (
              <div className="space-y-1 max-h-[400px] overflow-y-auto arvest-scroll">
                {transfers.map((t, i) => (
                  <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/40 transition-colors border-b border-border last:border-0">
                    {/* Icon */}
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <ArrowUpRight className="w-4 h-4 text-primary" />
                    </div>
                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium truncate">{t.recipientName}</span>
                        <span className="font-mono-balance text-sm shrink-0">-{formatCurrency(t.amount)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <span className="text-[11px] text-muted-foreground truncate">
                          {t.recipientEmail || t.recipientPhone || '—'}
                          {t.memo ? ` · ${t.memo}` : ''}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-muted-foreground">{formatDate(t.createdAt)}</span>
                          {getStatusBadge(t.status)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
