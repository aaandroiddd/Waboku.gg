import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { getDatabase } from 'firebase-admin/database';
import { getFirestore } from 'firebase-admin/firestore';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow this endpoint in development/preview
  if (process.env.NEXT_PUBLIC_CO_DEV_ENV !== 'preview') {
    return res.status(404).json({ error: 'Not found' });
  }

  try {
    const userId = req.method === 'POST' ? req.body.userId : req.query.userId;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    console.log('[Dev Success] Updating subscription for user:', userId);

    // Initialize Firebase Admin and get database references
    const admin = getFirebaseAdmin();
    const realtimeDb = getDatabase();
    const firestoreDb = getFirestore();
    
    // Get current date for subscription dates
    const currentDate = new Date();
    const renewalDate = new Date(currentDate);
    renewalDate.setDate(currentDate.getDate() + 30); // 30 days from now
    
    // Update user's subscription status in Realtime Database
    await realtimeDb.ref(`users/${userId}/account`).update({
      tier: 'premium',
      status: 'active',
      subscription: {
        status: 'active',
        tier: 'premium',
        stripeSubscriptionId: `preview_${Date.now()}`,
        startDate: currentDate.toISOString(),
        renewalDate: renewalDate.toISOString(),
        currentPeriodEnd: Math.floor(renewalDate.getTime() / 1000),
        lastUpdated: Date.now()
      }
    });
    
    // Also update Firestore for consistency
    await firestoreDb.collection('users').doc(userId).set({
      accountTier: 'premium', // Top-level field for easier queries
      subscription: {
        currentPlan: 'premium',
        status: 'active',
        startDate: currentDate.toISOString(),
        endDate: renewalDate.toISOString(),
        stripeSubscriptionId: `preview_${Date.now()}`
      }
    }, { merge: true });

    console.log('[Dev Success] Successfully updated subscription for user:', userId);

    // If it's a GET request, redirect to the account status page
    if (req.method === 'GET') {
      res.redirect(307, '/dashboard/account-status?upgrade=success');
      return;
    }

    return res.status(200).json({ 
      success: true,
      message: 'Subscription updated successfully',
      details: {
        tier: 'premium',
        startDate: currentDate.toISOString(),
        renewalDate: renewalDate.toISOString()
      }
    });
  } catch (error) {
    console.error('[Dev Success] Error updating subscription:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}