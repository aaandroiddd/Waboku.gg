import { NextApiRequest, NextApiResponse } from 'next';
import { getFirestore } from 'firebase-admin/firestore';
import { initAdmin } from '@/lib/firebase-admin';

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

    // Initialize Firebase Admin
    console.log('Initializing Firebase Admin...');
    const app = initAdmin();
    const db = getFirestore(app);

    // Get user document
    console.log('Fetching user document...');
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      console.error('User not found:', userId);
      return res.status(404).json({ error: 'User not found' });
    }

    // Update user's tier
    console.log('Updating user tier...');
    await userRef.update({
      accountTier: tier,
      updatedAt: new Date(),
      'subscription.manuallyUpdated': true,
      'subscription.lastManualUpdate': new Date()
    });

    console.log(`Successfully updated user ${userId} to ${tier} tier`);

    return res.status(200).json({
      message: `Successfully updated user tier`,
      userId,
      newTier: tier
    });

  } catch (error: any) {
    console.error('Error in update-user-tier:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message // Adding error details for debugging
    });
  }
}