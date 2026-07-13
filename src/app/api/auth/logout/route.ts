import { NextRequest, NextResponse } from 'next/server';
import { destroySession, verifyTabToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  // Read the tab token from the header (so we know which session to destroy)
  const tabToken = req.headers.get('X-Tab-Session');
  const session = tabToken ? verifyTabToken(tabToken) : null;
  await destroySession(session?.tabId);
  return NextResponse.json({ ok: true });
}
