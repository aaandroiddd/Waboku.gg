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
    const searchTerm = username || userId;
    
    if (!searchTerm) {
      return res.status(400).json({ error: 'Search term is required' });
    }

    const admin = getFirebaseAdmin();
    let targetUserId = null;
    let userData = null;

    // First try to find by userId in Firestore
    const firestoreUserDoc = await admin.db.collection('users').doc(searchTerm).get();
    if (firestoreUserDoc.exists) {
      targetUserId = searchTerm;
      userData = firestoreUserDoc.data();
    }

    // If not found, try RTDB by userId
    if (!userData) {
      const rtdbUserSnapshot = await admin.rtdb.ref(`users/${searchTerm}`).get();
      if (rtdbUserSnapshot.exists()) {
        targetUserId = searchTerm;
        userData = rtdbUserSnapshot.val();
      }
    }

    // If still not found, search by username in Firestore
    if (!userData) {
      const firestoreUsernameQuery = await admin.db.collection('users')
        .where('username', '==', searchTerm.toLowerCase())
        .limit(1)
        .get();

      if (!firestoreUsernameQuery.empty) {
        const doc = firestoreUsernameQuery.docs[0];
        targetUserId = doc.id;
        userData = doc.data();
      }
    }

    // Finally, try RTDB username search
    if (!userData) {
      const rtdbUsernameQuery = await admin.rtdb.ref('users')
        .orderByChild('username')
        .equalTo(searchTerm.toLowerCase())
        .once('value');
      
      const rtdbData = rtdbUsernameQuery.val();
      if (rtdbData) {
        targetUserId = Object.keys(rtdbData)[0];
        userData = rtdbData[targetUserId];
      }
    }

    if (!userData || !targetUserId) {
      console.log('User not found for search term:', searchTerm);
      return res.status(404).json({ error: 'User not found' });
    }

    // Get subscription and account tier data
    let subscription = null;
    let accountTier = 'free';

    // Try Firestore first
    const subscriptionDoc = await admin.db.collection('users').doc(targetUserId)
      .collection('account').doc('subscription').get();
    if (subscriptionDoc.exists) {
      subscription = subscriptionDoc.data();
    }

    const accountDoc = await admin.db.collection('users').doc(targetUserId)
      .collection('account').doc('tier').get();
    if (accountDoc.exists) {
      accountTier = accountDoc.data()?.tier || 'free';
    }

    // If not found in Firestore, try RTDB
    if (!subscription) {
      const rtdbSubscriptionSnapshot = await admin.rtdb.ref(`users/${targetUserId}/account/subscription`).get();
      if (rtdbSubscriptionSnapshot.exists()) {
        subscription = rtdbSubscriptionSnapshot.val();
      }
    }

    if (accountTier === 'free') {
      const rtdbTierSnapshot = await admin.rtdb.ref(`users/${targetUserId}/account/tier`).get();
      if (rtdbTierSnapshot.exists()) {
        accountTier = rtdbTierSnapshot.val();
      }
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