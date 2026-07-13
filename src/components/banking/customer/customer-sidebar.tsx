'use client';

import { useAuth } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  LayoutDashboard, Wallet, ArrowLeftRight, CreditCard, FileText, User,
  LogOut, Phone, Sparkles, Banknote,
} from 'lucide-react';
import type { CustomerView } from './customer-dashboard';

const navItems: { key: CustomerView; label: string; icon: any; description: string }[] = [
  { key: 'home', label: 'Dashboard', icon: LayoutDashboard, description: 'Account overview' },
  { key: 'accounts', label: 'Accounts & Activity', icon: Wallet, description: 'Transactions & history' },
  { key: 'transfers', label: 'Transfers', icon: ArrowLeftRight, description: 'Move money' },
  { key: 'payments', label: 'Bill Pay', icon: CreditCard, description: 'Pay bills & people' },
  { key: 'cards', label: 'Cards', icon: Banknote, description: 'Manage debit & credit cards' },
  { key: 'statements', label: 'Statements', icon: FileText, description: 'Download PDFs' },
  { key: 'profile', label: 'Profile & Settings', icon: User, description: 'Account settings' },
];

export function CustomerSidebar({ current, onNavigate }: { current: CustomerView; onNavigate: (v: CustomerView) => void }) {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);

  return (
    <div className="h-full flex flex-col bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-sidebar-primary/15 border border-sidebar-primary/30 flex items-center justify-center">
            <span className="font-serif-display text-xl text-sidebar-primary">A</span>
          </div>
          <div>
            <div className="font-serif-display text-lg tracking-wide text-sidebar-foreground">ARVEST</div>
            <div className="text-[9px] tracking-[0.3em] text-sidebar-foreground/60 -mt-1">PRIVATE BANKING</div>
          </div>
        </div>
      </div>

      {/* User card */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover ring-2 ring-sidebar-primary/40" key={user.avatarUrl} />
          ) : (
            <div className="w-10 h-10 rounded-full bg-sidebar-primary/15 flex items-center justify-center text-sidebar-primary font-medium">
              {user?.name?.charAt(0)}
            </div>
          )}
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{user?.name}</div>
            <div className="text-[11px] text-sidebar-foreground/60 truncate">{user?.email}</div>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 px-2 py-1.5 rounded-md bg-sidebar-primary/10 text-[10px] text-sidebar-primary tracking-wider">
          <Sparkles className="w-3 h-3" />
          PRIVATE CLIENT
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto arvest-scroll">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = current === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onNavigate(item.key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-colors group ${
                active ? 'bg-sidebar-primary/15 text-sidebar-primary' : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-sidebar-primary' : 'text-sidebar-foreground/60 group-hover:text-sidebar-accent-foreground'}`} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{item.label}</div>
                <div className="text-[10px] text-sidebar-foreground/50 truncate">{item.description}</div>
              </div>
            </button>
          );
        })}
      </nav>

      {/* Concierge card */}
      <div className="p-4 m-3 rounded-lg bg-gradient-to-br from-sidebar-primary/15 to-sidebar-primary/5 border border-sidebar-primary/20">
        <div className="flex items-center gap-2 mb-2">
          <Phone className="w-3.5 h-3.5 text-sidebar-primary" />
          <span className="text-xs font-medium text-sidebar-foreground">Private Banker</span>
        </div>
        <div className="text-sm font-serif-display text-sidebar-foreground mb-1">Catherine Holloway</div>
        <div className="text-[11px] text-sidebar-foreground/70 mb-2">+1 615 659 1539</div>
        <Button size="sm" variant="outline" className="w-full h-7 text-xs border-sidebar-primary/30 bg-transparent text-sidebar-foreground hover:bg-sidebar-primary/10">
          Contact banker
        </Button>
      </div>

      {/* Logout */}
      <div className="p-3 border-t border-sidebar-border">
        <button
          onClick={() => { logout().then(() => window.location.reload()); }}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
        >
          <LogOut className="w-4 h-4" /> Sign out
        </button>
      </div>
    </div>
  );
}
