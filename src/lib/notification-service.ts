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
import { getFirebaseServices } from '@/lib/firebase';
import { 
  Notification, 
  NotificationPreferences, 
  CreateNotificationData, 
  NotificationType 
} from '@/types/notification';

// Server-side imports (only available in Node.js environment)
let adminFirestore: any = null;
let adminTimestamp: any = null;

// Dynamically import Firebase Admin SDK only on server side
if (typeof window === 'undefined') {
  try {
    const { getFirebaseAdmin } = require('@/lib/firebase-admin');
    const { getFirestore, Timestamp: AdminTimestamp } = require('firebase-admin/firestore');
    
    // Initialize admin services
    const { admin, db } = getFirebaseAdmin();
    adminFirestore = db; // Use the db instance from getFirebaseAdmin
    adminTimestamp = AdminTimestamp;
    
    console.log('[NotificationService] Firebase Admin SDK initialized successfully');
  } catch (error) {
    console.warn('[NotificationService] Firebase Admin SDK not available:', error);
  }
}

export class NotificationService {
  private static instance: NotificationService;
  
  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Get the Firestore database instance
   */
  private getDb() {
    const services = getFirebaseServices();
    if (!services.db) {
      throw new Error('Firestore database is not initialized');
    }
    return services.db;
  }

  /**
   * Create a new notification
   */
  async createNotification(data: CreateNotificationData): Promise<string> {
    try {
      console.log('NotificationService: Creating notification with data:', data);
      
      // Check if we're running on server side
      if (typeof window === 'undefined') {
        console.log('NotificationService: Server-side environment detected');
        
        // Try to initialize admin SDK if not already done
        if (!adminFirestore || !adminTimestamp) {
          console.log('NotificationService: Admin SDK not initialized, attempting to initialize...');
          try {
            const { getFirebaseAdmin } = require('@/lib/firebase-admin');
            const { Timestamp: AdminTimestamp } = require('firebase-admin/firestore');
            
            const { db } = getFirebaseAdmin();
            adminFirestore = db;
            adminTimestamp = AdminTimestamp;
            
            console.log('NotificationService: Admin SDK initialized successfully');
          } catch (initError) {
            console.error('NotificationService: Failed to initialize admin SDK:', initError);
            throw new Error('Failed to initialize Firebase Admin SDK for notifications');
          }
        }
        
        if (adminFirestore && adminTimestamp) {
          console.log('NotificationService: Using Firebase Admin SDK for server-side notification creation');
          
          const notificationData = {
            ...data,
            read: false,
            createdAt: adminTimestamp.now(),
            updatedAt: adminTimestamp.now()
          };

          console.log('NotificationService: Prepared notification data (admin):', notificationData);

          const docRef = await adminFirestore.collection('notifications').add(notificationData);
          console.log('NotificationService: Notification created successfully with ID (admin):', docRef.id);
          return docRef.id;
        } else {
          throw new Error('Firebase Admin SDK is not properly initialized');
        }
      } else {
        // Use client-side Firebase SDK
        console.log('NotificationService: Using client-side Firebase SDK for notification creation');
        
        const db = this.getDb();
        console.log('NotificationService: Database instance obtained:', !!db);
        
        const notificationData = {
          ...data,
          read: false,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        };

        console.log('NotificationService: Prepared notification data (client):', notificationData);

        const docRef = await addDoc(collection(db, 'notifications'), notificationData);
        console.log('NotificationService: Notification created successfully with ID (client):', docRef.id);
        return docRef.id;
      }
    } catch (error) {
      console.error('NotificationService: Error creating notification:', error);
      console.error('NotificationService: Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        name: error instanceof Error ? error.name : 'Unknown error type',
        code: (error as any)?.code || 'No error code',
        stack: error instanceof Error ? error.stack : 'No stack trace'
      });
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
      // Check if we're running on server side
      if (typeof window === 'undefined') {
        // Try to initialize admin SDK if not already done
        if (!adminFirestore || !adminTimestamp) {
          console.log('NotificationService: Admin SDK not initialized for getUserNotifications, attempting to initialize...');
          try {
            const { getFirebaseAdmin } = require('@/lib/firebase-admin');
            const { Timestamp: AdminTimestamp } = require('firebase-admin/firestore');
            
            const { db } = getFirebaseAdmin();
            adminFirestore = db;
            adminTimestamp = AdminTimestamp;
            
            console.log('NotificationService: Admin SDK initialized successfully for getUserNotifications');
          } catch (initError) {
            console.error('NotificationService: Failed to initialize admin SDK for getUserNotifications:', initError);
            throw new Error('Failed to initialize Firebase Admin SDK for notifications');
          }
        }

        if (adminFirestore) {
          console.log('NotificationService: Using Firebase Admin SDK for getUserNotifications');
          
          let query = adminFirestore.collection('notifications')
            .where('userId', '==', userId)
            .where('deleted', '!=', true)
            .orderBy('createdAt', 'desc')
            .limit(limitCount);

          if (unreadOnly) {
            query = adminFirestore.collection('notifications')
              .where('userId', '==', userId)
              .where('read', '==', false)
              .where('deleted', '!=', true)
              .orderBy('createdAt', 'desc')
              .limit(limitCount);
          }

          const querySnapshot = await query.get();
          const notifications: Notification[] = [];

          querySnapshot.forEach((doc: any) => {
            const data = doc.data();
            // Double-check that notification is not deleted
            if (!data.deleted) {
              notifications.push({
                id: doc.id,
                ...data,
                createdAt: data.createdAt?.toDate() || new Date(),
                updatedAt: data.updatedAt?.toDate() || new Date(),
              } as Notification);
            }
          });

          return notifications;
        } else {
          throw new Error('Firebase Admin SDK is not properly initialized for getUserNotifications');
        }
      } else {
        // Client-side code
        const db = this.getDb();
        let q = query(
          collection(db, 'notifications'),
          where('userId', '==', userId),
          where('deleted', '!=', true),
          orderBy('createdAt', 'desc'),
          limit(limitCount)
        );

        if (unreadOnly) {
          q = query(
            collection(db, 'notifications'),
            where('userId', '==', userId),
            where('read', '==', false),
            where('deleted', '!=', true),
            orderBy('createdAt', 'desc'),
            limit(limitCount)
          );
        }

        const querySnapshot = await getDocs(q);
        const notifications: Notification[] = [];

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          // Double-check that notification is not deleted
          if (!data.deleted) {
            notifications.push({
              id: doc.id,
              ...data,
              createdAt: data.createdAt?.toDate() || new Date(),
              updatedAt: data.updatedAt?.toDate() || new Date(),
            } as Notification);
          }
        });

        return notifications;
      }
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
      // Check if we're running on server side
      if (typeof window === 'undefined') {
        // Try to initialize admin SDK if not already done
        if (!adminFirestore || !adminTimestamp) {
          console.log('NotificationService: Admin SDK not initialized for getUnreadCount, attempting to initialize...');
          try {
            const { getFirebaseAdmin } = require('@/lib/firebase-admin');
            const { Timestamp: AdminTimestamp } = require('firebase-admin/firestore');
            
            const { db } = getFirebaseAdmin();
            adminFirestore = db;
            adminTimestamp = AdminTimestamp;
            
            console.log('NotificationService: Admin SDK initialized successfully for getUnreadCount');
          } catch (initError) {
            console.error('NotificationService: Failed to initialize admin SDK for getUnreadCount:', initError);
            return 0;
          }
        }

        if (adminFirestore) {
          console.log('NotificationService: Using Firebase Admin SDK for getUnreadCount');
          
          const query = adminFirestore.collection('notifications')
            .where('userId', '==', userId)
            .where('read', '==', false)
            .where('deleted', '!=', true);

          const querySnapshot = await query.get();
          return querySnapshot.size;
        } else {
          console.error('Firebase Admin SDK is not properly initialized for getUnreadCount');
          return 0;
        }
      } else {
        // Client-side code
        const db = this.getDb();
        const q = query(
          collection(db, 'notifications'),
          where('userId', '==', userId),
          where('read', '==', false),
          where('deleted', '!=', true)
        );

        const querySnapshot = await getDocs(q);
        return querySnapshot.size;
      }
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
      const db = this.getDb();
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
      const db = this.getDb();
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
   * Delete a notification
   */
  async deleteNotification(notificationId: string): Promise<void> {
    try {
      const db = this.getDb();
      const notificationRef = doc(db, 'notifications', notificationId);
      await updateDoc(notificationRef, {
        deleted: true,
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  }

  /**
   * Delete all notifications for a user
   */
  async deleteAllNotifications(userId: string): Promise<void> {
    try {
      const db = this.getDb();
      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', userId)
      );

      const querySnapshot = await getDocs(q);
      const batch = writeBatch(db);

      querySnapshot.forEach((doc) => {
        batch.update(doc.ref, {
          deleted: true,
          updatedAt: Timestamp.now()
        });
      });

      await batch.commit();
    } catch (error) {
      console.error('Error deleting all notifications:', error);
      throw error;
    }
  }

  /**
   * Clear read notifications (soft delete)
   */
  async clearReadNotifications(userId: string): Promise<void> {
    try {
      const db = this.getDb();
      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        where('read', '==', true)
      );

      const querySnapshot = await getDocs(q);
      const batch = writeBatch(db);

      querySnapshot.forEach((doc) => {
        batch.update(doc.ref, {
          deleted: true,
          updatedAt: Timestamp.now()
        });
      });

      await batch.commit();
    } catch (error) {
      console.error('Error clearing read notifications:', error);
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
    try {
      const db = this.getDb();
      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        where('deleted', '!=', true),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );

      return onSnapshot(q, (querySnapshot) => {
        const notifications: Notification[] = [];
        
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          // Double-check that notification is not deleted
          if (!data.deleted) {
            notifications.push({
              id: doc.id,
              ...data,
              createdAt: data.createdAt?.toDate() || new Date(),
              updatedAt: data.updatedAt?.toDate() || new Date(),
            } as Notification);
          }
        });

        callback(notifications);
      }, (error) => {
        console.error('Error in notifications subscription:', error);
      });
    } catch (error) {
      console.error('Error setting up notifications subscription:', error);
      // Return a no-op unsubscribe function
      return () => {};
    }
  }

  /**
   * Subscribe to unread count changes
   */
  subscribeToUnreadCount(
    userId: string,
    callback: (count: number) => void
  ): () => void {
    try {
      const db = this.getDb();
      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        where('read', '==', false),
        where('deleted', '!=', true)
      );

      return onSnapshot(q, (querySnapshot) => {
        let count = 0;
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          // Double-check that notification is not deleted
          if (!data.deleted) {
            count++;
          }
        });
        callback(count);
      }, (error) => {
        console.error('Error in unread count subscription:', error);
      });
    } catch (error) {
      console.error('Error setting up unread count subscription:', error);
      // Return a no-op unsubscribe function
      return () => {};
    }
  }

  /**
   * Get user notification preferences
   */
  async getUserPreferences(userId: string): Promise<NotificationPreferences | null> {
    try {
      const db = this.getDb();
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
      const db = this.getDb();
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
      const db = this.getDb();
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
      try {
        const db = this.getDb();
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
      } catch (createError) {
        console.error('Error creating default notification preferences:', createError);
        throw createError;
      }
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