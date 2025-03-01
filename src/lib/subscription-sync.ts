import { getFirestore } from 'firebase-admin/firestore';
import { getDatabase } from 'firebase-admin/database';
import { getFirebaseAdmin } from './firebase-admin';

/**
 * Synchronizes subscription data between Firestore and Realtime Database
 * Firestore will be the source of truth for subscription data
 */
export async function syncSubscriptionData(userId: string, subscriptionData: any) {
  try {
    console.log(`[Subscription Sync] Starting sync for user ${userId}`);
    
    // Initialize Firebase Admin if not already initialized
    getFirebaseAdmin();
    
    // Get references to both databases
    const firestore = getFirestore();
    const realtimeDb = getDatabase();
    
    // Format the subscription data for Firestore
    const firestoreData = {
      accountTier: subscriptionData.tier || subscriptionData.currentPlan || 'free',
      updatedAt: new Date().toISOString(),
      subscription: {
        status: subscriptionData.status || 'none',
        stripeSubscriptionId: subscriptionData.stripeSubscriptionId,
        startDate: subscriptionData.startDate,
        endDate: subscriptionData.endDate,
        renewalDate: subscriptionData.renewalDate || subscriptionData.currentPeriodEnd 
          ? new Date(subscriptionData.currentPeriodEnd * 1000).toISOString() 
          : undefined,
        currentPlan: subscriptionData.tier || subscriptionData.currentPlan,
        manuallyUpdated: subscriptionData.manuallyUpdated || false,
        lastManualUpdate: subscriptionData.manuallyUpdated ? new Date().toISOString() : undefined
      }
    };
    
    // Format the subscription data for Realtime Database
    const realtimeData = {
      tier: subscriptionData.tier || subscriptionData.currentPlan || 'free',
      status: subscriptionData.status || 'none',
      lastUpdated: Date.now(),
      subscription: {
        status: subscriptionData.status || 'none',
        tier: subscriptionData.tier || subscriptionData.currentPlan || 'free',
        stripeSubscriptionId: subscriptionData.stripeSubscriptionId,
        startDate: subscriptionData.startDate,
        endDate: subscriptionData.endDate,
        renewalDate: subscriptionData.renewalDate,
        currentPeriodEnd: subscriptionData.currentPeriodEnd,
        manuallyUpdated: subscriptionData.manuallyUpdated || false,
        lastUpdated: Date.now()
      }
    };
    
    // Update Firestore (primary source of truth)
    await firestore.collection('users').doc(userId).set(firestoreData, { merge: true });
    console.log(`[Subscription Sync] Updated Firestore for user ${userId}`);
    
    // Update Realtime Database (secondary source)
    await realtimeDb.ref(`users/${userId}/account`).update(realtimeData);
    console.log(`[Subscription Sync] Updated Realtime Database for user ${userId}`);
    
    return {
      success: true,
      message: 'Subscription data synchronized successfully'
    };
  } catch (error: any) {
    console.error('[Subscription Sync] Error synchronizing subscription data:', {
      userId,
      error: error.message,
      stack: error.stack
    });
    
    return {
      success: false,
      error: error.message,
      message: 'Failed to synchronize subscription data'
    };
  }
}

/**
 * Retrieves subscription data from Firestore (primary source)
 * Falls back to Realtime Database if Firestore data is not available
 */
export async function getSubscriptionData(userId: string) {
  try {
    console.log(`[Subscription Data] Retrieving data for user ${userId}`);
    
    // Initialize Firebase Admin if not already initialized
    getFirebaseAdmin();
    
    // Get references to both databases
    const firestore = getFirestore();
    const realtimeDb = getDatabase();
    
    // First try to get data from Firestore (primary source)
    const firestoreDoc = await firestore.collection('users').doc(userId).get();
    const firestoreData = firestoreDoc.exists ? firestoreDoc.data() : null;
    
    if (firestoreData && firestoreData.subscription) {
      console.log(`[Subscription Data] Found data in Firestore for user ${userId}`);
      return {
        source: 'firestore',
        data: {
          accountTier: firestoreData.accountTier || 'free',
          ...firestoreData.subscription
        }
      };
    }
    
    // If not in Firestore, try Realtime Database
    const realtimeSnapshot = await realtimeDb.ref(`users/${userId}/account`).once('value');
    const realtimeData = realtimeSnapshot.exists() ? realtimeSnapshot.val() : null;
    
    if (realtimeData && realtimeData.subscription) {
      console.log(`[Subscription Data] Found data in Realtime Database for user ${userId}`);
      
      // Sync this data back to Firestore for future consistency
      await syncSubscriptionData(userId, realtimeData.subscription);
      
      return {
        source: 'realtime',
        data: {
          accountTier: realtimeData.tier || 'free',
          ...realtimeData.subscription
        }
      };
    }
    
    // No subscription data found in either database
    console.log(`[Subscription Data] No subscription data found for user ${userId}`);
    return {
      source: 'none',
      data: {
        accountTier: 'free',
        status: 'none'
      }
    };
  } catch (error: any) {
    console.error('[Subscription Data] Error retrieving subscription data:', {
      userId,
      error: error.message,
      stack: error.stack
    });
    
    return {
      source: 'error',
      error: error.message,
      data: {
        accountTier: 'free',
        status: 'none'
      }
    };
  }
}