'use client';

import { Home, ArrowLeftRight, ScanLine, CreditCard, Send } from 'lucide-react';
import type { CustomerView } from './customer-dashboard';

interface Props {
  current: CustomerView;
  onNavigate: (v: CustomerView) => void;
}

export function CustomerBottomNav({ current, onNavigate }: Props) {
  const items = [
    { key: 'home' as CustomerView, label: 'Home', icon: Home },
    { key: 'transfers' as CustomerView, label: 'Transfer', icon: ArrowLeftRight },
    { key: 'deposit' as CustomerView, label: 'Deposit', icon: ScanLine },
    { key: 'cards' as CustomerView, label: 'Cards', icon: CreditCard },
    { key: 'zelle' as CustomerView, label: 'Zelle', icon: Send },
  ];

  return (
    <nav
      className="lg:hidden fixed left-0 right-0 z-40 bg-background/95 backdrop-blur border-t border-border shadow-lg"
      style={{
        bottom: '16px',
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 6px)',
        paddingTop: '8px',
        borderRadius: '14px',
        marginLeft: '6px',
        marginRight: '6px',
      }}
    >
      <div className="grid grid-cols-5 h-14">
        {items.map((item) => {
          const Icon = item.icon;
          const active = current === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onNavigate(item.key)}
              className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
                active ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <Icon className={`w-5 h-5 ${active ? 'stroke-[2.5]' : ''}`} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
