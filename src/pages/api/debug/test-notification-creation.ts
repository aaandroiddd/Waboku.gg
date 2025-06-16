import { NextApiRequest, NextApiResponse } from 'next';
import { notificationService } from '@/lib/notification-service';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { getAuth } from 'firebase-admin/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Initialize Firebase Admin
    const admin = getFirebaseAdmin();
    const token = authHeader.split('Bearer ')[1];
    
    const decodedToken = await admin.auth.verifyIdToken(token);
    const userId = decodedToken.uid;
    
    console.log(`Testing notification creation for user: ${userId}`);

    // Test creating a notification directly
    const testNotificationId = await notificationService.createNotification({
      userId,
      type: 'system',
      title: '🧪 Test Notification',
      message: 'This is a test notification to verify the notification system is working correctly.',
      data: {
        actionUrl: '/dashboard/notifications'
      }
    });

    console.log(`Test notification created with ID: ${testNotificationId}`);

    // Test fetching notifications for the user
    const userNotifications = await notificationService.getUserNotifications(userId, 10);
    console.log(`Found ${userNotifications.length} notifications for user`);

    // Test getting unread count
    const unreadCount = await notificationService.getUnreadCount(userId);
    console.log(`Unread count for user: ${unreadCount}`);

    return res.status(200).json({
      success: true,
      testNotificationId,
      userNotificationsCount: userNotifications.length,
      unreadCount,
      notifications: userNotifications.map(n => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        read: n.read,
        createdAt: n.createdAt
      }))
    });
  } catch (error) {
    console.error('Error testing notification creation:', error);
    return res.status(500).json({
      error: 'Failed to test notification creation',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}