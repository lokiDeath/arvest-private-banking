import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/route-auth';

// Accepts JSON: { image: "data:image/jpeg;base64,..." }
// Compresses client-side already (canvas). Saves data URL to user.avatarUrl.
export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { image } = body as { image: string };

    if (!image || !image.startsWith('data:image/')) {
      return NextResponse.json({ error: 'A valid base64 image data URL is required.' }, { status: 400 });
    }
    if (image.length > 1_000_000) {
      return NextResponse.json({ error: 'Image too large. Must be under 1 MB after compression.' }, { status: 400 });
    }

    await db.user.update({ where: { id: user.id }, data: { avatarUrl: image } });
    await db.auditLog.create({
      data: { userId: user.id, actor: user.email, action: 'PROFILE_UPDATE', detail: 'Avatar uploaded (base64 data URL)' },
    });

    return NextResponse.json({ ok: true, avatarUrl: image });
  } catch (e) {
    console.error('Avatar upload error', e);
    return NextResponse.json({ error: 'Server error during upload.' }, { status: 500 });
  }
}
