import { getFirebaseAdmin } from '@/lib/firebase-admin';

export interface SubscriptionEvent {
  id: string;
  type: 'subscription_created' | 'subscription_updated' | 'subscription_canceled' | 'subscription_continued' | 'payment_succeeded' | 'payment_failed' | 'admin_update' | 'tier_changed';
  date: string;
  description: string;
  details?: {
    status?: string;
    tier?: string;
    amount?: number;
    cardBrand?: string;
    cardLast4?: string;
    cancelAtPeriodEnd?: boolean;
    endDate?: string;
    renewalDate?: string;
    subscriptionId?: string;
    invoiceId?: string;
    paymentIntentId?: string;
  };
}

export class SubscriptionHistoryService {
  private static instance: SubscriptionHistoryService;
  private admin: any;
  private firestore: any;

  private constructor() {
    const { admin } = getFirebaseAdmin();
    this.admin = admin;
    this.firestore = admin.firestore();
  }

  static getInstance(): SubscriptionHistoryService {
    if (!SubscriptionHistoryService.instance) {
      SubscriptionHistoryService.instance = new SubscriptionHistoryService();
    }
    return SubscriptionHistoryService.instance;
  }

  async addEvent(userId: string, event: Omit<SubscriptionEvent, 'id'>): Promise<void> {
    try {
      const historyRef = this.firestore
        .collection('users')
        .doc(userId)
        .collection('subscription_history');

      // Generate a unique ID for the event
      const eventId = `${event.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const eventData: SubscriptionEvent = {
        id: eventId,
        ...event
      };

      await historyRef.doc(eventId).set(eventData);

      console.log('[SubscriptionHistoryService] Added event:', {
        userId,
        eventType: event.type,
        eventId
      });
    } catch (error) {
      console.error('[SubscriptionHistoryService] Error adding event:', error);
      throw error;
    }
  }

  async getHistory(userId: string, limit: number = 50, startAfter?: string): Promise<{
    events: SubscriptionEvent[];
    hasMore: boolean;
    lastEventId?: string;
  }> {
    try {
      const historyRef = this.firestore
        .collection('users')
        .doc(userId)
        .collection('subscription_history');

      let query = historyRef.orderBy('date', 'desc');

      // If we have a cursor, start after it
      if (startAfter) {
        const startAfterDoc = await historyRef.doc(startAfter).get();
        if (startAfterDoc.exists) {
          query = query.startAfter(startAfterDoc);
        }
      }

      // Fetch one extra to check if there are more results
      const snapshot = await query.limit(limit + 1).get();

      const events: SubscriptionEvent[] = [];
      const docs = snapshot.docs;
      
      // Process the results (excluding the extra one if it exists)
      const actualLimit = Math.min(docs.length, limit);
      for (let i = 0; i < actualLimit; i++) {
        events.push(docs[i].data() as SubscriptionEvent);
      }

      // Check if there are more results
      const hasMore = docs.length > limit;
      const lastEventId = events.length > 0 ? events[events.length - 1].id : undefined;

      return {
        events,
        hasMore,
        lastEventId
      };
    } catch (error) {
      console.error('[SubscriptionHistoryService] Error fetching history:', error);
      throw error;
    }
  }

  // Legacy method for backward compatibility
  async getHistoryLegacy(userId: string, limit: number = 50): Promise<SubscriptionEvent[]> {
    const result = await this.getHistory(userId, limit);
    return result.events;
  }

  async addSubscriptionCreated(userId: string, subscriptionId: string, tier: string = 'premium'): Promise<void> {
    await this.addEvent(userId, {
      type: 'subscription_created',
      date: new Date().toISOString(),
      description: 'Premium subscription activated',
      details: {
        status: 'active',
        tier,
        subscriptionId
      }
    });
  }

  async addSubscriptionUpdated(userId: string, subscriptionId: string, status: string, details?: any): Promise<void> {
    await this.addEvent(userId, {
      type: 'subscription_updated',
      date: new Date().toISOString(),
      description: `Subscription ${status}`,
      details: {
        status,
        subscriptionId,
        ...details
      }
    });
  }

  async addSubscriptionCanceled(userId: string, subscriptionId: string, endDate?: string): Promise<void> {
    await this.addEvent(userId, {
      type: 'subscription_canceled',
      date: new Date().toISOString(),
      description: 'Subscription canceled',
      details: {
        status: 'canceled',
        subscriptionId,
        endDate
      }
    });
  }

  async addPaymentSucceeded(userId: string, amount: number, cardDetails?: { brand: string; last4: string }, invoiceId?: string): Promise<void> {
    await this.addEvent(userId, {
      type: 'payment_succeeded',
      date: new Date().toISOString(),
      description: 'Payment processed successfully',
      details: {
        amount: amount / 100, // Convert from cents
        cardBrand: cardDetails?.brand,
        cardLast4: cardDetails?.last4,
        invoiceId
      }
    });
  }

  async addPaymentFailed(userId: string, amount: number, invoiceId?: string): Promise<void> {
    await this.addEvent(userId, {
      type: 'payment_failed',
      date: new Date().toISOString(),
      description: 'Payment failed',
      details: {
        amount: amount / 100, // Convert from cents
        invoiceId
      }
    });
  }

  async addAdminUpdate(userId: string, tier: string, endDate?: string): Promise<void> {
    await this.addEvent(userId, {
      type: 'admin_update',
      date: new Date().toISOString(),
      description: 'Account upgraded by administrator',
      details: {
        status: 'active',
        tier,
        endDate
      }
    });
  }

  async addTierChanged(userId: string, fromTier: string, toTier: string): Promise<void> {
    await this.addEvent(userId, {
      type: 'tier_changed',
      date: new Date().toISOString(),
      description: `Account tier changed from ${fromTier} to ${toTier}`,
      details: {
        tier: toTier
      }
    });
  }

  async addSubscriptionContinued(userId: string, subscriptionId: string, renewalDate?: string): Promise<void> {
    await this.addEvent(userId, {
      type: 'subscription_continued',
      date: new Date().toISOString(),
      description: 'Subscription continued - cancellation reversed',
      details: {
        status: 'active',
        tier: 'premium',
        subscriptionId,
        renewalDate
      }
    });
  }

  // Utility method to get user ID from Stripe customer ID
  async getUserIdFromCustomerId(customerId: string): Promise<string | null> {
    try {
      const usersRef = this.firestore.collection('users');
      const snapshot = await usersRef.where('stripeCustomerId', '==', customerId).limit(1).get();
      
      if (snapshot.empty) {
        console.warn('[SubscriptionHistoryService] No user found for customer ID:', customerId);
        return null;
      }

      return snapshot.docs[0].id;
    } catch (error) {
      console.error('[SubscriptionHistoryService] Error finding user by customer ID:', error);
      return null;
    }
  }
}

export const subscriptionHistoryService = SubscriptionHistoryService.getInstance();