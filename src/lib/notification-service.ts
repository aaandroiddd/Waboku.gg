import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs, 
  doc, 
  updateDoc, 
  writeBatch,
  onSnapshot,
  Timestamp,
  getDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { 
  Notification, 
  NotificationPreferences, 
  CreateNotificationData, 
  NotificationType 
} from '@/types/notification';

export class NotificationService {
  private static instance: NotificationService;
  
  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Create a new notification
   */
  async createNotification(data: CreateNotificationData): Promise<string> {
    try {
      const notificationData = {
        ...data,
        read: false,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      const docRef = await addDoc(collection(db, 'notifications'), notificationData);
      console.log('Notification created:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Get notifications for a user
   */
  async getUserNotifications(
    userId: string, 
    limitCount: number = 20,
    unreadOnly: boolean = false
  ): Promise<Notification[]> {
    try {
      let q = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );

      if (unreadOnly) {
        q = query(
          collection(db, 'notifications'),
          where('userId', '==', userId),
          where('read', '==', false),
          orderBy('createdAt', 'desc'),
          limit(limitCount)
        );
      }

      const querySnapshot = await getDocs(q);
      const notifications: Notification[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        notifications.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as Notification);
      });

      return notifications;
    } catch (error) {
      console.error('Error fetching notifications:', error);
      throw error;
    }
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        where('read', '==', false)
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.size;
    } catch (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    try {
      const notificationRef = doc(db, 'notifications', notificationId);
      await updateDoc(notificationRef, {
        read: true,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<void> {
    try {
      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        where('read', '==', false)
      );

      const querySnapshot = await getDocs(q);
      const batch = writeBatch(db);

      querySnapshot.forEach((doc) => {
        batch.update(doc.ref, {
          read: true,
          updatedAt: Timestamp.now()
        });
      });

      await batch.commit();
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  /**
   * Subscribe to real-time notifications for a user
   */
  subscribeToNotifications(
    userId: string,
    callback: (notifications: Notification[]) => void,
    limitCount: number = 20
  ): () => void {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );

    return onSnapshot(q, (querySnapshot) => {
      const notifications: Notification[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        notifications.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as Notification);
      });

      callback(notifications);
    }, (error) => {
      console.error('Error in notifications subscription:', error);
    });
  }

  /**
   * Subscribe to unread count changes
   */
  subscribeToUnreadCount(
    userId: string,
    callback: (count: number) => void
  ): () => void {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('read', '==', false)
    );

    return onSnapshot(q, (querySnapshot) => {
      callback(querySnapshot.size);
    }, (error) => {
      console.error('Error in unread count subscription:', error);
    });
  }

  /**
   * Get user notification preferences
   */
  async getUserPreferences(userId: string): Promise<NotificationPreferences | null> {
    try {
      const docRef = doc(db, 'notificationPreferences', userId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          ...data,
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as NotificationPreferences;
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching notification preferences:', error);
      return null;
    }
  }

  /**
   * Update user notification preferences
   */
  async updateUserPreferences(preferences: NotificationPreferences): Promise<void> {
    try {
      const docRef = doc(db, 'notificationPreferences', preferences.userId);
      await updateDoc(docRef, {
        ...preferences,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      throw error;
    }
  }

  /**
   * Create default notification preferences for a new user
   */
  async createDefaultPreferences(userId: string): Promise<void> {
    try {
      const defaultPreferences: NotificationPreferences = {
        userId,
        email: {
          sales: true,
          messages: true,
          offers: true,
          orderUpdates: true,
          listingUpdates: true,
          marketing: false,
          system: true,
        },
        push: {
          sales: true,
          messages: true,
          offers: true,
          orderUpdates: true,
          listingUpdates: true,
          system: true,
        },
        updatedAt: new Date()
      };

      const docRef = doc(db, 'notificationPreferences', userId);
      await updateDoc(docRef, {
        ...defaultPreferences,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      // If document doesn't exist, create it
      const docRef = doc(db, 'notificationPreferences', userId);
      const defaultPreferences = {
        userId,
        email: {
          sales: true,
          messages: true,
          offers: true,
          orderUpdates: true,
          listingUpdates: true,
          marketing: false,
          system: true,
        },
        push: {
          sales: true,
          messages: true,
          offers: true,
          orderUpdates: true,
          listingUpdates: true,
          system: true,
        },
        updatedAt: Timestamp.now()
      };

      await addDoc(collection(db, 'notificationPreferences'), defaultPreferences);
    }
  }

  /**
   * Helper method to create common notification types
   */
  async createSaleNotification(userId: string, listingTitle: string, buyerName: string, amount: number, listingId: string): Promise<string> {
    return this.createNotification({
      userId,
      type: 'sale',
      title: '🎉 Sale Completed!',
      message: `${buyerName} purchased your "${listingTitle}" for $${amount.toFixed(2)}`,
      data: {
        listingId,
        actionUrl: `/dashboard/orders`
      }
    });
  }

  async createMessageNotification(userId: string, senderName: string, messageThreadId: string): Promise<string> {
    return this.createNotification({
      userId,
      type: 'message',
      title: '💬 New Message',
      message: `${senderName} sent you a message`,
      data: {
        messageThreadId,
        actionUrl: `/dashboard/messages`
      }
    });
  }

  async createOfferNotification(userId: string, offerAmount: number, listingTitle: string, buyerName: string, offerId: string, listingId: string): Promise<string> {
    return this.createNotification({
      userId,
      type: 'offer',
      title: '💰 New Offer Received',
      message: `${buyerName} made an offer of $${offerAmount.toFixed(2)} on "${listingTitle}"`,
      data: {
        offerId,
        listingId,
        actionUrl: `/dashboard/offers`
      }
    });
  }

  async createOfferAcceptedNotification(userId: string, listingTitle: string, sellerName: string, amount: number, offerId: string): Promise<string> {
    return this.createNotification({
      userId,
      type: 'offer_accepted',
      title: '✅ Offer Accepted!',
      message: `${sellerName} accepted your $${amount.toFixed(2)} offer on "${listingTitle}"`,
      data: {
        offerId,
        actionUrl: `/dashboard/orders`
      }
    });
  }

  async createOfferDeclinedNotification(userId: string, listingTitle: string, sellerName: string, amount: number, offerId: string): Promise<string> {
    return this.createNotification({
      userId,
      type: 'offer_declined',
      title: '❌ Offer Declined',
      message: `${sellerName} declined your $${amount.toFixed(2)} offer on "${listingTitle}"`,
      data: {
        offerId,
        actionUrl: `/dashboard/offers`
      }
    });
  }

  async createListingExpiredNotification(userId: string, listingTitle: string, listingId: string): Promise<string> {
    return this.createNotification({
      userId,
      type: 'listing_expired',
      title: '⏰ Listing Expired',
      message: `Your listing "${listingTitle}" has expired and is no longer visible`,
      data: {
        listingId,
        actionUrl: `/dashboard/edit-listing/${listingId}`
      }
    });
  }

  async createOrderUpdateNotification(userId: string, orderStatus: string, listingTitle: string, orderId: string): Promise<string> {
    return this.createNotification({
      userId,
      type: 'order_update',
      title: '📦 Order Update',
      message: `Your order for "${listingTitle}" is now ${orderStatus}`,
      data: {
        orderId,
        actionUrl: `/dashboard/orders/${orderId}`
      }
    });
  }

  async createSystemNotification(userId: string, title: string, message: string, actionUrl?: string): Promise<string> {
    return this.createNotification({
      userId,
      type: 'system',
      title,
      message,
      data: {
        actionUrl
      }
    });
  }
}

// Export singleton instance
export const notificationService = NotificationService.getInstance();