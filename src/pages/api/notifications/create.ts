import { NextApiRequest, NextApiResponse } from 'next';
import { notificationService } from '@/lib/notification-service';
import { CreateNotificationData } from '@/types/notification';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const notificationData: CreateNotificationData = req.body;

    // Validate required fields
    if (!notificationData.userId || !notificationData.type || !notificationData.title || !notificationData.message) {
      return res.status(400).json({ 
        error: 'Missing required fields: userId, type, title, message' 
      });
    }

    // Create the notification
    const notificationId = await notificationService.createNotification(notificationData);

    res.status(201).json({ 
      success: true, 
      notificationId,
      message: 'Notification created successfully' 
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({ 
      error: 'Failed to create notification',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}