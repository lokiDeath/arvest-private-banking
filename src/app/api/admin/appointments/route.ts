import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/route-auth';
import { notifyCustomer } from '@/lib/notify';

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const appointments = await db.appointment.findMany({
    include: { user: { select: { id: true, name: true, email: true, phone: true } } },
    orderBy: { date: 'asc' },
    take: 200,
  });
  return NextResponse.json({ appointments });
}

export async function PATCH(req: NextRequest) {
  try {
    const admin = await getUserFromRequest(req);
    if (!admin || admin.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { id, status } = body as { id: string; status: string };

    if (!id || !['SCHEDULED', 'CONFIRMED', 'CANCELLED', 'COMPLETED'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status.' }, { status: 400 });
    }

    const appt = await db.appointment.findUnique({ where: { id } });
    if (!appt) return NextResponse.json({ error: 'Appointment not found.' }, { status: 404 });

    const updated = await db.appointment.update({ where: { id }, data: { status } });

    await db.auditLog.create({
      data: { userId: appt.userId, actor: admin.email, action: 'APPOINTMENT_UPDATE', detail: `Appointment ${appt.topic} → ${status}` },
    });

    await notifyCustomer(appt.userId, 'APPOINTMENT', `Appointment ${status.toLowerCase()}`, `Your appointment for "${appt.topic}" has been ${status.toLowerCase()} by your banker.`);

    return NextResponse.json({ ok: true, appointment: updated });
  } catch (e) {
    console.error('Admin appointment update error', e);
    return NextResponse.json({ error: 'Server error.' }, { status: 500 });
  }
}
