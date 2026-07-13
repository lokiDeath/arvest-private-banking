'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { safeJsonFetch } from '@/lib/safe-fetch';
import { formatCurrency, formatDate } from '@/lib/store';
import {
  Camera, ImagePlus, Loader2, CheckCircle2, Clock, XCircle, FileCheck2,
  ArrowUpRight, Shield,
} from 'lucide-react';

interface Account {
  id: string;
  type: string;
  nickname: string;
  accountNumber: string;
  balance: number;
}

interface Deposit {
  id: string;
  amount: number;
  checkNumber: string | null;
  memo: string | null;
  status: string;
  createdAt: string;
  account: { id: string; nickname: string; accountNumber: string } | null;
}

/**
 * Compress an image File to a JPEG data URL no larger than 800px on the
 * longest edge, quality 0.7. Returns a data URL string.
 */
async function compressImage(file: File, maxSize = 800, quality = 0.7): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = dataUrl;
  });
  let { width, height } = img;
  if (width > maxSize || height > maxSize) {
    if (width >= height) {
      height = Math.round((height * maxSize) / width);
      width = maxSize;
    } else {
      width = Math.round((width * maxSize) / height);
      height = maxSize;
    }
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', quality);
}

export function CustomerDeposit() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [accountId, setAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [checkNumber, setCheckNumber] = useState('');
  const [memo, setMemo] = useState('');
  const [frontPhoto, setFrontPhoto] = useState<string | null>(null);
  const [backPhoto, setBackPhoto] = useState<string | null>(null);
  const [compressing, setCompressing] = useState<'front' | 'back' | null>(null);

  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    try {
      const aData = await safeJsonFetch('/api/accounts').catch(() => ({ accounts: [] }));
      const dData = await safeJsonFetch('/api/check-deposit').catch(() => ({ deposits: [] }));
      setAccounts(aData.accounts || []);
      setDeposits(dData.deposits || []);
      if (aData.accounts?.[0]) setAccountId(aData.accounts[0].id);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleFile(file: File, side: 'front' | 'back') {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file.');
      return;
    }
    setCompressing(side);
    try {
      const compressed = await compressImage(file);
      if (side === 'front') setFrontPhoto(compressed); else setBackPhoto(compressed);
      toast.success(`${side === 'front' ? 'Front' : 'Back'} of check uploaded`);
    } catch {
      toast.error('Could not process that image.');
    } finally {
      setCompressing(null);
    }
  }

  function reset() {
    setAmount('');
    setCheckNumber('');
    setMemo('');
    setFrontPhoto(null);
    setBackPhoto(null);
    if (frontInputRef.current) frontInputRef.current.value = '';
    if (backInputRef.current) backInputRef.current.value = '';
  }

  async function submit() {
    const amt = parseFloat(amount);
    if (!accountId) { toast.error('Select a deposit account.'); return; }
    if (!amt || amt <= 0) { toast.error('Enter a valid amount.'); return; }
    if (!frontPhoto || !backPhoto) { toast.error('Upload both sides of the check.'); return; }

    setSubmitting(true);
    try {
      await safeJsonFetch('/api/check-deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          amount: amt,
          checkNumber: checkNumber || null,
          memo: memo || null,
          frontImage: frontPhoto,
          backImage: backPhoto,
        }),
      });
      toast.success('Deposit submitted · pending review');
      reset();
      const dData = await safeJsonFetch('/api/check-deposit').catch(() => ({ deposits: [] }));
      setDeposits(dData.deposits || []);
    } catch (e: any) {
      toast.error(e.message || 'Deposit failed');
    } finally {
      setSubmitting(false);
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

  const pending = deposits.filter(d => d.status === 'PENDING');
  const cleared = deposits.filter(d => d.status === 'CLEARED' || d.status === 'POSTED');

  function statusBadge(status: string) {
    if (status === 'PENDING') return <Badge variant="secondary" className="text-[10px] gap-1"><Clock className="w-2.5 h-2.5" /> Pending</Badge>;
    if (status === 'CLEARED' || status === 'POSTED') return <Badge className="text-[10px] gap-1 bg-emerald-600"><CheckCircle2 className="w-2.5 h-2.5" /> Cleared</Badge>;
    if (status === 'FAILED' || status === 'REJECTED') return <Badge variant="destructive" className="text-[10px] gap-1"><XCircle className="w-2.5 h-2.5" /> Rejected</Badge>;
    return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif-display text-2xl mb-1">Mobile Check Deposit</h1>
        <p className="text-sm text-muted-foreground">Snap a photo of your check and deposit it from anywhere. Funds typically clear in 1–2 business days.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card><CardContent className="p-4">
          <div className="text-[11px] text-muted-foreground tracking-wider mb-1">PENDING</div>
          <div className="font-mono-balance text-xl">{pending.length} {pending.length === 1 ? 'deposit' : 'deposits'}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-[11px] text-muted-foreground tracking-wider mb-1">TOTAL CLEARED</div>
          <div className="font-mono-balance text-xl">{formatCurrency(cleared.reduce((s, d) => s + d.amount, 0))}</div>
        </CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Camera className="w-4 h-4" /> New Deposit
            </CardTitle>
            <CardDescription className="text-xs">Endorse the back of your check with “For Mobile Deposit Only · Arvest” before capturing.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Deposit to</Label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                  <SelectContent>
                    {accounts.map(a => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.nickname} · {formatCurrency(a.balance)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Amount (USD)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    type="number" step="0.01" min="0"
                    className="pl-7 h-11 text-lg font-mono-balance"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Check number (optional)</Label>
                <Input value={checkNumber} onChange={(e) => setCheckNumber(e.target.value)} placeholder="e.g. 1042" />
              </div>
              <div className="space-y-2">
                <Label>Memo (optional)</Label>
                <Input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="e.g. Birthday gift" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              {/* Front */}
              <div className="space-y-2">
                <Label>Front of check</Label>
                <button
                  type="button"
                  onClick={() => frontInputRef.current?.click()}
                  className="relative w-full aspect-[4/3] rounded-lg border-2 border-dashed border-border hover:border-primary/60 hover:bg-primary/5 transition-colors overflow-hidden flex items-center justify-center group"
                >
                  {frontPhoto ? (
                    <img src={frontPhoto} alt="Front of check" className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <div className="text-center text-xs text-muted-foreground">
                      {compressing === 'front' ? (
                        <><Loader2 className="w-5 h-5 mx-auto mb-1 animate-spin" /> Processing…</>
                      ) : (
                        <><ImagePlus className="w-5 h-5 mx-auto mb-1" /> Tap to upload</>
                      )}
                    </div>
                  )}
                </button>
                <input
                  ref={frontInputRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f, 'front'); }}
                />
              </div>
              {/* Back */}
              <div className="space-y-2">
                <Label>Back of check</Label>
                <button
                  type="button"
                  onClick={() => backInputRef.current?.click()}
                  className="relative w-full aspect-[4/3] rounded-lg border-2 border-dashed border-border hover:border-primary/60 hover:bg-primary/5 transition-colors overflow-hidden flex items-center justify-center group"
                >
                  {backPhoto ? (
                    <img src={backPhoto} alt="Back of check" className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <div className="text-center text-xs text-muted-foreground">
                      {compressing === 'back' ? (
                        <><Loader2 className="w-5 h-5 mx-auto mb-1 animate-spin" /> Processing…</>
                      ) : (
                        <><ImagePlus className="w-5 h-5 mx-auto mb-1" /> Tap to upload</>
                      )}
                    </div>
                  )}
                </button>
                <input
                  ref={backInputRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f, 'back'); }}
                />
              </div>
            </div>

            <div className="p-3 rounded-md bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
              <Shield className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>Images are auto-compressed to 800px JPEG before upload. Daily deposit limit: $25,000. Deposits over $5,000 require banker review.</span>
            </div>

            <div className="flex items-center justify-between gap-3 pt-4 border-t border-border">
              <Button variant="ghost" size="sm" onClick={reset} disabled={submitting}>Clear</Button>
              <Button
                onClick={submit}
                disabled={submitting || !accountId || !amount || parseFloat(amount) <= 0 || !frontPhoto || !backPhoto}
                className="arvest-gradient text-white"
              >
                {submitting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting…</>
                ) : (
                  <><FileCheck2 className="w-4 h-4 mr-2" /> Submit deposit</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Sidebar: limits + tips */}
        <div className="space-y-4">
          <Card className="bg-muted/30">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Deposit limits</span>
              </div>
              <ul className="text-[11px] text-muted-foreground space-y-1.5">
                <li>· Daily limit: $25,000</li>
                <li>· 30-day limit: $75,000</li>
                <li>· Items over $5,000 reviewed</li>
                <li>· 256-bit encrypted upload</li>
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="text-xs text-muted-foreground tracking-wider mb-1">PENDING REVIEW</div>
              <div className="font-mono-balance text-2xl">{formatCurrency(pending.reduce((s, d) => s + d.amount, 0))}</div>
              <div className="text-xs text-muted-foreground mt-1">across {pending.length} {pending.length === 1 ? 'deposit' : 'deposits'}</div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowUpRight className="w-4 h-4" /> Deposit History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {deposits.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">No deposits yet. Submit one above to get started.</div>
          ) : (
            <div className="space-y-1 max-h-[400px] overflow-y-auto arvest-scroll">
              {deposits.map(d => (
                <div key={d.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/40 border-b border-border last:border-0">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <ArrowUpRight className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">
                        {d.account?.nickname || 'Account'} deposit
                      </span>
                      <span className="font-mono-balance text-sm shrink-0">+{formatCurrency(d.amount)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <span className="text-[11px] text-muted-foreground truncate">
                        {d.checkNumber ? `Check #${d.checkNumber} · ` : ''}{formatDate(d.createdAt)}{d.memo ? ` · ${d.memo}` : ''}
                      </span>
                      {statusBadge(d.status)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
