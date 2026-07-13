import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { genResetCode } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json() as { email?: string };
    if (!email) return NextResponse.json({ error: 'Email is required.' }, { status: 400 });

    const user = await db.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    // Always return success to avoid leaking user existence
    if (!user) {
      return NextResponse.json({ ok: true, demo: true });
    }

    const code = genResetCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min
    await db.resetCode.create({
      data: { userId: user.id, email: user.email, code, expiresAt },
    });

    // In production this would email via Nodemailer / Resend.
    // For the demo, expose the code in the response (simulated email).
    console.log(`[ARVEST MAIL SIM] To: ${user.email}  Reset code: ${code}`);

    return NextResponse.json({ ok: true, demoCode: code, email: user.email });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error.' }, { status: 500 });
  }
}
