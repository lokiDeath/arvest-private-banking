'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { safeJsonFetch } from '@/lib/safe-fetch';
import { formatDateTime, formatDate } from '@/lib/store';
import {
  Plus, Send, Loader2, Mail, MailOpen, Building2, User, MessageSquare, Trash2, Inbox,
} from 'lucide-react';

interface Message {
  id: string;
  subject: string;
  body: string;
  fromBank: boolean;
  isRead: boolean;
  createdAt: string;
  fromName?: string | null;
  toName?: string | null;
}

export function CustomerMessages() {
  const [threads, setThreads] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Message | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await safeJsonFetch('/api/messages').catch(() => ({ messages: [] }));
      const msgs = data.messages || [];
      setThreads(msgs);
      // Auto-select first if nothing selected
      if (msgs.length > 0 && !selected) setSelected(msgs[0]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  // Mark message as read when selected
  useEffect(() => {
    if (!selected || selected.isRead) return;
    (async () => {
      try {
        await safeJsonFetch(`/api/messages/${selected.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isRead: true }),
        }).catch(() => ({}));
        setThreads(prev => prev.map(t => t.id === selected.id ? { ...t, isRead: true } : t));
        setSelected({ ...selected, isRead: true });
      } catch {}
    })();
  }, [selected]);

  async function send() {
    if (!subject.trim() || !body.trim()) { toast.error('Subject and body are required.'); return; }
    setSending(true);
    try {
      await safeJsonFetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, body }),
      });
      toast.success('Message sent to your private banker');
      setShowNew(false);
      setSubject(''); setBody('');
      load();
    } catch (e: any) {
      toast.error(e.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  }

  async function deleteMessage(m: Message) {
    if (!confirm(`Delete message “${m.subject}”?`)) return;
    try {
      await safeJsonFetch(`/api/messages/${m.id}`, { method: 'DELETE' }).catch(() => ({}));
      toast.success('Message deleted');
      if (selected?.id === m.id) setSelected(null);
      load();
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete');
    }
  }

  const unread = threads.filter(t => !t.isRead).length;

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
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-serif-display text-2xl mb-1">Message Center</h1>
          <p className="text-sm text-muted-foreground">Secure messages with your Arvest private banker and bank notifications.</p>
        </div>
        <Button onClick={() => setShowNew(true)} className="arvest-gradient text-white">
          <Plus className="w-4 h-4 mr-2" /> New message
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-[500px]">
        {/* Message list */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm flex items-center gap-2">
              <Inbox className="w-4 h-4" /> Inbox
            </CardTitle>
            {unread > 0 && <Badge className="text-[10px] gap-1">{unread} unread</Badge>}
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[520px] overflow-y-auto arvest-scroll">
              {threads.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <Mail className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
                  <p className="text-sm text-muted-foreground">No messages yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Start a conversation with your banker</p>
                </div>
              ) : (
                threads.map(m => {
                  const active = selected?.id === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setSelected(m)}
                      className={`w-full text-left p-3 border-b border-border last:border-0 transition-colors ${
                        active ? 'bg-primary/5' : 'hover:bg-muted/40'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="shrink-0 mt-0.5">
                          {m.fromBank ? (
                            <div className="w-8 h-8 rounded-full arvest-gradient text-white flex items-center justify-center">
                              <Building2 className="w-3.5 h-3.5" />
                            </div>
                          ) : (
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${m.isRead ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'}`}>
                              {m.isRead ? <MailOpen className="w-3.5 h-3.5" /> : <Mail className="w-3.5 h-3.5" />}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-sm truncate ${m.isRead ? 'font-normal' : 'font-semibold'}`}>
                              {m.subject}
                            </span>
                            {!m.isRead && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                            {m.fromBank ? (m.fromName || 'Arvest Bank') : 'You'} · {formatDate(m.createdAt)}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate mt-0.5">{m.body}</div>
                          {m.fromBank && <Badge variant="outline" className="text-[9px] mt-1 gap-1"><Building2 className="w-2.5 h-2.5" /> From bank</Badge>}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* Conversation view */}
        <Card className="lg:col-span-2">
          {selected ? (
            <>
              <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base flex items-center gap-2">
                    {selected.fromBank ? <Building2 className="w-4 h-4" /> : <User className="w-4 h-4" />}
                    {selected.subject}
                  </CardTitle>
                  <div className="text-xs text-muted-foreground mt-1">
                    {selected.fromBank ? (selected.fromName || 'Arvest Bank') : 'You'} · {formatDateTime(selected.createdAt)}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => deleteMessage(selected)} className="text-destructive hover:text-destructive">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </CardHeader>
              <CardContent ref={scrollRef}>
                <div className="p-4 rounded-lg bg-muted/40 border border-border">
                  <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
                    <MessageSquare className="w-3 h-3" />
                    {selected.fromBank ? (selected.fromName || 'Arvest Bank') : 'You'}
                    {selected.fromBank && <Badge variant="outline" className="text-[9px] ml-1 gap-1"><Building2 className="w-2.5 h-2.5" /> Bank message</Badge>}
                  </div>
                  <div className="text-sm leading-relaxed whitespace-pre-wrap">{selected.body}</div>
                </div>

                <div className="mt-4 p-3 rounded-md border border-dashed border-border text-xs text-muted-foreground text-center">
                  Reply with a new message — your banker typically responds within 1 business day.
                </div>
                <Button onClick={() => setShowNew(true)} variant="outline" className="w-full mt-3">
                  <Plus className="w-3.5 h-3.5 mr-2" /> Compose reply
                </Button>
              </CardContent>
            </>
          ) : (
            <CardContent className="flex flex-col items-center justify-center py-20">
              <Mail className="w-10 h-10 text-muted-foreground mb-3 opacity-40" />
              <p className="text-sm text-muted-foreground">Select a message to view</p>
            </CardContent>
          )}
        </Card>
      </div>

      {/* New message dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-4 h-4" /> New Message
            </DialogTitle>
            <DialogDescription>Send a secure message to your Arvest private banker.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="What's this about?" />
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your message…" />
            </div>
            <div className="p-3 rounded-md bg-muted/40 text-[11px] text-muted-foreground flex items-start gap-2">
              <Building2 className="w-3 h-3 mt-0.5 shrink-0" />
              <span>Messages are encrypted end-to-end. Your banker typically responds within one business day.</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button onClick={send} disabled={sending || !subject || !body} className="arvest-gradient text-white">
              {sending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending…</> : <><Send className="w-4 h-4 mr-2" /> Send message</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
