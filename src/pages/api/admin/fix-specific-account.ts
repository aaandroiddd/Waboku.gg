import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Method validation
    if (req.method !== 'POST') {
      console.error('[fix-specific-account] Method not allowed:', req.method);
      return res.status(400).json({ error: 'Method not allowed. Use POST request.' });
    }

    // Auth validation
    const adminSecret = req.headers.authorization?.split(' ')[1];
    if (adminSecret !== process.env.ADMIN_SECRET) {
      console.error('[fix-specific-account] Unauthorized access attempt');
      return res.status(401).json({ error: 'Unauthorized. Invalid admin secret.' });
    }

    // Input validation
    const { userId, accountTier = 'premium' } = req.body;

    if (!userId) {
      console.error('[fix-specific-account] Missing userId in request body');
      return res.status(400).json({ error: 'User ID is required' });
    }

    console.log('[fix-specific-account] Processing update request:', { userId, accountTier });

    const { db, rtdb } = getFirebaseAdmin();
    const now = new Date();
    const timestamp = now.toISOString();
    const firestoreTimestamp = db.Timestamp.fromDate(now);

    // Initialize update promises array
    const updatePromises = [];
    let userFound = false;

    // Check and update Firestore
    try {
      console.log('[fix-specific-account] Checking Firestore for user:', userId);
      const firestoreDoc = await db.collection('users').doc(userId).get();
      
      if (firestoreDoc.exists) {
        console.log('[fix-specific-account] User found in Firestore, preparing updates');
        userFound = true;
        
        const firestoreData = {
          accountTier,
          updatedAt: firestoreTimestamp,
          subscriptionStatus: accountTier === 'premium' ? 'active' : 'inactive'
        };

        // Add Firestore update promises
        updatePromises.push(
          db.collection('users').doc(userId).set(firestoreData, { merge: true })
            .then(() => console.log('[fix-specific-account] Firestore main document updated'))
            .catch(error => {
              console.error('[fix-specific-account] Error updating Firestore main document:', error);
              throw error;
            })
        );

        const tierData = {
          tier: accountTier,
          updatedAt: firestoreTimestamp
        };

        updatePromises.push(
          db.collection('users').doc(userId).collection('account').doc('tier').set(tierData)
            .then(() => console.log('[fix-specific-account] Firestore tier document updated'))
            .catch(error => {
              console.error('[fix-specific-account] Error updating Firestore tier document:', error);
              throw error;
            })
        );
      } else {
        console.log('[fix-specific-account] User not found in Firestore');
      }
    } catch (firestoreError) {
      console.error('[fix-specific-account] Firestore operation error:', firestoreError);
      throw firestoreError;
    }

    // Check and update RTDB
    try {
      console.log('[fix-specific-account] Checking RTDB for user:', userId);
      const rtdbRef = rtdb.ref(`users/${userId}`);
      const rtdbSnapshot = await rtdbRef.get();
      
      if (rtdbSnapshot.exists()) {
        console.log('[fix-specific-account] User found in RTDB, preparing update');
        userFound = true;
        
        const rtdbData = {
          'account/tier': accountTier,
          'account/updatedAt': timestamp,
          'account/subscriptionStatus': accountTier === 'premium' ? 'active' : 'inactive'
        };

        updatePromises.push(
          rtdbRef.update(rtdbData)
            .then(() => console.log('[fix-specific-account] RTDB updated successfully'))
            .catch(error => {
              console.error('[fix-specific-account] Error updating RTDB:', error);
              throw error;
            })
        );
      } else {
        console.log('[fix-specific-account] User not found in RTDB');
      }
    } catch (rtdbError) {
      console.error('[fix-specific-account] RTDB operation error:', rtdbError);
      throw rtdbError;
    }

    if (!userFound) {
      console.error('[fix-specific-account] User not found in any database:', userId);
      return res.status(404).json({ error: 'User not found in any database' });
    }

    // Execute all updates
    console.log('[fix-specific-account] Executing database updates');
    await Promise.all(updatePromises);

    const successResponse = {
      success: true,
      message: 'Account status updated successfully',
      userId,
      newTier: accountTier,
      updatedAt: timestamp
    };

    console.log('[fix-specific-account] Account status updated successfully:', successResponse);
    return res.status(200).json(successResponse);

  } catch (error: any) {
    console.error('[fix-specific-account] Critical error:', {
      error: {
        message: error.message,
        code: error.code,
        stack: error.stack,
        details: error.details || 'No additional details'
      }
    });
    
    return res.status(500).json({ 
      error: 'Failed to update account status',
      details: error.message,
      code: error.code || 'UNKNOWN_ERROR'
    });
  }
}