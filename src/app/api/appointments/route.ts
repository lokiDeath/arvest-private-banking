import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/route-auth';
import { notifyAdmin, notifyCustomer } from '@/lib/notify';

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const where = user.role === 'ADMIN' ? {} : { userId: user.id };
  const appointments = await db.appointment.findMany({
    where,
    include: user.role === 'ADMIN' ? { user: { select: { id: true, name: true, email: true, phone: true } } } : false,
    orderBy: { date: 'asc' },
  });
  return NextResponse.json({ appointments });
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { type, topic, date, branchId, notes } = body as {
      type: string;
      topic: string;
      date: string;
      branchId?: string;
      notes?: string;
    };

    if (!type || !topic || !date) {
      return NextResponse.json({ error: 'Type, topic, and date are required.' }, { status: 400 });
    }
    if (!['PHONE', 'BRANCH'].includes(type)) {
      return NextResponse.json({ error: 'Invalid appointment type.' }, { status: 400 });
    }
    const apptDate = new Date(date);
    if (isNaN(apptDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date.' }, { status: 400 });
    }
    if (apptDate.getTime() < Date.now() - 60_000) {
      return NextResponse.json({ error: 'Appointment date must be in the future.' }, { status: 400 });
    }

    const appointment = await db.appointment.create({
      data: {
        userId: user.id,
        type,
        topic,
        date: apptDate,
        branchId: branchId || null,
        status: 'SCHEDULED',
        notes,
      },
    });

    await db.auditLog.create({
      data: { userId: user.id, actor: user.email, action: 'APPOINTMENT_BOOKED', detail: `${type} appointment for ${topic} on ${apptDate.toLocaleString()}` },
    });

    await notifyAdmin('APPOINTMENT', 'New appointment request', `${user.name} requested a ${type.toLowerCase()} appointment for "${topic}" on ${apptDate.toLocaleString()}.`, user.id);
    await notifyCustomer(user.id, 'APPOINTMENT', 'Appointment scheduled', `Your ${type.toLowerCase()} appointment for "${topic}" has been scheduled for ${apptDate.toLocaleString()}. Your banker will confirm shortly.`);

    return NextResponse.json({ ok: true, appointment });
  } catch (e) {
    console.error('Appointment create error', e);
    return NextResponse.json({ error: 'Server error.' }, { status: 500 });
  }
}
