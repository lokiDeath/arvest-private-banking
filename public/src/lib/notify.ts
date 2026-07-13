// Helper to create admin notifications. Called from various API routes
// whenever a customer does something the admin should know about.
import { db } from '@/lib/db';

export async function notifyAdmin(type: string, title: string, body: string, userId?: string) {
  try {
    await db.notification.create({
      data: {
        recipientRole: 'ADMIN',
        userId: userId || null,
        type,
        title,
        body,
        read: false,
      },
    });
  } catch (e) {
    console.error('Failed to create admin notification:', e);
  }
}

export async function notifyCustomer(userId: string, type: string, title: string, body: string) {
  try {
    await db.notification.create({
      data: {
        recipientId: userId,
        userId,
        type,
        title,
        body,
        read: false,
      },
    });
  } catch (e) {
    console.error('Failed to create customer notification:', e);
  }
}
