import { NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/route-auth';
import { NextRequest } from 'next/server';

// 8 hardcoded Arvest Private Banking branches across the footprint.
const BRANCHES = [
  {
    id: 'fayetteville-hq',
    name: 'Arvest Private Banking — Fayetteville HQ',
    address: '100 Arvest Plaza, Fayetteville, AR 72701',
    phone: '+1 (479) 555-0100',
    hours: 'Mon–Fri 9:00 AM – 5:00 PM',
    lat: 36.0626, lng: -94.1574,
    services: ['Private Banking', 'Wealth Management', 'Mortgage', 'Safe Deposit'],
  },
  {
    id: 'little-rock',
    name: 'Arvest Private Banking — Little Rock',
    address: '210 Capitol Mall, Little Rock, AR 72201',
    phone: '+1 (501) 555-0188',
    hours: 'Mon–Fri 9:00 AM – 5:00 PM',
    lat: 34.7465, lng: -92.2896,
    services: ['Private Banking', 'Wealth Management'],
  },
  {
    id: 'tulsa',
    name: 'Arvest Private Banking — Tulsa',
    address: '22 Riverfront Terrace, Tulsa, OK 74103',
    phone: '+1 (918) 555-0177',
    hours: 'Mon–Fri 9:00 AM – 5:00 PM',
    lat: 36.1540, lng: -95.9928,
    services: ['Private Banking', 'Mortgage'],
  },
  {
    id: 'kansas-city',
    name: 'Arvest Private Banking — Kansas City',
    address: '815 Country Club Plaza, Kansas City, MO 64112',
    phone: '+1 (816) 555-0119',
    hours: 'Mon–Fri 9:00 AM – 5:00 PM',
    lat: 39.0429, lng: -94.5889,
    services: ['Private Banking', 'Wealth Management'],
  },
  {
    id: 'springfield-mo',
    name: 'Arvest Private Banking — Springfield',
    address: '320 Park Central West, Springfield, MO 65806',
    phone: '+1 (417) 555-0144',
    hours: 'Mon–Fri 9:00 AM – 5:00 PM',
    lat: 37.2087, lng: -93.2927,
    services: ['Private Banking'],
  },
  {
    id: 'bentonville',
    name: 'Arvest Private Banking — Bentonville',
    address: '1100 SE Walton Blvd, Bentonville, AR 72712',
    phone: '+1 (479) 555-0210',
    hours: 'Mon–Fri 9:00 AM – 5:00 PM',
    lat: 36.3729, lng: -94.2088,
    services: ['Private Banking', 'Wealth Management'],
  },
  {
    id: 'fort-smith',
    name: 'Arvest Private Banking — Fort Smith',
    address: '401 Rogers Avenue, Fort Smith, AR 72901',
    phone: '+1 (479) 555-0233',
    hours: 'Mon–Fri 9:00 AM – 5:00 PM',
    lat: 35.3860, lng: -94.4198,
    services: ['Private Banking', 'Mortgage'],
  },
  {
    id: 'oklahoma-city',
    name: 'Arvest Private Banking — Oklahoma City',
    address: '101 N Robinson Ave, Oklahoma City, OK 73102',
    phone: '+1 (405) 555-0256',
    hours: 'Mon–Fri 9:00 AM – 5:00 PM',
    lat: 35.4676, lng: -97.5164,
    services: ['Private Banking', 'Wealth Management'],
  },
];

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ branches: BRANCHES });
}
