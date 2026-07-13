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
import { formatDateTime } from '@/lib/store';
import {
  Phone, Building2, Calendar, Loader2, CheckCircle2, Clock, XCircle, CalendarPlus,
} from 'lucide-react';

type AppointmentType = 'PHONE' | 'BRANCH';

interface Appointment {
  id: string;
  type: AppointmentType;
  topic: string;
  scheduledAt: string;
  notes: string | null;
  status: string;
  location?: string | null;
  createdAt: string;
}

const TOPICS = [
  { value: 'ACCOUNT_OPENING', label: 'Open a new account' },
  { value: 'LOAN_APPLICATION', label: 'Loan application' },
  { value: 'WEALTH_MANAGEMENT', label: 'Wealth management' },
  { value: 'CARD_SERVICES', label: 'Card services' },
  { value: 'BUSINESS_BANKING', label: 'Business banking' },
  { value: 'GENERAL_INQUIRY', label: 'General inquiry' },
];

export function CustomerAppointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [apptType, setApptType] = useState<AppointmentType>('PHONE');
  const [topic, setTopic] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [notes, setNotes] = useState('');

  async function load() {
    setLoading(true);
    try {
      const data = await safeJsonFetch('/api/appointments').catch(() => ({ appointments: [] }));
      setAppointments(data.appointments || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function submit() {
    if (!topic) { toast.error('Pick a topic for your appointment.'); return; }
    if (!scheduledAt) { toast.error('Pick a date and time.'); return; }
    const when = new Date(scheduledAt);
    if (when.getTime() < Date.now()) { toast.error('Please pick a future date and time.'); return; }

    setSubmitting(true);
    try {
      await safeJsonFetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: apptType,
          topic,
          scheduledAt: when.toISOString(),
          notes: notes || null,
        }),
      });
      toast.success('Appointment requested · confirmation pending');
      setTopic(''); setScheduledAt(''); setNotes('');
      load();
    } catch (e: any) {
      toast.error(e.message || 'Failed to book appointment');
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

  const upcoming = appointments.filter(a => a.status === 'PENDING' || a.status === 'CONFIRMED');
  const past = appointments.filter(a => a.status === 'COMPLETED' || a.status === 'CANCELLED' || a.status === 'DECLINED');

  function statusBadge(status: string) {
    if (status === 'PENDING') return <Badge variant="secondary" className="text-[10px] gap-1"><Clock className="w-2.5 h-2.5" /> Pending</Badge>;
    if (status === 'CONFIRMED') return <Badge className="text-[10px] gap-1 bg-emerald-600"><CheckCircle2 className="w-2.5 h-2.5" /> Confirmed</Badge>;
    if (status === 'COMPLETED') return <Badge variant="outline" className="text-[10px] gap-1"><CheckCircle2 className="w-2.5 h-2.5" /> Completed</Badge>;
    if (status === 'CANCELLED' || status === 'DECLINED') return <Badge variant="destructive" className="text-[10px] gap-1"><XCircle className="w-2.5 h-2.5" /> Cancelled</Badge>;
    return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
  }

  // Min datetime-local value = now + 1 hour
  const minDate = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif-display text-2xl mb-1">Book an Appointment</h1>
        <p className="text-sm text-muted-foreground">Schedule time with your private banker — by phone or at a branch. Same-day appointments not available.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card><CardContent className="p-4">
          <div className="text-[11px] text-muted-foreground tracking-wider mb-1">UPCOMING</div>
          <div className="font-mono-balance text-xl">{upcoming.length}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-[11px] text-muted-foreground tracking-wider mb-1">PENDING</div>
          <div className="font-mono-balance text-xl">{appointments.filter(a => a.status === 'PENDING').length}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-[11px] text-muted-foreground tracking-wider mb-1">COMPLETED</div>
          <div className="font-mono-balance text-xl">{past.length}</div>
        </CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Booking form */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarPlus className="w-4 h-4" /> Request an Appointment
            </CardTitle>
            <CardDescription className="text-xs">A banker will confirm within 1 business hour.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Type radio cards */}
            <div>
              <Label className="mb-2 block">Appointment type</Label>
              <RadioGroup
                value={apptType}
                onValueChange={(v) => setApptType(v as AppointmentType)}
                className="grid grid-cols-1 md:grid-cols-2 gap-3"
              >
                {([
                  { v: 'PHONE',  icon: Phone,     label: 'Phone Call',  desc: 'We call you at your number on file' },
                  { v: 'BRANCH', icon: Building2, label: 'Branch Visit', desc: 'Meet in person at an Arvest branch' },
                ] as const).map(opt => {
                  const Icon = opt.icon;
                  const active = apptType === opt.v;
                  return (
                    <label key={opt.v} htmlFor={`apt-${opt.v}`}>
                      <div className={`p-4 rounded-lg border-2 transition-colors h-full ${active ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center ${active ? 'arvest-gradient text-white' : 'bg-muted text-muted-foreground'}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <RadioGroupItem value={opt.v} id={`apt-${opt.v}`} />
                        </div>
                        <div className="text-sm font-medium">{opt.label}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">{opt.desc}</div>
                      </div>
                    </label>
                  );
                })}
              </RadioGroup>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Topic</Label>
                <Select value={topic} onValueChange={setTopic}>
                  <SelectTrigger><SelectValue placeholder="Select a topic" /></SelectTrigger>
                  <SelectContent>
                    {TOPICS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Date & time</Label>
                <Input
                  type="datetime-local"
                  min={minDate}
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything specific you'd like to discuss?" />
            </div>

            <div className="flex justify-end pt-4 border-t border-border">
              <Button
                onClick={submit}
                disabled={submitting || !topic || !scheduledAt}
                className="arvest-gradient text-white"
              >
                {submitting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Requesting…</>
                ) : (
                  <><CalendarPlus className="w-4 h-4 mr-2" /> Request appointment</>
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
                <Calendar className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Booking hours</span>
              </div>
              <ul className="text-[11px] text-muted-foreground space-y-1.5">
                <li>· Mon–Fri: 8am – 6pm CT</li>
                <li>· Sat: 9am – 1pm CT</li>
                <li>· Sun: closed</li>
                <li>· Same-day not available</li>
                <li>· 24-hour notice preferred</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Upcoming appointments */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="w-4 h-4" /> Upcoming Appointments
          </CardTitle>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">No upcoming appointments.</div>
          ) : (
            <div className="space-y-2">
              {upcoming.map(a => (
                <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/40">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${a.type === 'PHONE' ? 'bg-blue-100 text-blue-700' : 'bg-primary/10 text-primary'}`}>
                    {a.type === 'PHONE' ? <Phone className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">
                        {TOPICS.find(t => t.value === a.topic)?.label || a.topic}
                      </span>
                      {statusBadge(a.status)}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {a.type === 'PHONE' ? 'Phone call' : (a.location || 'Branch visit')} · {formatDateTime(a.scheduledAt)}
                    </div>
                    {a.notes && <div className="text-[11px] text-muted-foreground mt-0.5 truncate">Note: {a.notes}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Past appointments */}
      {past.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Past Appointments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {past.map(a => (
                <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg border border-border opacity-75">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${a.type === 'PHONE' ? 'bg-blue-100 text-blue-700' : 'bg-primary/10 text-primary'}`}>
                    {a.type === 'PHONE' ? <Phone className="w-3.5 h-3.5" /> : <Building2 className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm truncate">{TOPICS.find(t => t.value === a.topic)?.label || a.topic}</span>
                      {statusBadge(a.status)}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{formatDateTime(a.scheduledAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
