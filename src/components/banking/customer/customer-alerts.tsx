'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { safeJsonFetch } from '@/lib/safe-fetch';
import { formatCurrency } from '@/lib/store';
import {
  Bell, BellPlus, Trash2, Loader2, DollarSign, TrendingDown, CreditCard,
  ArrowDownLeft, ArrowUpRight, Banknote, Shield,
} from 'lucide-react';

type AlertType =
  | 'DEPOSIT'
  | 'LOW_BALANCE'
  | 'LARGE_PURCHASE'
  | 'CARD_USE'
  | 'DIRECT_DEPOSIT'
  | 'LARGE_WITHDRAWAL';

interface Account {
  id: string;
  type: string;
  nickname: string;
  accountNumber: string;
  balance: number;
}

interface Alert {
  id: string;
  type: AlertType;
  threshold: number | null;
  accountId: string | null;
  enabled: boolean;
  createdAt: string;
  account?: { id: string; nickname: string; accountNumber: string } | null;
}

const ALERT_TYPES: { value: AlertType; label: string; description: string; icon: any; needsThreshold: boolean; thresholdLabel?: string }[] = [
  { value: 'DEPOSIT',          label: 'Deposit posted',          description: 'Notify me when any deposit clears',            icon: ArrowDownLeft,    needsThreshold: false },
  { value: 'LOW_BALANCE',      label: 'Low balance',             description: 'Alert when balance drops below',               icon: TrendingDown,     needsThreshold: true,  thresholdLabel: 'Balance below' },
  { value: 'LARGE_PURCHASE',   label: 'Large purchase',          description: 'Alert on purchases over',                      icon: CreditCard,       needsThreshold: true,  thresholdLabel: 'Purchase over' },
  { value: 'CARD_USE',         label: 'Card used',               description: 'Notify me on every card transaction',          icon: Banknote,         needsThreshold: false },
  { value: 'DIRECT_DEPOSIT',   label: 'Direct deposit received', description: 'Notify me when a direct deposit arrives',      icon: DollarSign,       needsThreshold: false },
  { value: 'LARGE_WITHDRAWAL', label: 'Large withdrawal',        description: 'Alert on withdrawals over',                    icon: ArrowUpRight,     needsThreshold: true,  thresholdLabel: 'Withdrawal over' },
];

function alertMeta(type: AlertType) {
  return ALERT_TYPES.find(a => a.value === type) || ALERT_TYPES[0];
}

export function CustomerAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form
  const [type, setType] = useState<AlertType>('LOW_BALANCE');
  const [threshold, setThreshold] = useState('');
  const [accountId, setAccountId] = useState<string>('ALL');
  const [enabled, setEnabled] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [aData, alertsData] = await Promise.all([
        safeJsonFetch('/api/accounts').catch(() => ({ accounts: [] })),
        safeJsonFetch('/api/alerts').catch(() => ({ alerts: [] })),
      ]);
      setAccounts(aData.accounts || []);
      setAlerts(alertsData.alerts || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function submit() {
    const meta = alertMeta(type);
    if (meta.needsThreshold && (!threshold || parseFloat(threshold) <= 0)) {
      toast.error(`${meta.thresholdLabel} is required.`);
      return;
    }
    setSubmitting(true);
    try {
      await safeJsonFetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          threshold: meta.needsThreshold ? parseFloat(threshold) : null,
          accountId: accountId === 'ALL' ? null : accountId,
          enabled,
        }),
      });
      toast.success('Alert created');
      setThreshold('');
      load();
    } catch (e: any) {
      toast.error(e.message || 'Failed to create alert');
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleAlert(a: Alert, next: boolean) {
    // Optimistic update
    setAlerts(prev => prev.map(x => x.id === a.id ? { ...x, enabled: next } : x));
    try {
      await safeJsonFetch(`/api/alerts?id=${a.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next }),
      });
      toast.success(next ? 'Alert enabled' : 'Alert disabled');
    } catch (e: any) {
      // Revert on failure
      setAlerts(prev => prev.map(x => x.id === a.id ? { ...x, enabled: !next } : x));
      toast.error(e.message || 'Failed to update alert');
    }
  }

  async function deleteAlert(a: Alert) {
    if (!confirm(`Delete this ${alertMeta(a.type).label.toLowerCase()} alert?`)) return;
    try {
      await safeJsonFetch(`/api/alerts?id=${a.id}`, { method: 'DELETE' });
      toast.success('Alert deleted');
      load();
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete alert');
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

  const meta = alertMeta(type);
  const activeCount = alerts.filter(a => a.enabled).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif-display text-2xl mb-1">Account Alerts</h1>
        <p className="text-sm text-muted-foreground">Get notified about activity on your accounts — by push, email, or SMS.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card><CardContent className="p-4">
          <div className="text-[11px] text-muted-foreground tracking-wider mb-1">TOTAL ALERTS</div>
          <div className="font-mono-balance text-xl">{alerts.length}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-[11px] text-muted-foreground tracking-wider mb-1">ACTIVE</div>
          <div className="font-mono-balance text-xl">{activeCount}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-[11px] text-muted-foreground tracking-wider mb-1">PAUSED</div>
          <div className="font-mono-balance text-xl">{alerts.length - activeCount}</div>
        </CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create form */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BellPlus className="w-4 h-4" /> Create Alert
            </CardTitle>
            <CardDescription className="text-xs">Choose what to monitor and how you want to be notified.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Alert type</Label>
              <Select value={type} onValueChange={(v) => setType(v as AlertType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ALERT_TYPES.map(a => {
                    const Icon = a.icon;
                    return (
                      <SelectItem key={a.value} value={a.value}>
                        <span className="inline-flex items-center gap-2">
                          <Icon className="w-3.5 h-3.5" /> {a.label}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">{meta.description}.</p>
            </div>

            {meta.needsThreshold && (
              <div className="space-y-2">
                <Label>{meta.thresholdLabel}</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    type="number" step="0.01" min="0"
                    className="pl-7 font-mono-balance"
                    placeholder="0.00"
                    value={threshold}
                    onChange={(e) => setThreshold(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Account</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All accounts</SelectItem>
                  {accounts.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.nickname} · {formatCurrency(a.balance)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-border">
              <div>
                <div className="text-sm font-medium">Enable alert immediately</div>
                <div className="text-[11px] text-muted-foreground">Turn off to save without activating</div>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>

            <div className="flex justify-end pt-2 border-t border-border">
              <Button
                onClick={submit}
                disabled={submitting || (meta.needsThreshold && (!threshold || parseFloat(threshold) <= 0))}
                className="arvest-gradient text-white"
              >
                {submitting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating…</>
                ) : (
                  <><BellPlus className="w-4 h-4 mr-2" /> Create alert</>
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
                <Shield className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Notification channels</span>
              </div>
              <ul className="text-[11px] text-muted-foreground space-y-1.5">
                <li>· Push notifications (mobile app)</li>
                <li>· Email to your address on file</li>
                <li>· SMS to your mobile (carrier fees may apply)</li>
                <li>· Manage delivery in Profile & Settings</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Active alerts list */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="w-4 h-4" /> My Alerts ({alerts.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-sm text-muted-foreground">No alerts configured</p>
              <p className="text-xs text-muted-foreground mt-1">Create one above to stay informed about your accounts</p>
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.map(a => {
                const meta = alertMeta(a.type);
                const Icon = meta.icon;
                return (
                  <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/40">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${a.enabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{meta.label}</span>
                        {a.enabled
                          ? <Badge className="text-[9px] h-4 px-1.5 bg-emerald-600">Active</Badge>
                          : <Badge variant="secondary" className="text-[9px] h-4 px-1.5">Paused</Badge>}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                        {meta.needsThreshold && a.threshold ? `${meta.thresholdLabel} ${formatCurrency(a.threshold)} · ` : ''}
                        {a.accountId ? (a.account?.nickname || 'Selected account') : 'All accounts'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Switch
                        checked={a.enabled}
                        onCheckedChange={(next) => toggleAlert(a, next)}
                      />
                      <button
                        onClick={() => deleteAlert(a)}
                        className="p-1.5 rounded-md hover:bg-destructive/10 text-destructive transition-colors"
                        title="Delete alert"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
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
