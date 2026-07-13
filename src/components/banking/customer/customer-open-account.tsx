'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { safeJsonFetch } from '@/lib/safe-fetch';
import { formatCurrency } from '@/lib/store';
import {
  Wallet, PiggyBank, Sparkles, Loader2, CheckCircle2, Copy, Plus,
} from 'lucide-react';

type AccountType = 'CHECKING' | 'SAVINGS';

interface AccountTypeMeta {
  icon: any;
  label: string;
  description: string;
  features: string[];
  interestRate?: number;
}

const ACCOUNT_TYPES: Record<AccountType, AccountTypeMeta> = {
  CHECKING: {
    icon: Wallet,
    label: 'Checking',
    description: 'Everyday spending with debit card access',
    features: ['No monthly fee with direct deposit', 'Free debit card', 'Unlimited transactions', 'Mobile check deposit'],
  },
  SAVINGS: {
    icon: PiggyBank,
    label: 'Savings',
    description: 'Earn interest on your idle cash',
    features: ['Competitive APY', 'FDIC insured', 'No minimum balance', 'Transfer to checking anytime'],
    interestRate: 4.35,
  },
};

interface CreatedAccount {
  accountNumber: string;
  routingNumber: string;
  nickname: string;
  type: AccountType;
  initialDeposit: number;
}

export function CustomerOpenAccount() {
  const [accountType, setAccountType] = useState<AccountType>('CHECKING');
  const [nickname, setNickname] = useState('');
  const [initialDeposit, setInitialDeposit] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<CreatedAccount | null>(null);

  const meta = ACCOUNT_TYPES[accountType];
  const deposit = parseFloat(initialDeposit) || 0;

  async function submit() {
    if (deposit < 0) { toast.error('Initial deposit cannot be negative.'); return; }
    setSubmitting(true);
    try {
      const data = await safeJsonFetch('/api/open-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: accountType,
          nickname: nickname || `${meta.label} account`,
          initialDeposit: deposit,
        }),
      });
      setCreated({
        accountNumber: data.account?.accountNumber || data.accountNumber || '—',
        routingNumber: data.account?.routingNumber || data.routingNumber || '082900663',
        nickname: data.account?.nickname || nickname || `${meta.label} account`,
        type: accountType,
        initialDeposit: deposit,
      });
      toast.success('Account opened successfully');
    } catch (e: any) {
      toast.error(e.message || 'Failed to open account');
    } finally {
      setSubmitting(false);
    }
  }

  function copyValue(label: string, value: string) {
    navigator.clipboard?.writeText(value);
    toast.success(`${label} copied`);
  }

  function reset() {
    setCreated(null);
    setAccountType('CHECKING');
    setNickname('');
    setInitialDeposit('');
  }

  // ===== Success screen =====
  if (created) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <Card>
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-9 h-9 text-emerald-600" />
            </div>
            <h2 className="font-serif-display text-2xl mb-2">Welcome to {created.nickname}</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Your new {ACCOUNT_TYPES[created.type].label.toLowerCase()} account is open and ready to use. Funds from your initial deposit are available immediately.
            </p>

            <div className="space-y-3 text-left">
              <div className="p-4 rounded-lg bg-muted/40 border border-border">
                <div className="text-[10px] text-muted-foreground tracking-wider mb-1">ACCOUNT NUMBER</div>
                <div className="flex items-center justify-between gap-2">
                  <code className="font-mono-balance text-lg">{created.accountNumber}</code>
                  <Button size="sm" variant="ghost" onClick={() => copyValue('Account number', created.accountNumber)}>
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              <div className="p-4 rounded-lg bg-muted/40 border border-border">
                <div className="text-[10px] text-muted-foreground tracking-wider mb-1">ROUTING NUMBER</div>
                <div className="flex items-center justify-between gap-2">
                  <code className="font-mono-balance text-lg">{created.routingNumber}</code>
                  <Button size="sm" variant="ghost" onClick={() => copyValue('Routing number', created.routingNumber)}>
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-lg bg-muted/40 border border-border">
                  <div className="text-[10px] text-muted-foreground tracking-wider mb-1">TYPE</div>
                  <div className="text-sm font-medium">{ACCOUNT_TYPES[created.type].label}</div>
                </div>
                <div className="p-4 rounded-lg bg-muted/40 border border-border">
                  <div className="text-[10px] text-muted-foreground tracking-wider mb-1">OPENING BALANCE</div>
                  <div className="font-mono-balance text-lg">{formatCurrency(created.initialDeposit)}</div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
              <Button onClick={reset} className="arvest-gradient text-white">
                <Plus className="w-4 h-4 mr-2" /> Open another account
              </Button>
              <Button variant="outline" onClick={() => window.location.hash = '/accounts'}>
                View my accounts
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="p-4 rounded-lg bg-muted/30 border border-border text-xs text-muted-foreground leading-relaxed">
          <strong className="text-foreground">Next steps:</strong> Your debit card will arrive in 5–7 business days. Enable direct deposit by sharing your account and routing number with your employer. Activate online banking features from your dashboard.
        </div>
      </div>
    );
  }

  // ===== Form =====
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif-display text-2xl mb-1">Open a New Account</h1>
        <p className="text-sm text-muted-foreground">Open a new checking or savings account in minutes. FDIC insured up to $250,000 per depositor.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> Choose Your Account
            </CardTitle>
            <CardDescription className="text-xs">Pick the account type that fits your needs.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Account type radio cards */}
            <div>
              <Label className="mb-2 block">Account type</Label>
              <RadioGroup
                value={accountType}
                onValueChange={(v) => setAccountType(v as AccountType)}
                className="grid grid-cols-1 md:grid-cols-2 gap-3"
              >
                {(Object.keys(ACCOUNT_TYPES) as AccountType[]).map(t => {
                  const m = ACCOUNT_TYPES[t];
                  const Icon = m.icon;
                  const active = accountType === t;
                  return (
                    <label key={t} htmlFor={`acct-${t}`}>
                      <div className={`p-4 rounded-lg border-2 transition-colors h-full ${active ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}>
                        <div className="flex items-center justify-between mb-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${active ? 'arvest-gradient text-white' : 'bg-muted text-muted-foreground'}`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <RadioGroupItem value={t} id={`acct-${t}`} />
                        </div>
                        <div className="text-base font-medium">{m.label}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{m.description}</div>
                        <ul className="mt-3 space-y-1">
                          {m.features.map(f => (
                            <li key={f} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                              <CheckCircle2 className="w-3 h-3 text-primary mt-0.5 shrink-0" /> {f}
                            </li>
                          ))}
                        </ul>
                        {m.interestRate && (
                          <div className="mt-3 text-xs text-primary font-medium">{m.interestRate}% APY</div>
                        )}
                      </div>
                    </label>
                  );
                })}
              </RadioGroup>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Account nickname (optional)</Label>
                <Input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder={`My ${meta.label}`} />
              </div>
              <div className="space-y-2">
                <Label>Initial deposit (USD)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    type="number" step="0.01" min="0"
                    className="pl-7 h-11 text-lg font-mono-balance"
                    placeholder="0.00"
                    value={initialDeposit}
                    onChange={(e) => setInitialDeposit(e.target.value)}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">Minimum to open: $0 · No minimum balance</p>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-border">
              <Button
                onClick={submit}
                disabled={submitting || deposit < 0}
                className="arvest-gradient text-white"
              >
                {submitting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Opening account…</>
                ) : (
                  <>Open {meta.label} account</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card className="bg-muted/30">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Why Arvest?</span>
              </div>
              <ul className="text-[11px] text-muted-foreground space-y-1.5">
                <li>· FDIC insured to $250,000</li>
                <li>· 24/7 mobile & online banking</li>
                <li>· No overdraft fees on debit</li>
                <li>· Free access to 1,200+ ATMs</li>
                <li>· Private banker on call</li>
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="text-[11px] text-muted-foreground tracking-wider mb-1">OPENING WITH</div>
              <div className="font-mono-balance text-2xl">{formatCurrency(deposit)}</div>
              <div className="text-xs text-muted-foreground mt-1">initial deposit</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
