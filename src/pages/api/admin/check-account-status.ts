import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify admin secret
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    if (token !== process.env.ADMIN_SECRET) {
      return res.status(401).json({ error: 'Invalid admin secret' });
    }

    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const admin = getFirebaseAdmin();

    // First try to get user data from Firestore
    const firestoreDoc = await admin.firestore.collection('users').doc(userId).get();
    let userData = null;
    let subscription = null;
    let accountTier = 'free';

    if (firestoreDoc.exists) {
      userData = firestoreDoc.data();
      console.log('Found user in Firestore:', userId);
      
      // Try to get subscription data from Firestore
      const subscriptionDoc = await admin.firestore.collection('users').doc(userId).collection('account').doc('subscription').get();
      if (subscriptionDoc.exists) {
        subscription = subscriptionDoc.data();
      }

      // Try to get account tier from Firestore
      const accountDoc = await admin.firestore.collection('users').doc(userId).collection('account').doc('tier').get();
      if (accountDoc.exists) {
        accountTier = accountDoc.data()?.tier || 'free';
      }
    }

    // If not found in Firestore, try Realtime Database
    if (!userData) {
      console.log('User not found in Firestore, checking RTDB:', userId);
      const userSnapshot = await admin.rtdb.ref(`users/${userId}`).get();
      userData = userSnapshot.val();

      if (userData) {
        console.log('Found user in RTDB:', userId);
        // Get subscription data if exists
        const subscriptionSnapshot = await admin.rtdb.ref(`users/${userId}/account/subscription`).get();
        subscription = subscriptionSnapshot.exists() ? subscriptionSnapshot.val() : null;

        // Get account tier
        const accountTierSnapshot = await admin.rtdb.ref(`users/${userId}/account/tier`).get();
        accountTier = accountTierSnapshot.exists() ? accountTierSnapshot.val() : 'free';
      }
    }

    if (!userData) {
      console.log('User not found in either database:', userId);
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({
      userId,
      accountTier,
      subscription,
      email: userData.email,
      createdAt: userData.createdAt
    });
  } catch (error: any) {
    console.error('Check account status error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}