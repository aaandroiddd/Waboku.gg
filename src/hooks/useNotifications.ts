import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { notificationService } from '@/lib/notification-service';
import { Notification } from '@/types/notification';

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Subscribe to real-time notifications
  useEffect(() => {
    if (!user?.uid) {
      setNotifications([]);
      setUnreadCount(0);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    // Subscribe to notifications
    const unsubscribeNotifications = notificationService.subscribeToNotifications(
      user.uid,
      (newNotifications) => {
        setNotifications(newNotifications);
        setIsLoading(false);
      }
    );

    // Subscribe to unread count
    const unsubscribeUnreadCount = notificationService.subscribeToUnreadCount(
      user.uid,
      (count) => {
        setUnreadCount(count);
      }
    );

    return () => {
      unsubscribeNotifications();
      unsubscribeUnreadCount();
    };
  }, [user?.uid]);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await notificationService.markAsRead(notificationId);
    } catch (error) {
      console.error('Error marking notification as read:', error);
      setError('Failed to mark notification as read');
    }
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    if (!user?.uid) return;

    try {
      await notificationService.markAllAsRead(user.uid);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      setError('Failed to mark all notifications as read');
    }
  }, [user?.uid]);

  // Delete notification
  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      await notificationService.deleteNotification(notificationId);
    } catch (error) {
      console.error('Error deleting notification:', error);
      setError('Failed to delete notification');
    }
  }, []);

  // Delete all notifications
  const deleteAllNotifications = useCallback(async () => {
    if (!user?.uid) return;

    try {
      await notificationService.deleteAllNotifications(user.uid);
    } catch (error) {
      console.error('Error deleting all notifications:', error);
      setError('Failed to delete all notifications');
    }
  }, [user?.uid]);

  // Clear read notifications
  const clearReadNotifications = useCallback(async () => {
    if (!user?.uid) return;

    try {
      await notificationService.clearReadNotifications(user.uid);
    } catch (error) {
      console.error('Error clearing read notifications:', error);
      setError('Failed to clear read notifications');
    }
  }, [user?.uid]);

  // Get more notifications (for pagination)
  const loadMoreNotifications = useCallback(async (limitCount: number = 20) => {
    if (!user?.uid) return;

    try {
      setIsLoading(true);
      const moreNotifications = await notificationService.getUserNotifications(
        user.uid,
        limitCount
      );
      setNotifications(moreNotifications);
    } catch (error) {
      console.error('Error loading more notifications:', error);
      setError('Failed to load more notifications');
    } finally {
      setIsLoading(false);
    }
  }, [user?.uid]);

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications,
    clearReadNotifications,
    loadMoreNotifications,
  };
}