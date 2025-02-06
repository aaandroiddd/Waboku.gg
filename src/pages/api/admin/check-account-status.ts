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

    const { userId, username } = req.body;
    if (!userId && !username) {
      return res.status(400).json({ error: 'User ID or username is required' });
    }

    const admin = getFirebaseAdmin();
    let targetUserId = userId;

    // If username is provided, search for userId by username
    if (username && !userId) {
      // First try Firestore
      const usersSnapshot = await admin.db.collection('users')
        .where('username', '==', username.toLowerCase())
        .limit(1)
        .get();

      if (!usersSnapshot.empty) {
        targetUserId = usersSnapshot.docs[0].id;
      } else {
        // Try RTDB if not found in Firestore
        const usersSnapshot = await admin.rtdb.ref('users').orderByChild('username')
          .equalTo(username.toLowerCase())
          .once('value');
        
        const userData = usersSnapshot.val();
        if (userData) {
          targetUserId = Object.keys(userData)[0];
        }
      }

      if (!targetUserId) {
        return res.status(404).json({ error: 'User not found with provided username' });
      }
    }

    // First try to get user data from Firestore
    const firestoreDoc = await admin.db.collection('users').doc(targetUserId).get();
    let userData = null;
    let subscription = null;
    let accountTier = 'free';

    if (firestoreDoc.exists) {
      userData = firestoreDoc.data();
      console.log('Found user in Firestore:', targetUserId);
      
      // Try to get subscription data from Firestore
      const subscriptionDoc = await admin.db.collection('users').doc(targetUserId).collection('account').doc('subscription').get();
      if (subscriptionDoc.exists) {
        subscription = subscriptionDoc.data();
      }

      // Try to get account tier from Firestore
      const accountDoc = await admin.db.collection('users').doc(targetUserId).collection('account').doc('tier').get();
      if (accountDoc.exists) {
        accountTier = accountDoc.data()?.tier || 'free';
      }
    }

    // If not found in Firestore, try Realtime Database
    if (!userData) {
      console.log('User not found in Firestore, checking RTDB:', targetUserId);
      const userSnapshot = await admin.rtdb.ref(`users/${targetUserId}`).get();
      userData = userSnapshot.val();

      if (userData) {
        console.log('Found user in RTDB:', targetUserId);
        // Get subscription data if exists
        const subscriptionSnapshot = await admin.rtdb.ref(`users/${targetUserId}/account/subscription`).get();
        subscription = subscriptionSnapshot.exists() ? subscriptionSnapshot.val() : null;

        // Get account tier
        const accountTierSnapshot = await admin.rtdb.ref(`users/${targetUserId}/account/tier`).get();
        accountTier = accountTierSnapshot.exists() ? accountTierSnapshot.val() : 'free';
      }
    }

    if (!userData) {
      console.log('User not found in either database:', targetUserId);
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({
      userId: targetUserId,
      username: userData.username,
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