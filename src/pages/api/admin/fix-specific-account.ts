import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    console.log('Method not allowed:', req.method);
    return res.status(400).json({ error: 'Method not allowed. Use POST request.' });
  }

  // Verify admin secret from header
  const adminSecret = req.headers.authorization?.split(' ')[1];
  if (adminSecret !== process.env.ADMIN_SECRET) {
    console.log('Unauthorized access attempt');
    return res.status(401).json({ error: 'Unauthorized. Invalid admin secret.' });
  }

  const { userId, accountTier = 'premium' } = req.body;

  if (!userId) {
    console.log('Missing userId in request body');
    return res.status(400).json({ error: 'User ID is required' });
  }

  console.log('Processing update request for:', { userId, accountTier });

  try {
    const admin = getFirebaseAdmin();
    const now = new Date();

    // Check if user exists in Firestore
    const firestoreDoc = await admin.firestore().collection('users').doc(userId).get();
    
    if (firestoreDoc.exists) {
      console.log('Updating user in Firestore:', userId);
      // Update Firestore
      await admin.firestore().collection('users').doc(userId).set({
        accountTier,
        updatedAt: now,
        subscriptionStatus: accountTier === 'premium' ? 'active' : 'inactive'
      }, { merge: true });

      // Update account collection
      await admin.firestore().collection('users').doc(userId).collection('account').doc('tier').set({
        tier: accountTier,
        updatedAt: now
      });
    }

    // Check if user exists in RTDB
    const rtdbSnapshot = await admin.database().ref(`users/${userId}`).get();
    
    if (rtdbSnapshot.exists()) {
      console.log('Updating user in RTDB:', userId);
      // Update RTDB
      await admin.database().ref(`users/${userId}/account`).update({
        tier: accountTier,
        updatedAt: now.toISOString(),
        subscriptionStatus: accountTier === 'premium' ? 'active' : 'inactive'
      });
    }

    if (!firestoreDoc.exists && !rtdbSnapshot.exists()) {
      console.log('User not found in any database:', userId);
      return res.status(404).json({ error: 'User not found in any database' });
    }

    console.log('Account status updated successfully for user:', {
      userId,
      newTier: accountTier,
      timestamp: now.toISOString()
    });

    return res.status(200).json({ 
      success: true, 
      message: 'Account status updated successfully',
      userId,
      newTier: accountTier,
      updatedAt: now.toISOString()
    });
  } catch (error: any) {
    console.error('Error updating account status:', {
      error: error.message,
      stack: error.stack,
      userId,
      accountTier
    });
    return res.status(500).json({ 
      error: 'Failed to update account status',
      details: error.message
    });
  }
}