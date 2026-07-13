'use client';

import { Home, ArrowLeftRight, Smartphone, CreditCard, Send } from 'lucide-react';
import {
  Sheet, SheetContent, SheetTitle,
} from '@/components/ui/sheet';
import { useState } from 'react';
import { CustomerSidebar } from './customer-sidebar';
import type { CustomerView } from './customer-dashboard';

interface Props {
  current: CustomerView;
  onNavigate: (v: CustomerView) => void;
}

export function CustomerBottomNav({ current, onNavigate }: Props) {
  const [moreOpen, setMoreOpen] = useState(false);

  const items = [
    { key: 'home' as CustomerView, label: 'Home', icon: Home },
    { key: 'transfers' as CustomerView, label: 'Transfer', icon: ArrowLeftRight },
    { key: 'deposit' as CustomerView, label: 'Deposit', icon: Smartphone },
    { key: 'cards' as CustomerView, label: 'Cards', icon: CreditCard },
  ];

  return (
    <>
      <nav
        className="lg:hidden fixed left-0 right-0 z-40 bg-background/95 backdrop-blur border-t border-border shadow-lg"
        style={{ bottom: '16px', paddingBottom: 'env(safe-area-inset-bottom)', paddingTop: '6px', borderRadius: '12px', marginLeft: '4px', marginRight: '4px' }}
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
          <button
            onClick={() => onNavigate('zelle' as CustomerView)}
            className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
              current === 'zelle' ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <Send className={`w-5 h-5 ${current === 'zelle' ? 'stroke-[2.5]' : ''}`} />
            <span className="text-[10px] font-medium">Zelle</span>
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="p-0 h-[70vh]">
          <SheetTitle className="sr-only">More navigation</SheetTitle>
          <CustomerSidebar current={current} onNavigate={(v) => { onNavigate(v); setMoreOpen(false); }} />
        </SheetContent>
      </Sheet>
    </>
  );
}
