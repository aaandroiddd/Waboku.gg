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
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      console.error('[fix-specific-account] Missing authorization header');
      return res.status(401).json({ error: 'Unauthorized. Missing authorization header.' });
    }

    const adminSecret = authHeader.split(' ')[1];
    if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
      console.error('[fix-specific-account] Invalid admin secret');
      return res.status(401).json({ error: 'Unauthorized. Invalid admin secret.' });
    }

    // Input validation
    const { userId, accountTier } = req.body;

    if (!userId) {
      console.error('[fix-specific-account] Missing userId in request body');
      return res.status(400).json({ error: 'User ID is required' });
    }

    if (!accountTier || !['premium', 'free'].includes(accountTier)) {
      console.error('[fix-specific-account] Invalid account tier:', accountTier);
      return res.status(400).json({ error: 'Invalid account tier. Must be "premium" or "free".' });
    }

    console.log('[fix-specific-account] Starting update process for:', { userId, accountTier });

    // Initialize Firebase Admin
    let admin;
    try {
      admin = getFirebaseAdmin();
    } catch (firebaseError: any) {
      console.error('[fix-specific-account] Firebase initialization error:', {
        error: firebaseError.message,
        stack: firebaseError.stack
      });
      return res.status(500).json({ 
        error: 'Failed to initialize Firebase',
        details: firebaseError.message
      });
    }

    const { db, rtdb } = admin;
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
        console.log('[fix-specific-account] User found in Firestore');
        userFound = true;
        
        const firestoreData = {
          accountTier,
          updatedAt: firestoreTimestamp,
          subscriptionStatus: accountTier === 'premium' ? 'active' : 'inactive'
        };

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
      }
    } catch (firestoreError: any) {
      console.error('[fix-specific-account] Firestore operation error:', {
        error: firestoreError.message,
        stack: firestoreError.stack
      });
      return res.status(500).json({ 
        error: 'Firestore operation failed',
        details: firestoreError.message
      });
    }

    // Check and update RTDB
    try {
      console.log('[fix-specific-account] Checking RTDB for user:', userId);
      const rtdbRef = rtdb.ref(`users/${userId}`);
      const rtdbSnapshot = await rtdbRef.get();
      
      if (rtdbSnapshot.exists()) {
        console.log('[fix-specific-account] User found in RTDB');
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
      }
    } catch (rtdbError: any) {
      console.error('[fix-specific-account] RTDB operation error:', {
        error: rtdbError.message,
        stack: rtdbError.stack
      });
      return res.status(500).json({ 
        error: 'RTDB operation failed',
        details: rtdbError.message
      });
    }

    if (!userFound) {
      console.error('[fix-specific-account] User not found in any database:', userId);
      return res.status(404).json({ error: 'User not found in any database' });
    }

    // Execute all updates
    try {
      console.log('[fix-specific-account] Executing all database updates');
      await Promise.all(updatePromises);
    } catch (updateError: any) {
      console.error('[fix-specific-account] Failed to execute updates:', {
        error: updateError.message,
        stack: updateError.stack
      });
      return res.status(500).json({ 
        error: 'Failed to execute database updates',
        details: updateError.message
      });
    }

    const successResponse = {
      success: true,
      message: 'Account status updated successfully',
      userId,
      newTier: accountTier,
      updatedAt: timestamp
    };

    console.log('[fix-specific-account] Update completed successfully:', successResponse);
    return res.status(200).json(successResponse);

  } catch (error: any) {
    // Enhanced error logging for unexpected errors
    console.error('[fix-specific-account] Unexpected error:', {
      error: {
        message: error.message,
        code: error.code,
        stack: error.stack,
        details: error.details || 'No additional details',
        name: error.name,
        cause: error.cause,
      },
      request: {
        body: req.body,
        headers: {
          ...req.headers,
          authorization: '[REDACTED]'
        }
      }
    });
    
    return res.status(500).json({ 
      error: 'An unexpected error occurred',
      details: error.message,
      code: error.code || 'UNKNOWN_ERROR',
      name: error.name
    });
  }
}