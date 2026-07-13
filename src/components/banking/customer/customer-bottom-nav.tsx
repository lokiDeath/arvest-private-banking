'use client';
import { Wallet, ArrowLeftRight, ScanLine, Banknote, Send } from 'lucide-react';
import type { CustomerView } from './customer-dashboard';

export function CustomerBottomNav({ onNavigate, current }: { onNavigate: (v: CustomerView) => void; current: CustomerView }) {
  const items: { key: CustomerView; label: string; icon: any }[] = [
    { key: 'accounts', label: 'Accounts', icon: Wallet },
    { key: 'transfers', label: 'Transfer', icon: ArrowLeftRight },
    { key: 'deposit', label: 'Deposit', icon: ScanLine },
    { key: 'cards', label: 'Cards', icon: Banknote },
    { key: 'zelle', label: 'Zelle', icon: Send },
  ];
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-background border-t border-border flex items-center justify-around px-1 py-1" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {items.map((item) => {
        const Icon = item.icon;
        const active = current === item.key;
        return (
          <button key={item.key} onClick={() => onNavigate(item.key)} className={`flex flex-col items-center gap-0.5 px-2 py-1.5 min-w-[56px] ${active ? 'text-primary' : 'text-muted-foreground'}`}>
            <Icon className="w-5 h-5" />
            <span className="text-[10px]">{item.label}</span>
            {active && <div className="w-6 h-0.5 rounded-full bg-primary" />}
          </button>
        );
      })}
    </nav>
  );
}
