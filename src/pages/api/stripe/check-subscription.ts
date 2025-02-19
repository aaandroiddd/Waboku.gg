import { NextApiRequest, NextApiResponse } from 'next';
import { getFirestore } from 'firebase-admin/firestore';
import { getDatabase } from 'firebase-admin/database';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.info('[Subscription Check] Started:', {
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString()
  });

  if (req.method !== 'GET') {
    console.warn('[Subscription Check] Invalid method:', {
      method: req.method,
      url: req.url
    });
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const userId = idToken; // In preview, we'll use the token as userId for simplicity

    // Initialize Firebase Admin
    getFirebaseAdmin();
    const realtimeDb = getDatabase();

    // Get subscription data from Realtime Database
    const userRef = realtimeDb.ref(`users/${userId}/account`);
    const snapshot = await userRef.once('value');
    const accountData = snapshot.val();

    if (!accountData || !accountData.subscription) {
      console.log('[Subscription Check] No subscription found:', { userId });
      return res.status(200).json({ 
        isPremium: false,
        status: 'none',
        tier: 'free'
      });
    }

    const { subscription } = accountData;
    const now = Date.now() / 1000; // Convert to seconds for comparison with Stripe timestamps
    const isActive = subscription.status === 'active' && 
                    subscription.currentPeriodEnd && 
                    subscription.currentPeriodEnd > now;

    console.log('[Subscription Check] Status:', {
      userId,
      isActive,
      subscription: {
        status: subscription.status,
        tier: subscription.tier,
        currentPeriodEnd: subscription.currentPeriodEnd
      }
    });

    return res.status(200).json({
      isPremium: isActive && subscription.tier === 'premium',
      status: subscription.status,
      tier: subscription.tier,
      currentPeriodEnd: subscription.currentPeriodEnd
    });

  } catch (error) {
    console.error('[Subscription Check] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}