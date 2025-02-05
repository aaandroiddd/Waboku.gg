import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(400).json({ error: 'Method not allowed' });
  }

  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  // Verify admin secret
  const adminSecret = req.headers.authorization?.split(' ')[1];
  if (adminSecret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { rtdb, firestore } = getFirebaseAdmin();
    
    // Get current data from both databases
    const rtdbSnapshot = await rtdb.ref(`users/${userId}/account`).get();
    const firestoreDoc = await firestore.collection('users').doc(userId).get();

    const rtdbData = rtdbSnapshot.val();
    const firestoreData = firestoreDoc.data();

    console.log('Current data:', {
      rtdb: rtdbData,
      firestore: firestoreData
    });

    // Determine correct account status
    const subscriptionData = rtdbData?.subscription || {};
    const now = new Date();
    const endDate = subscriptionData.endDate ? new Date(subscriptionData.endDate) : null;
    
    const isActivePremium = (
      subscriptionData.status === 'active' ||
      (subscriptionData.status === 'canceled' && endDate && endDate > now) ||
      (subscriptionData.stripeSubscriptionId && !subscriptionData.status)
    );

    const correctTier = isActivePremium ? 'premium' : 'free';

    // Update Firestore
    await firestore.collection('users').doc(userId).update({
      accountTier: correctTier,
      updatedAt: now
    });

    // Update Realtime Database
    await rtdb.ref(`users/${userId}/account`).update({
      tier: correctTier,
      lastChecked: now.toISOString()
    });

    console.log('Account status updated:', {
      userId,
      newTier: correctTier,
      subscriptionStatus: subscriptionData.status,
      hasStripeId: !!subscriptionData.stripeSubscriptionId
    });

    return res.status(200).json({ 
      success: true, 
      message: 'Account status updated successfully',
      userId,
      newTier: correctTier,
      subscriptionDetails: {
        status: subscriptionData.status,
        stripeSubscriptionId: subscriptionData.stripeSubscriptionId,
        endDate: subscriptionData.endDate
      }
    });
  } catch (error: any) {
    console.error('Error updating account status:', error);
    return res.status(500).json({ 
      error: 'Failed to update account status',
      details: error.message 
    });
  }
}