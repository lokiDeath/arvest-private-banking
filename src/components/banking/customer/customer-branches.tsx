'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  MapPin, Loader2, Building2, Phone, Clock, Banknote, Car, Navigation, Search, X,
} from 'lucide-react';
import { safeJsonFetch } from '@/lib/safe-fetch';

interface Branch {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  hours: string;
  hasATM: boolean;
  hasDriveThru: boolean;
  lat: number;
  lng: number;
}

const BRANCHES: Branch[] = [
  {
    id: 'b1',
    name: 'Arvest Private Banking — Fayetteville HQ',
    address: '101 N Block Ave',
    city: 'Fayetteville',
    state: 'AR',
    zip: '72701',
    phone: '+1 (479) 756-5300',
    hours: 'Mon–Fri 8am–6pm · Sat 9am–1pm',
    hasATM: true,
    hasDriveThru: true,
    lat: 36.0626,
    lng: -94.1572,
  },
  {
    id: 'b2',
    name: 'Arvest — Bentonville Branch',
    address: '1101 SE 14th St',
    city: 'Bentonville',
    state: 'AR',
    zip: '72712',
    phone: '+1 (479) 271-1000',
    hours: 'Mon–Fri 9am–5pm · Sat 9am–12pm',
    hasATM: true,
    hasDriveThru: true,
    lat: 36.3729,
    lng: -94.2088,
  },
  {
    id: 'b3',
    name: 'Arvest — Little Rock Downtown',
    address: '200 W Capitol Ave',
    city: 'Little Rock',
    state: 'AR',
    zip: '72201',
    phone: '+1 (501) 374-7000',
    hours: 'Mon–Fri 8am–6pm · Sat 9am–1pm',
    hasATM: true,
    hasDriveThru: false,
    lat: 34.7465,
    lng: -92.2896,
  },
  {
    id: 'b4',
    name: 'Arvest — Kansas City Plaza',
    address: '4750 Broadway Blvd',
    city: 'Kansas City',
    state: 'MO',
    zip: '64112',
    phone: '+1 (816) 753-2000',
    hours: 'Mon–Fri 9am–5pm · Sat 9am–12pm',
    hasATM: true,
    hasDriveThru: true,
    lat: 39.0406,
    lng: -94.5916,
  },
  {
    id: 'b5',
    name: 'Arvest — Springfield Branch',
    address: '1345 E Sunshine St',
    city: 'Springfield',
    state: 'MO',
    zip: '65804',
    phone: '+1 (417) 881-4400',
    hours: 'Mon–Fri 8am–6pm · Sat 9am–1pm',
    hasATM: true,
    hasDriveThru: false,
    lat: 37.1597,
    lng: -93.2623,
  },
  {
    id: 'b6',
    name: 'Arvest — Tulsa Midtown',
    address: '1811 E 15th St',
    city: 'Tulsa',
    state: 'OK',
    zip: '74120',
    phone: '+1 (918) 742-7000',
    hours: 'Mon–Fri 9am–5pm · Sat 9am–12pm',
    hasATM: true,
    hasDriveThru: true,
    lat: 36.1428,
    lng: -95.9656,
  },
  {
    id: 'b7',
    name: 'Arvest — Oklahoma City North',
    address: '7401 N Broadway Ave',
    city: 'Oklahoma City',
    state: 'OK',
    zip: '73116',
    phone: '+1 (405) 840-3000',
    hours: 'Mon–Fri 8am–6pm · Sat 9am–1pm',
    hasATM: false,
    hasDriveThru: true,
    lat: 35.5489,
    lng: -97.5236,
  },
  {
    id: 'b8',
    name: 'Arvest Private Wealth — Dallas',
    address: '5900 Luther Ln #350',
    city: 'Dallas',
    state: 'TX',
    zip: '75225',
    phone: '+1 (214) 265-4400',
    hours: 'Mon–Fri 9am–5pm · By appointment',
    hasATM: false,
    hasDriveThru: false,
    lat: 32.8626,
    lng: -96.8083,
  },
];

interface Suggestion {
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  fullLabel: string;
}

export function CustomerBranches() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlight, setHighlight] = useState(-1);

  // Selected location filter
  const [filterCity, setFilterCity] = useState<string | null>(null);
  const [filterState, setFilterState] = useState<string | null>(null);
  const [filterLabel, setFilterLabel] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  async function fetchSuggestions(q: string) {
    if (q.trim().length < 3) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    setLoadingSuggestions(true);
    try {
      const data = await safeJsonFetch(
        `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&lang=en`,
        { headers: { Accept: 'application/json' } }
      ).catch(() => ({ features: [] }));
      const features = data.features || [];
      const mapped: Suggestion[] = (features as any[])
        .filter((f: any) => f.properties && (f.properties.city || f.properties.state))
        .map((f: any) => {
          const p = f.properties;
          const city = p.city || p.town || p.village || p.county || '';
          const state = p.state || '';
          const country = p.country || '';
          const zip = p.postcode || '';
          const parts = [city, state].filter(Boolean);
          const fullLabel = parts.join(', ') + (zip ? ` ${zip}` : '') + (country && country !== 'United States' ? `, ${country}` : '');
          return { street: p.street || '', city, state, zip, country, fullLabel };
        });
      setSuggestions(mapped);
      setShowDropdown(mapped.length > 0);
      setHighlight(-1);
    } finally {
      setLoadingSuggestions(false);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setQuery(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(v), 350);
  }

  function selectSuggestion(s: Suggestion) {
    setFilterCity(s.city || null);
    setFilterState(s.state || null);
    setFilterLabel(s.fullLabel);
    setSearched(true);
    setQuery(s.fullLabel);
    setShowDropdown(false);
    setSuggestions([]);
  }

  function clearFilter() {
    setFilterCity(null);
    setFilterState(null);
    setFilterLabel(null);
    setSearched(false);
    setQuery('');
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!showDropdown || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(i => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && highlight >= 0) { e.preventDefault(); selectSuggestion(suggestions[highlight]); }
    else if (e.key === 'Escape') { setShowDropdown(false); }
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Apply filters
  const visibleBranches = filterCity || filterState
    ? BRANCHES.filter(b => {
        if (filterCity && filterState) {
          return b.city.toLowerCase() === filterCity.toLowerCase() || b.state.toLowerCase() === filterState.toLowerCase();
        }
        if (filterState) return b.state.toLowerCase() === filterState.toLowerCase();
        if (filterCity) return b.city.toLowerCase() === filterCity.toLowerCase();
        return true;
      })
    : BRANCHES;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif-display text-2xl mb-1">Branch & ATM Locator</h1>
        <p className="text-sm text-muted-foreground">Find the nearest Arvest Private Banking branch or ATM. Search by address, city, or ZIP.</p>
      </div>

      {/* Search bar */}
      <div className="relative" ref={containerRef}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-9 pr-10 h-12 text-base"
            value={query}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={() => { if (suggestions.length > 0) setShowDropdown(true); }}
            placeholder="Search by address, city, or ZIP code…"
            autoComplete="off"
          />
          {loadingSuggestions && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
          )}
          {!loadingSuggestions && query && (
            <button
              onClick={clearFilter}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {showDropdown && suggestions.length > 0 && (
          <div className="absolute z-50 left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-64 overflow-y-auto arvest-scroll">
            {suggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors border-b border-border last:border-0 flex items-start gap-2 ${i === highlight ? 'bg-accent' : ''}`}
                onMouseDown={(e) => { e.preventDefault(); selectSuggestion(s); }}
                onMouseEnter={() => setHighlight(i)}
              >
                <MapPin className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{s.fullLabel}</div>
                  {s.street && <div className="text-xs text-muted-foreground truncate">{s.street}</div>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Active filter chip */}
      {filterLabel && (
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs">
          <MapPin className="w-3 h-3 text-primary" />
          <span className="font-medium">{filterLabel}</span>
          <button onClick={clearFilter} className="ml-1 hover:text-destructive">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Results count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {searched
            ? `${visibleBranches.length} ${visibleBranches.length === 1 ? 'branch' : 'branches'} found${filterLabel ? ` near ${filterLabel}` : ''}`
            : `${BRANCHES.length} Arvest locations`}
        </p>
      </div>

      {/* No results message */}
      {searched && visibleBranches.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <MapPin className="w-7 h-7 text-muted-foreground" />
            </div>
            <h3 className="text-base font-medium mb-1">There's no bank in this location.</h3>
            <p className="text-sm text-muted-foreground mb-4">
              We don't have any Arvest branches near {filterLabel}. Try a different city or state.
            </p>
            <Button variant="outline" onClick={clearFilter}>View all locations</Button>
          </CardContent>
        </Card>
      )}

      {/* Branch list */}
      {visibleBranches.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visibleBranches.map(b => (
            <Card key={b.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base flex items-center gap-2 leading-tight">
                    <Building2 className="w-4 h-4 text-primary shrink-0" />
                    {b.name}
                  </CardTitle>
                </div>
                <CardDescription className="text-xs flex items-start gap-1.5 mt-1">
                  <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                  {b.address}, {b.city}, {b.state} {b.zip}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-xs">
                  <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <a href={`tel:${b.phone.replace(/[^\d+]/g, '')}`} className="hover:text-primary">{b.phone}</a>
                </div>
                <div className="flex items-start gap-2 text-xs">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <span>{b.hours}</span>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {b.hasATM && (
                    <Badge variant="outline" className="text-[10px] gap-1 bg-blue-50 border-blue-200 text-blue-700">
                      <Banknote className="w-2.5 h-2.5" /> ATM
                    </Badge>
                  )}
                  {b.hasDriveThru && (
                    <Badge variant="outline" className="text-[10px] gap-1 bg-emerald-50 border-emerald-200 text-emerald-700">
                      <Car className="w-2.5 h-2.5" /> Drive-thru
                    </Badge>
                  )}
                  {!b.hasATM && !b.hasDriveThru && (
                    <Badge variant="outline" className="text-[10px]">Private Wealth office</Badge>
                  )}
                </div>

                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="w-full h-8 text-xs"
                >
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${b.name} ${b.address} ${b.city} ${b.state} ${b.zip}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Navigation className="w-3.5 h-3.5 mr-1.5" /> Get directions
                  </a>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Disclaimer */}
      <div className="p-4 rounded-lg bg-muted/40 border border-border text-xs text-muted-foreground leading-relaxed">
        Branch hours may vary on holidays. ATM availability subject to service interruptions. For private wealth appointments, please book ahead.
      </div>
    </div>
  );
}
