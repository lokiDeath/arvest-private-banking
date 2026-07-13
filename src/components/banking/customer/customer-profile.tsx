'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { AddressAutocomplete } from '@/components/banking/address-autocomplete';
import { toast } from 'sonner';
import { useAuth, formatCurrency, formatDate } from '@/lib/store';
import {
  User, Mail, Phone, MapPin, Lock, Bell, Eye, Shield, Loader2,
  Smartphone, CreditCard, CheckCircle2, Calendar,
} from 'lucide-react';

interface Account {
  id: string; type: string; nickname: string; accountNumber: string;
  routingNumber: string; balance: number; status: string; createdAt: string;
}

export function CustomerProfile({ onSuccess }: { onSuccess: () => void }) {
  const user = useAuth((s) => s.user);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loginId, setLoginId] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/profile');
        const data = await res.json();
        if (data.user) {
          setName(data.user.name || '');
          setEmail(data.user.email || '');
          setLoginId(data.user.loginId || '');
          setPhone(data.user.phone || '');
          setAddress(data.user.address || '');
          setAvatarUrl(data.user.avatarUrl || '');
        }
        const aRes = await fetch('/api/accounts');
        const aData = await aRes.json();
        setAccounts(aData.accounts || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function saveProfile() {
    setSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, loginId, phone, address }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to save');
        return;
      }
      toast.success('Profile updated');
      onSuccess();
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to change password');
        return;
      }
      toast.success('Password changed successfully');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } finally {
      setSaving(false);
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

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif-display text-2xl mb-1">Profile & Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your personal information, security, and preferences.</p>
      </div>

      {/* Profile header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-5">
            <Avatar className="w-20 h-20 ring-2 ring-primary/30 ring-offset-2 ring-offset-background">
              <AvatarImage src={avatarUrl} />
              <AvatarFallback className="font-serif-display text-2xl bg-primary/10 text-primary">
                {name?.charAt(0) || 'A'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="font-serif-display text-2xl">{name}</h2>
                <Badge className="text-[10px] bg-primary/10 text-primary hover:bg-primary/15">
                  <Shield className="w-3 h-3 mr-1" /> Private Client
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground">{email}</div>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                <span>Member since {formatDate(user?.createdAt || new Date())}</span>
                <span>·</span>
                <span>{accounts.length} account{accounts.length === 1 ? '' : 's'}</span>
                <span>·</span>
                <span>Total: {formatCurrency(totalBalance)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="personal">
        <TabsList>
          <TabsTrigger value="personal"><User className="w-3.5 h-3.5 mr-1.5" /> Personal</TabsTrigger>
          <TabsTrigger value="security"><Lock className="w-3.5 h-3.5 mr-1.5" /> Security</TabsTrigger>
          <TabsTrigger value="accounts"><CreditCard className="w-3.5 h-3.5 mr-1.5" /> Accounts</TabsTrigger>
          <TabsTrigger value="preferences"><Bell className="w-3.5 h-3.5 mr-1.5" /> Preferences</TabsTrigger>
        </TabsList>

        {/* Personal info */}
        <TabsContent value="personal" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Personal Information</CardTitle>
              <CardDescription className="text-xs">Update your name, contact info, and address on file.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Full name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input className="pl-9" value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Email (read-only)</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input className="pl-9 bg-muted/50" value={email} disabled />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Login ID (for signing in)</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input className="pl-9" value={loginId} onChange={(e) => setLoginId(e.target.value)} placeholder="your unique login id" />
                  </div>
                  <p className="text-[11px] text-muted-foreground">This is what you use to sign in. Change it anytime — your email stays the same.</p>
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input className="pl-9" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (xxx) xxx-xxxx" />
                  </div>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Mailing address</Label>
                  <AddressAutocomplete
                    value={address}
                    onChange={setAddress}
                    onAddressSelect={(addr) => {
                      setAddress(addr.street);
                      // Also auto-fill city/state/zip if empty
                      if (!phone) {} // no city/state/zip fields in this form, just address
                    }}
                    placeholder="Start typing your address…"
                  />
                </div>
              </div>
              <Separator />
              <div className="flex justify-end">
                <Button onClick={saveProfile} disabled={saving} className="arvest-gradient text-white">
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                  Save changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security */}
        <TabsContent value="security" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Change Password</CardTitle>
              <CardDescription className="text-xs">Use a strong password with at least 8 characters.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Current password</Label>
                <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>New password</Label>
                  <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Confirm new password</Label>
                  <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                </div>
              </div>
              <Separator />
              <div className="space-y-3">
                <div className="text-sm font-medium">Security status</div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 rounded-md bg-emerald-50 border border-emerald-200">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-emerald-700" />
                      <span className="text-sm">Two-factor authentication</span>
                    </div>
                    <Badge variant="outline" className="text-emerald-700 border-emerald-300">Enabled (simulated)</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-md bg-muted/40 border border-border">
                    <div className="flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">Trusted devices</span>
                    </div>
                    <span className="text-xs text-muted-foreground">2 devices</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-md bg-muted/40 border border-border">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">Last password change</span>
                    </div>
                    <span className="text-xs text-muted-foreground">During account setup</span>
                  </div>
                </div>
              </div>
              <Separator />
              <div className="flex justify-end">
                <Button onClick={changePassword} disabled={saving || !currentPassword || !newPassword} className="arvest-gradient text-white">
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Lock className="w-4 h-4 mr-2" />}
                  Update password
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Accounts */}
        <TabsContent value="accounts" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Linked Accounts</CardTitle>
              <CardDescription className="text-xs">All accounts associated with your private banking profile.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {accounts.map(a => (
                  <div key={a.id} className="flex items-center gap-3 p-4 rounded-lg border border-border">
                    <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{a.nickname}</span>
                        <Badge variant="outline" className="text-[9px]">{a.type.replace('_', ' ')}</Badge>
                      </div>
                      <div className="text-[11px] text-muted-foreground font-mono">Acct ••••{a.accountNumber.slice(-4)} · Routing {a.routingNumber}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">{formatCurrency(a.balance)}</div>
                      <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-300">{a.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preferences */}
        <TabsContent value="preferences" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Notification Preferences</CardTitle>
              <CardDescription className="text-xs">Choose how you'd like to be notified (simulated in this demo).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              {[
                { icon: Bell, label: 'Transaction alerts', desc: 'Notify me of every transaction over $500', default: true },
                { icon: Bell, label: 'Statement ready', desc: 'Email me when monthly statements are available', default: true },
                { icon: Bell, label: 'Transfer confirmations', desc: 'Send confirmation for every transfer', default: true },
                { icon: Bell, label: 'Suspicious activity alerts', desc: 'Immediate alert for any flagged activity', default: true },
                { icon: Bell, label: 'Marketing & product updates', desc: 'Receive offers from Arvest Private', default: false },
              ].map((p, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-md hover:bg-muted/40">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center">
                      <p.icon className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">{p.label}</div>
                      <div className="text-[11px] text-muted-foreground">{p.desc}</div>
                    </div>
                  </div>
                  <Switch defaultChecked={p.default} />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
