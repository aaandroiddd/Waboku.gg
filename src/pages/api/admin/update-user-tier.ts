import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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
    const admin = getFirebaseAdmin();
    console.log('Firebase Admin initialized successfully');

    // Get user document
    console.log('Fetching user document...');
    const db = admin.firestore();
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      console.error('User not found:', userId);
      return res.status(404).json({ error: 'User not found' });
    }

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
    const rtdb = admin.database();
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
    console.error('Error in update-user-tier:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message
    });
  }
}