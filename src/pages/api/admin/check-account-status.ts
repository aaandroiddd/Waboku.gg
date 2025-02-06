import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log('[check-account-status] Starting request handling');
  
  if (req.method !== 'POST') {
    console.log('[check-account-status] Invalid method:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify admin secret
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[check-account-status] Missing or invalid authorization header');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    if (!process.env.ADMIN_SECRET) {
      console.error('[check-account-status] ADMIN_SECRET environment variable is not set');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    if (token !== process.env.ADMIN_SECRET) {
      console.log('[check-account-status] Invalid admin secret provided');
      return res.status(401).json({ error: 'Invalid admin secret' });
    }

    const { userId, username } = req.body;
    const searchTerm = username || userId;
    
    console.log('[check-account-status] Search term:', searchTerm);
    
    if (!searchTerm) {
      console.log('[check-account-status] No search term provided');
      return res.status(400).json({ error: 'Search term is required' });
    }

    const admin = getFirebaseAdmin();
    let targetUserId = null;
    let userData = null;

    // First try to find by userId in Firestore
    console.log('[check-account-status] Checking Firestore by userId');
    const firestoreUserDoc = await admin.db.collection('users').doc(searchTerm).get();
    if (firestoreUserDoc.exists) {
      console.log('[check-account-status] User found in Firestore by userId');
      targetUserId = searchTerm;
      userData = firestoreUserDoc.data();
    }

    // If not found, try RTDB by userId
    if (!userData) {
      console.log('[check-account-status] Checking RTDB by userId');
      const rtdbUserSnapshot = await admin.rtdb.ref(`users/${searchTerm}`).get();
      if (rtdbUserSnapshot.exists()) {
        console.log('[check-account-status] User found in RTDB by userId');
        targetUserId = searchTerm;
        userData = rtdbUserSnapshot.val();
      }
    }

    // If still not found, search by username in Firestore
    if (!userData) {
      console.log('[check-account-status] Checking Firestore by username');
      const firestoreUsernameQuery = await admin.db.collection('users')
        .where('username', '==', searchTerm.toLowerCase())
        .limit(1)
        .get();

      if (!firestoreUsernameQuery.empty) {
        console.log('[check-account-status] User found in Firestore by username');
        const doc = firestoreUsernameQuery.docs[0];
        targetUserId = doc.id;
        userData = doc.data();
      }
    }

    // Finally, try RTDB username search
    if (!userData) {
      console.log('[check-account-status] Checking RTDB by username');
      const rtdbUsernameQuery = await admin.rtdb.ref('users')
        .orderByChild('username')
        .equalTo(searchTerm.toLowerCase())
        .once('value');
      
      const rtdbData = rtdbUsernameQuery.val();
      if (rtdbData) {
        console.log('[check-account-status] User found in RTDB by username');
        targetUserId = Object.keys(rtdbData)[0];
        userData = rtdbData[targetUserId];
      }
    }

    if (!userData || !targetUserId) {
      console.log('[check-account-status] User not found for search term:', searchTerm);
      return res.status(404).json({ error: 'User not found' });
    }

    // Get subscription and account tier data
    let subscription = null;
    let accountTier = 'free';

    console.log('[check-account-status] Fetching subscription and tier data for user:', targetUserId);

    // Try Firestore first
    const subscriptionDoc = await admin.db.collection('users').doc(targetUserId)
      .collection('account').doc('subscription').get();
    if (subscriptionDoc.exists) {
      subscription = subscriptionDoc.data();
      console.log('[check-account-status] Found subscription in Firestore');
    }

    const accountDoc = await admin.db.collection('users').doc(targetUserId)
      .collection('account').doc('tier').get();
    if (accountDoc.exists) {
      accountTier = accountDoc.data()?.tier || 'free';
      console.log('[check-account-status] Found account tier in Firestore:', accountTier);
    }

    // If not found in Firestore, try RTDB
    if (!subscription) {
      const rtdbSubscriptionSnapshot = await admin.rtdb.ref(`users/${targetUserId}/account/subscription`).get();
      if (rtdbSubscriptionSnapshot.exists()) {
        subscription = rtdbSubscriptionSnapshot.val();
        console.log('[check-account-status] Found subscription in RTDB');
      }
    }

    if (accountTier === 'free') {
      const rtdbTierSnapshot = await admin.rtdb.ref(`users/${targetUserId}/account/tier`).get();
      if (rtdbTierSnapshot.exists()) {
        accountTier = rtdbTierSnapshot.val();
        console.log('[check-account-status] Found account tier in RTDB:', accountTier);
      }
    }

    const response = {
      userId: targetUserId,
      username: userData.username,
      accountTier,
      subscription,
      email: userData.email,
      createdAt: userData.createdAt
    };

    console.log('[check-account-status] Returning successful response:', response);
    return res.status(200).json(response);
  } catch (error: any) {
    console.error('[check-account-status] Error:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}