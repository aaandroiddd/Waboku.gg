import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Declare variables at the top level so they're available in catch block
  let firebaseAdminInstance: typeof admin | null = null;
  let firestoreDb: admin.firestore.Firestore | null = null;
  let rtdb: admin.database.Database | null = null;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify admin secret from either header
    const adminSecret = req.headers['x-admin-secret'] || 
                       (req.headers['authorization'] || '').replace('Bearer ', '');

    if (adminSecret !== process.env.ADMIN_SECRET) {
      console.error('Admin secret mismatch:', { 
        provided: adminSecret ? 'provided' : 'not provided',
        expected: process.env.ADMIN_SECRET ? 'configured' : 'not configured'
      });
      return res.status(401).json({ error: 'Unauthorized - Invalid admin secret' });
    }

    const { userId, tier } = req.body;
    console.log('Received request:', { userId, tier });

    // Validate input
    if (!userId || !tier) {
      return res.status(400).json({ error: 'Missing required fields: userId and tier' });
    }

    if (!['free', 'premium'].includes(tier)) {
      return res.status(400).json({ error: 'Invalid tier. Must be either "free" or "premium"' });
    }

    // Initialize Firebase Admin and get Firestore instance
    const firebaseAdminResult = getFirebaseAdmin();
    firebaseAdminInstance = firebaseAdminResult.admin;
    firestoreDb = firebaseAdminResult.db;
    
    // Log Firebase Admin initialization details for debugging
    console.log('Firebase Admin initialized with:', {
      hasAdmin: !!firebaseAdminInstance,
      hasFirestore: !!firestoreDb,
      hasDatabase: !!firebaseAdminResult.database,
      adminType: typeof firebaseAdminInstance,
      firestoreType: typeof firestoreDb
    });

    if (!firebaseAdminInstance || !firestoreDb) {
      throw new Error('Failed to initialize Firebase Admin or Firestore');
    }

    // Get user document
    console.log('Fetching user document...');
    const userRef = firestoreDb.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      console.error('User not found:', userId);
      return res.status(404).json({ error: 'User not found' });
    }

    // Get server timestamp
    const now = admin.firestore.FieldValue.serverTimestamp();

    // Update user's subscription and account status in Firestore
    console.log('Updating user tier in Firestore...');
    const updateData = {
      accountTier: tier,
      lastUpdated: now,
      subscription: {
        currentPlan: tier,
        tier: tier, // Explicitly set tier field
        status: tier === 'premium' ? 'active' : 'none',
        manuallyUpdated: true,
        lastManualUpdate: now,
        startDate: now,
        endDate: tier === 'premium' ? null : now,
        stripeSubscriptionId: tier === 'premium' ? `admin_${userId}_${Date.now()}` : null,
        currentPeriodEnd: tier === 'premium' ? Math.floor(Date.now() / 1000) + 31536000 : Math.floor(Date.now() / 1000) // 1 year from now for premium
      }
    };

    await userRef.update(updateData);
    
    // Also update Realtime Database to ensure consistency
    console.log('Syncing user tier to Realtime Database...');
    rtdb = firebaseAdminResult.database;
    
    if (!rtdb) {
      throw new Error('Failed to initialize Realtime Database');
    }
    
    const rtdbUserRef = rtdb.ref(`users/${userId}/account/subscription`);
    
    const rtdbUpdateData = {
      tier: tier,
      status: tier === 'premium' ? 'active' : 'none',
      manuallyUpdated: true,
      currentPeriodEnd: tier === 'premium' ? Math.floor(Date.now() / 1000) + 31536000 : Math.floor(Date.now() / 1000),
      stripeSubscriptionId: tier === 'premium' ? updateData.subscription.stripeSubscriptionId : null
    };
    
    await rtdbUserRef.update(rtdbUpdateData);

    console.log(`Successfully updated user ${userId} to ${tier} tier with data:`, updateData);

    // Get updated user data to confirm changes
    const updatedDoc = await userRef.get();
    console.log('Updated user data:', updatedDoc.data());

    return res.status(200).json({
      message: `Successfully updated user tier`,
      userId,
      newTier: tier,
      updatedData: updatedDoc.data()
    });

  } catch (error: any) {
    // Detailed error logging
    console.error('Error in update-user-tier:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      name: error.name,
      // Add more detailed debugging information
      errorType: typeof error,
      hasFirebaseAdmin: !!firebaseAdminInstance,
      hasFirestore: !!firestoreDb,
      hasDatabase: !!rtdb,
      firebaseAdminType: firebaseAdminInstance ? typeof firebaseAdminInstance : 'null',
      firestoreType: firestoreDb ? typeof firestoreDb : 'null',
      databaseType: rtdb ? typeof rtdb : 'null'
    });
    
    // Provide more detailed error information to the client
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message,
      errorType: error.name || typeof error,
      // Include information about what might have gone wrong
      possibleCause: error.message.includes('firestore') 
        ? 'Firebase Firestore initialization issue' 
        : error.message.includes('database')
        ? 'Firebase Realtime Database initialization issue'
        : error.message.includes('FieldValue')
        ? 'Firebase Admin SDK FieldValue access issue'
        : 'Unknown Firebase Admin SDK issue',
      // Add debugging info
      debug: {
        hasFirebaseAdmin: !!firebaseAdminInstance,
        hasFirestore: !!firestoreDb,
        hasDatabase: !!rtdb
      }
    });
  }
}