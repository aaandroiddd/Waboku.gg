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
    const timestamp = now.toISOString();

    // Initialize update promises array
    const updatePromises = [];

    // Check if user exists in Firestore
    console.log('Checking Firestore for user:', userId);
    const firestoreDoc = await admin.firestore().collection('users').doc(userId).get();
    
    if (firestoreDoc.exists) {
      console.log('User found in Firestore, preparing updates');
      
      const firestoreData = {
        accountTier,
        updatedAt: admin.firestore.Timestamp.fromDate(now),
        subscriptionStatus: accountTier === 'premium' ? 'active' : 'inactive'
      };

      // Add Firestore update promises
      updatePromises.push(
        admin.firestore().collection('users').doc(userId).set(firestoreData, { merge: true })
      );

      const tierData = {
        tier: accountTier,
        updatedAt: admin.firestore.Timestamp.fromDate(now)
      };

      updatePromises.push(
        admin.firestore().collection('users').doc(userId).collection('account').doc('tier').set(tierData)
      );
    } else {
      console.log('User not found in Firestore');
    }

    // Check if user exists in RTDB
    console.log('Checking RTDB for user:', userId);
    const rtdbRef = admin.database().ref(`users/${userId}`);
    const rtdbSnapshot = await rtdbRef.get();
    
    if (rtdbSnapshot.exists()) {
      console.log('User found in RTDB, preparing update');
      
      const rtdbData = {
        'account/tier': accountTier,
        'account/updatedAt': timestamp,
        'account/subscriptionStatus': accountTier === 'premium' ? 'active' : 'inactive'
      };

      // Add RTDB update promise
      updatePromises.push(rtdbRef.update(rtdbData));
    } else {
      console.log('User not found in RTDB');
    }

    if (updatePromises.length === 0) {
      console.log('No user found in any database:', userId);
      return res.status(404).json({ error: 'User not found in any database' });
    }

    // Execute all updates
    console.log('Executing database updates');
    await Promise.all(updatePromises);

    const successResponse = {
      success: true,
      message: 'Account status updated successfully',
      userId,
      newTier: accountTier,
      updatedAt: timestamp
    };

    console.log('Account status updated successfully:', successResponse);

    return res.status(200).json(successResponse);
  } catch (error: any) {
    console.error('Error updating account status:', {
      userId,
      accountTier,
      errorMessage: error.message,
      errorCode: error.code,
      errorStack: error.stack
    });
    
    return res.status(500).json({ 
      error: 'Failed to update account status',
      details: error.message,
      code: error.code || 'UNKNOWN_ERROR'
    });
  }
}