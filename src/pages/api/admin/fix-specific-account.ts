import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('[fix-specific-account] Starting request handling');
  
  try {
    // Method validation
    if (req.method !== 'POST') {
      console.error('[fix-specific-account] Method not allowed:', req.method);
      return res.status(405).json({ error: 'Method not allowed. Use POST request.' });
    }

    // Auth validation
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('[fix-specific-account] Missing or invalid authorization header');
      return res.status(401).json({ error: 'Unauthorized. Missing or invalid authorization header.' });
    }

    const adminSecret = authHeader.split(' ')[1];
    if (!process.env.ADMIN_SECRET) {
      console.error('[fix-specific-account] ADMIN_SECRET environment variable is not set');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    if (adminSecret !== process.env.ADMIN_SECRET) {
      console.error('[fix-specific-account] Invalid admin secret');
      return res.status(401).json({ error: 'Unauthorized. Invalid admin secret.' });
    }

    // Input validation
    const { userId, accountTier } = req.body;
    console.log('[fix-specific-account] Request body:', { userId, accountTier });

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
    const firestoreTimestamp = admin.db.Timestamp.fromDate(now);

    // Initialize update promises array
    const updatePromises = [];
    let userFound = false;

    // Check user existence first
    console.log('[fix-specific-account] Checking user existence');
    
    try {
      const [firestoreDoc, rtdbSnapshot] = await Promise.all([
        db.collection('users').doc(userId).get(),
        rtdb.ref(`users/${userId}`).get()
      ]);

      userFound = firestoreDoc.exists || rtdbSnapshot.exists();
      
      if (!userFound) {
        console.error('[fix-specific-account] User not found:', userId);
        return res.status(404).json({ error: 'User not found' });
      }
    } catch (existenceError: any) {
      console.error('[fix-specific-account] Error checking user existence:', {
        error: existenceError.message,
        stack: existenceError.stack
      });
      return res.status(500).json({ 
        error: 'Failed to check user existence',
        details: existenceError.message
      });
    }

    // Update Firestore
    try {
      console.log('[fix-specific-account] Updating Firestore');
      
      const firestoreData = {
        accountTier,
        updatedAt: firestoreTimestamp,
        subscriptionStatus: accountTier === 'premium' ? 'active' : 'inactive'
      };

      updatePromises.push(
        db.collection('users').doc(userId).set(firestoreData, { merge: true })
          .then(() => console.log('[fix-specific-account] Firestore main document updated'))
      );

      const tierData = {
        tier: accountTier,
        updatedAt: firestoreTimestamp
      };

      updatePromises.push(
        db.collection('users').doc(userId).collection('account').doc('tier').set(tierData)
          .then(() => console.log('[fix-specific-account] Firestore tier document updated'))
      );
    } catch (firestoreError: any) {
      console.error('[fix-specific-account] Firestore update error:', {
        error: firestoreError.message,
        stack: firestoreError.stack
      });
      // Continue with RTDB update even if Firestore fails
      console.log('[fix-specific-account] Continuing with RTDB update despite Firestore error');
    }

    // Update RTDB
    try {
      console.log('[fix-specific-account] Updating RTDB');
      
      const rtdbData = {
        'account/tier': accountTier,
        'account/updatedAt': timestamp,
        'account/subscriptionStatus': accountTier === 'premium' ? 'active' : 'inactive'
      };

      updatePromises.push(
        rtdb.ref(`users/${userId}`).update(rtdbData)
          .then(() => console.log('[fix-specific-account] RTDB updated successfully'))
      );
    } catch (rtdbError: any) {
      console.error('[fix-specific-account] RTDB update error:', {
        error: rtdbError.message,
        stack: rtdbError.stack
      });
      // Continue if RTDB update fails
      console.log('[fix-specific-account] Continuing despite RTDB error');
    }

    // Execute all updates
    try {
      console.log('[fix-specific-account] Executing all database updates');
      await Promise.allSettled(updatePromises);
      
      // Check if any updates were successful
      const results = await Promise.allSettled(updatePromises);
      const successfulUpdates = results.filter(result => result.status === 'fulfilled').length;
      
      if (successfulUpdates === 0) {
        throw new Error('All database updates failed');
      }
      
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