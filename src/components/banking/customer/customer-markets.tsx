'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { safeJsonFetch } from '@/lib/safe-fetch';
import {
  TrendingUp, TrendingDown, BarChart3, Bitcoin, Coins, DollarSign, LineChart, Loader2, AlertTriangle,
} from 'lucide-react';

type Category = 'crypto' | 'forex' | 'stocks' | 'commodities';

interface AssetDef {
  symbol: string;        // TradingView symbol
  label: string;
  binance?: string;      // Binance ticker (for crypto tiles)
}

const CATEGORY_ASSETS: Record<Category, AssetDef[]> = {
  crypto: [
    { symbol: 'BINANCE:BTCUSDT', label: 'Bitcoin', binance: 'BTCUSDT' },
    { symbol: 'BINANCE:ETHUSDT', label: 'Ethereum', binance: 'ETHUSDT' },
    { symbol: 'BINANCE:BNBUSDT', label: 'BNB', binance: 'BNBUSDT' },
    { symbol: 'BINANCE:SOLUSDT', label: 'Solana', binance: 'SOLUSDT' },
    { symbol: 'BINANCE:XRPUSDT', label: 'XRP', binance: 'XRPUSDT' },
    { symbol: 'BINANCE:ADAUSDT', label: 'Cardano', binance: 'ADAUSDT' },
    { symbol: 'BINANCE:DOGEUSDT', label: 'Dogecoin', binance: 'DOGEUSDT' },
  ],
  forex: [
    { symbol: 'FX:EURUSD', label: 'EUR / USD' },
    { symbol: 'FX:GBPUSD', label: 'GBP / USD' },
    { symbol: 'FX:USDJPY', label: 'USD / JPY' },
    { symbol: 'FX:AUDUSD', label: 'AUD / USD' },
    { symbol: 'FX:USDCAD', label: 'USD / CAD' },
    { symbol: 'FX:USDCHF', label: 'USD / CHF' },
  ],
  stocks: [
    { symbol: 'NASDAQ:AAPL', label: 'Apple' },
    { symbol: 'NASDAQ:MSFT', label: 'Microsoft' },
    { symbol: 'NASDAQ:GOOGL', label: 'Alphabet' },
    { symbol: 'NASDAQ:AMZN', label: 'Amazon' },
    { symbol: 'NYSE:JPM', label: 'JPMorgan' },
    { symbol: 'NYSE:BRK.B', label: 'Berkshire' },
  ],
  commodities: [
    { symbol: 'TVC:GOLD', label: 'Gold' },
    { symbol: 'TVC:SILVER', label: 'Silver' },
    { symbol: 'TVC:USOIL', label: 'WTI Crude' },
    { symbol: 'TVC:UKOIL', label: 'Brent' },
    { symbol: 'COMEX:HG1!', label: 'Copper' },
    { symbol: 'CBOT:ZC1!', label: 'Corn' },
  ],
};

interface BinanceTicker {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  highPrice: string;
  lowPrice: string;
  quoteVolume: string;
}

declare global {
  interface Window {
    TradingView?: any;
  }
}

export function CustomerMarkets() {
  const [category, setCategory] = useState<Category>('crypto');
  const [activeSymbol, setActiveSymbol] = useState<string>('BINANCE:BTCUSDT');
  const [chartReady, setChartReady] = useState(false);
  const [tickers, setTickers] = useState<Record<string, BinanceTicker>>({});
  const [tickersLoading, setTickersLoading] = useState(false);
  const widgetRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ===== Load TradingView tv.js once =====
  useEffect(() => {
    let cancelled = false;
    if (window.TradingView) { setChartReady(true); return; }
    const s = document.createElement('script');
    s.src = 'https://s3.tradingview.com/tv.js';
    s.async = true;
    s.onload = () => { if (!cancelled) setChartReady(true); };
    s.onerror = () => { if (!cancelled) toast.error('Failed to load TradingView chart'); };
    document.head.appendChild(s);
    return () => { cancelled = true; };
  }, []);

  // ===== Create / re-create widget on symbol change =====
  useEffect(() => {
    if (!chartReady || !window.TradingView) return;
    // Clear container
    if (containerRef.current) containerRef.current.innerHTML = '';
    // eslint-disable-next-line new-cap
    widgetRef.current = new window.TradingView.widget({
      autosize: true,
      symbol: activeSymbol,
      interval: '60',
      timezone: 'Etc/UTC',
      theme: 'light',
      style: '1',
      locale: 'en',
      allow_symbol_change: true,
      container_id: 'tradingview_live_chart',
      studies: [],
      hide_top_toolbar: false,
      save_image: false,
    });
  }, [chartReady, activeSymbol]);

  // ===== Fetch live crypto prices from Binance =====
  const fetchTickers = useCallback(async () => {
    setTickersLoading(true);
    try {
      const symbols = CATEGORY_ASSETS.crypto
        .map(a => a.binance)
        .filter(Boolean) as string[];
      const url = `https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(symbols))}`;
      const data = await safeJsonFetch(url).catch(() => [] as BinanceTicker[]);
      const map: Record<string, BinanceTicker> = {};
      (Array.isArray(data) ? data : []).forEach((t: BinanceTicker) => {
        if (t && t.symbol) map[t.symbol] = t;
      });
      setTickers(map);
    } finally {
      setTickersLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTickers();
    const id = setInterval(fetchTickers, 30000); // refresh every 30s
    return () => clearInterval(id);
  }, [fetchTickers]);

  function pickAsset(a: AssetDef) {
    setActiveSymbol(a.symbol);
    toast.success(`Now viewing ${a.label}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif-display text-2xl mb-1">Markets</h1>
        <p className="text-sm text-muted-foreground">Live charts and crypto prices powered by TradingView and Binance. Informational only — not investment advice.</p>
      </div>

      {/* Category tabs */}
      <Tabs value={category} onValueChange={(v) => setCategory(v as Category)}>
        <TabsList className="grid w-full grid-cols-4 max-w-xl">
          <TabsTrigger value="crypto"><Bitcoin className="w-3.5 h-3.5 mr-1.5" /> Crypto</TabsTrigger>
          <TabsTrigger value="forex"><DollarSign className="w-3.5 h-3.5 mr-1.5" /> Forex</TabsTrigger>
          <TabsTrigger value="stocks"><BarChart3 className="w-3.5 h-3.5 mr-1.5" /> Stocks</TabsTrigger>
          <TabsTrigger value="commodities"><Coins className="w-3.5 h-3.5 mr-1.5" /> Commodities</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Chart */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <LineChart className="w-4 h-4" /> Live Chart
            </CardTitle>
            <CardDescription className="text-xs">
              {CATEGORY_ASSETS[category].find(a => a.symbol === activeSymbol)?.label || activeSymbol}
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-[10px] gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> LIVE
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg overflow-hidden border border-border" style={{ height: 450 }}>
            <div id="tradingview_live_chart" ref={containerRef} className="w-full h-full">
              {!chartReady && (
                <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
                  <Loader2 className="w-6 h-6 animate-spin mb-2" />
                  <span className="text-sm">Loading TradingView…</span>
                </div>
              )}
            </div>
          </div>

          {/* Asset selector buttons */}
          <div className="mt-4 flex flex-wrap gap-2">
            {CATEGORY_ASSETS[category].map(a => {
              const active = a.symbol === activeSymbol;
              return (
                <button
                  key={a.symbol}
                  onClick={() => pickAsset(a)}
                  className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    active ? 'arvest-gradient text-white border-transparent' : 'border-border hover:border-primary hover:bg-primary/5'
                  }`}
                >
                  {a.label}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Crypto tiles — only shown for crypto category */}
      {category === 'crypto' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Bitcoin className="w-4 h-4" /> Live Crypto Prices
            </CardTitle>
            <CardDescription className="text-xs">24h stats from Binance · auto-refreshes every 30s</CardDescription>
          </CardHeader>
          <CardContent>
            {tickersLoading && Object.keys(tickers).length === 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
              </div>
            ) : Object.keys(tickers).length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                Live prices unavailable. Binance API may be blocked by your network.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {CATEGORY_ASSETS.crypto.map(a => {
                  const t = a.binance ? tickers[a.binance] : undefined;
                  if (!t) return null;
                  const price = parseFloat(t.lastPrice);
                  const change = parseFloat(t.priceChangePercent);
                  const up = change >= 0;
                  const def = a;
                  return (
                    <button
                      key={a.symbol}
                      onClick={() => pickAsset(def)}
                      className={`text-left p-4 rounded-lg border transition-colors hover:shadow-sm ${
                        activeSymbol === a.symbol ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                            <Bitcoin className="w-3.5 h-3.5 text-primary" />
                          </div>
                          <div>
                            <div className="text-sm font-medium leading-none">{a.label}</div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">{a.binance}</div>
                          </div>
                        </div>
                        {up ? (
                          <TrendingUp className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-destructive" />
                        )}
                      </div>
                      <div className="font-mono-balance text-lg">
                        ${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="flex items-center justify-between mt-1 text-[11px]">
                        <span className={up ? 'text-emerald-600' : 'text-destructive'}>
                          {up ? '+' : ''}{change.toFixed(2)}%
                        </span>
                        <span className="text-muted-foreground">
                          Vol ${(parseFloat(t.quoteVolume) / 1_000_000).toFixed(1)}M
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Disclaimer */}
      <div className="p-4 rounded-lg bg-muted/40 border border-border flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-[11px] text-muted-foreground leading-relaxed">
          <strong className="text-foreground">Disclaimer:</strong> Market data is provided for informational purposes only and does not constitute investment, legal, or tax advice. Arvest Private Banking does not offer cryptocurrency trading through deposit accounts. Past performance is not indicative of future results. Verify all data before making financial decisions.
        </div>
      </div>
    </div>
  );
}
