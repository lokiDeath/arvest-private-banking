'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { safeJsonFetch } from '@/lib/safe-fetch';
import { formatCurrency, formatDate } from '@/lib/store';
import {
  Car, User, Home, GraduationCap, Loader2, CheckCircle2, Clock, XCircle, FileText, Calculator,
} from 'lucide-react';

type LoanType = 'AUTO' | 'PERSONAL' | 'HOME' | 'STUDENT';

interface LoanTypeMeta {
  icon: any;
  label: string;
  description: string;
  rateMin: number; // APR %
  rateMax: number;
  maxAmount: number;
}

const LOAN_TYPES: Record<LoanType, LoanTypeMeta> = {
  AUTO:     { icon: Car,            label: 'Auto Loan',     description: 'New or used vehicle financing',  rateMin: 4.99,  rateMax: 8.99,  maxAmount: 100000 },
  PERSONAL: { icon: User,           label: 'Personal Loan', description: 'Flexible use, unsecured',        rateMin: 8.99,  rateMax: 16.99, maxAmount: 50000  },
  HOME:     { icon: Home,           label: 'Home Loan',     description: 'Mortgage or refinance',          rateMin: 5.49,  rateMax: 7.49,  maxAmount: 2000000 },
  STUDENT:  { icon: GraduationCap,  label: 'Student Loan',  description: 'Refinance or new student loan', rateMin: 4.49,  rateMax: 9.99,  maxAmount: 200000 },
};

interface Loan {
  id: string;
  type: LoanType;
  amount: number;
  termMonths: number;
  purpose: string | null;
  employer: string | null;
  annualIncome: number | null;
  status: string;
  apr: number | null;
  monthlyPayment: number | null;
  createdAt: string;
}

export function CustomerLoans() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [loanType, setLoanType] = useState<LoanType>('AUTO');
  const [amount, setAmount] = useState('');
  const [term, setTerm] = useState('36');
  const [purpose, setPurpose] = useState('');
  const [employer, setEmployer] = useState('');
  const [annualIncome, setAnnualIncome] = useState('');

  async function load() {
    setLoading(true);
    try {
      const data = await safeJsonFetch('/api/loans').catch(() => ({ loans: [] }));
      setLoans(data.loans || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const meta = LOAN_TYPES[loanType];
  const amtNum = parseFloat(amount) || 0;
  const termNum = parseInt(term, 10);
  const apr = (meta.rateMin + meta.rateMax) / 2;
  // Simple amortization: M = P * r(1+r)^n / ((1+r)^n - 1)
  const r = apr / 100 / 12;
  const estMonthly = amtNum > 0 && termNum > 0
    ? amtNum * r * Math.pow(1 + r, termNum) / (Math.pow(1 + r, termNum) - 1)
    : 0;

  function exceedsMax(amt: number) { return amt > meta.maxAmount; }

  async function submit() {
    if (!amtNum || amtNum <= 0) { toast.error('Enter a valid loan amount.'); return; }
    if (exceedsMax(amtNum)) { toast.error(`Maximum for ${meta.label}: ${formatCurrency(meta.maxAmount)}`); return; }
    if (!employer.trim()) { toast.error('Employer is required.'); return; }
    if (!annualIncome || parseFloat(annualIncome) <= 0) { toast.error('Annual income is required.'); return; }

    setSubmitting(true);
    try {
      await safeJsonFetch('/api/loans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: loanType,
          amount: amtNum,
          termMonths: termNum,
          purpose: purpose || null,
          employer,
          annualIncome: parseFloat(annualIncome),
        }),
      });
      toast.success('Loan application submitted · pending review');
      setAmount(''); setPurpose(''); setEmployer(''); setAnnualIncome('');
      load();
    } catch (e: any) {
      toast.error(e.message || 'Application failed');
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

  const pending = loans.filter(l => l.status === 'PENDING' || l.status === 'UNDER_REVIEW');
  const active = loans.filter(l => l.status === 'APPROVED' || l.status === 'ACTIVE');

  function statusBadge(status: string) {
    if (status === 'PENDING' || status === 'UNDER_REVIEW') return <Badge variant="secondary" className="text-[10px] gap-1"><Clock className="w-2.5 h-2.5" /> {status === 'UNDER_REVIEW' ? 'Under review' : 'Pending'}</Badge>;
    if (status === 'APPROVED' || status === 'ACTIVE') return <Badge className="text-[10px] gap-1 bg-emerald-600"><CheckCircle2 className="w-2.5 h-2.5" /> Approved</Badge>;
    if (status === 'DECLINED' || status === 'REJECTED') return <Badge variant="destructive" className="text-[10px] gap-1"><XCircle className="w-2.5 h-2.5" /> Declined</Badge>;
    return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif-display text-2xl mb-1">Loans & Credit</h1>
        <p className="text-sm text-muted-foreground">Apply for a new loan or check the status of existing applications. Decisions typically take 1–3 business days.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <div className="text-[11px] text-muted-foreground tracking-wider mb-1">PENDING</div>
          <div className="font-mono-balance text-xl">{pending.length}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-[11px] text-muted-foreground tracking-wider mb-1">ACTIVE</div>
          <div className="font-mono-balance text-xl">{active.length}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-[11px] text-muted-foreground tracking-wider mb-1">TOTAL BORROWED</div>
          <div className="font-mono-balance text-xl">{formatCurrency(active.reduce((s, l) => s + l.amount, 0))}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-[11px] text-muted-foreground tracking-wider mb-1">MONTHLY PAYMENTS</div>
          <div className="font-mono-balance text-xl">{formatCurrency(active.reduce((s, l) => s + (l.monthlyPayment || 0), 0))}</div>
        </CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Application form */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4" /> New Loan Application
            </CardTitle>
            <CardDescription className="text-xs">Choose a loan type to see estimated rates and payment.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Loan type radio cards */}
            <div>
              <Label className="mb-2 block">Loan type</Label>
              <RadioGroup
                value={loanType}
                onValueChange={(v) => setLoanType(v as LoanType)}
                className="grid grid-cols-2 md:grid-cols-4 gap-3"
              >
                {(Object.keys(LOAN_TYPES) as LoanType[]).map(t => {
                  const m = LOAN_TYPES[t];
                  const Icon = m.icon;
                  const active = loanType === t;
                  return (
                    <label key={t} htmlFor={`loan-${t}`} className={`cursor-pointer`}>
                      <div className={`p-3 rounded-lg border-2 transition-colors h-full ${active ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${active ? 'arvest-gradient text-white' : 'bg-muted text-muted-foreground'}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <RadioGroupItem value={t} id={`loan-${t}`} />
                        </div>
                        <div className="text-sm font-medium">{m.label}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{m.description}</div>
                        <div className="text-[10px] text-primary mt-1 font-medium">{m.rateMin}%–{m.rateMax}% APR</div>
                      </div>
                    </label>
                  );
                })}
              </RadioGroup>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Loan amount (USD)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    type="number" step="100" min="0"
                    className={`pl-7 h-11 text-lg font-mono-balance ${exceedsMax(amtNum) ? 'border-destructive' : ''}`}
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                {exceedsMax(amtNum) && (
                  <p className="text-xs text-destructive">Max for {meta.label}: {formatCurrency(meta.maxAmount)}</p>
                )}
                <p className="text-[10px] text-muted-foreground">Max: {formatCurrency(meta.maxAmount)}</p>
              </div>
              <div className="space-y-2">
                <Label>Term</Label>
                <Select value={term} onValueChange={setTerm}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="12">12 months (1 yr)</SelectItem>
                    <SelectItem value="24">24 months (2 yr)</SelectItem>
                    <SelectItem value="36">36 months (3 yr)</SelectItem>
                    <SelectItem value="48">48 months (4 yr)</SelectItem>
                    <SelectItem value="60">60 months (5 yr)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Purpose of loan</Label>
              <Textarea rows={2} value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder={`e.g. ${loanType === 'AUTO' ? '2024 Toyota Camry' : loanType === 'HOME' ? 'Primary residence purchase' : 'Debt consolidation'}`} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Employer</Label>
                <Input value={employer} onChange={(e) => setEmployer(e.target.value)} placeholder="Current employer" />
              </div>
              <div className="space-y-2">
                <Label>Annual income (USD)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    type="number" step="1000" min="0"
                    className="pl-7 font-mono-balance"
                    placeholder="0"
                    value={annualIncome}
                    onChange={(e) => setAnnualIncome(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Estimated payment summary */}
            <div className="p-4 rounded-lg bg-muted/40 border border-border">
              <div className="flex items-center gap-2 mb-3">
                <Calculator className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Estimated payment</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <div className="text-[10px] text-muted-foreground tracking-wider mb-1">APR</div>
                  <div className="font-mono-balance text-lg">{apr.toFixed(2)}%</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground tracking-wider mb-1">TERM</div>
                  <div className="font-mono-balance text-lg">{termNum} mo</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground tracking-wider mb-1">MONTHLY</div>
                  <div className="font-mono-balance text-lg">{estMonthly > 0 ? formatCurrency(estMonthly) : '—'}</div>
                </div>
              </div>
              <div className="text-[10px] text-muted-foreground mt-3">Estimate only. Final APR based on credit review. No commitment until you sign.</div>
            </div>

            <div className="flex justify-end pt-2 border-t border-border">
              <Button
                onClick={submit}
                disabled={submitting || !amount || amtNum <= 0 || exceedsMax(amtNum) || !employer || !annualIncome}
                className="arvest-gradient text-white"
              >
                {submitting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting…</>
                ) : (
                  <>Submit application</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card className="bg-muted/30">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Calculator className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Current rates</span>
              </div>
              <div className="space-y-2">
                {(Object.keys(LOAN_TYPES) as LoanType[]).map(t => {
                  const m = LOAN_TYPES[t];
                  const Icon = m.icon;
                  return (
                    <div key={t} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5">
                        <Icon className="w-3 h-3 text-muted-foreground" /> {m.label}
                      </span>
                      <span className="font-mono-balance">{m.rateMin}%–{m.rateMax}%</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Loans list */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4" /> My Applications ({loans.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loans.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">No applications yet. Submit one above to get started.</div>
          ) : (
            <div className="space-y-2">
              {loans.map(l => {
                const m = LOAN_TYPES[l.type];
                const Icon = m.icon;
                return (
                  <div key={l.id} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/40">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium truncate">{m.label}</span>
                        <span className="font-mono-balance text-sm shrink-0">{formatCurrency(l.amount)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <span className="text-[11px] text-muted-foreground truncate">
                          {l.termMonths} mo · {formatDate(l.createdAt)}{l.purpose ? ` · ${l.purpose}` : ''}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          {l.apr && <span className="text-[10px] text-muted-foreground">{l.apr.toFixed(2)}% APR</span>}
                          {statusBadge(l.status)}
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
  );
}
