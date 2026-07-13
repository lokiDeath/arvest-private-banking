'use client';

import { create } from 'zustand';
import { getTabToken, clearTabToken, setTabToken } from '@/lib/fetch-client';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: 'CUSTOMER' | 'ADMIN';
  phone?: string | null;
  address?: string | null;
  avatarUrl?: string | null;
  createdAt?: string;
}

interface AuthState {
  user: SessionUser | null;
  loading: boolean;
  setUser: (u: SessionUser | null) => void;
  setLoading: (l: boolean) => void;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  applyTabToken: (token: string) => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,
  setUser: (u) => set({ user: u, loading: false }),
  setLoading: (l) => set({ loading: l }),
  refresh: async () => {
    try {
      // No tab token = definitely not signed in for this tab
      if (!getTabToken()) {
        set({ user: null, loading: false });
        return;
      }
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      const data = await res.json();
      if (data.user) {
        set({ user: data.user, loading: false });
        return;
      }
      clearTabToken();
      set({ user: null, loading: false });
    } catch {
      set({ user: null, loading: false });
    }
  },
  applyTabToken: (token: string) => {
    setTabToken(token);
    set({ loading: false });
  },
  logout: async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    clearTabToken();
    set({ user: null });
  },
}));

export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}

export function maskAccountNumber(num: string): string {
  if (!num) return '';
  if (num.length <= 4) return num;
  return `••••${num.slice(-4)}`;
}

export function formatDate(iso: string | Date, opts?: Intl.DateTimeFormatOptions): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return d.toLocaleDateString('en-US', opts || { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return d.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
