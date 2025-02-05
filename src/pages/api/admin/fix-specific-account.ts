import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

const SPECIFIC_USER_ID = 'PlXySPUa5QM0hc0jpWu2N3hECgm1';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(400).json({ error: 'Method not allowed. Use GET request.' });
  }

  // Verify admin secret from query parameter for easier access
  const adminSecret = req.query.adminSecret as string;
  if (adminSecret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized. Invalid admin secret.' });
  }

  try {
    const { firestore } = getFirebaseAdmin();
    const now = new Date();

    // Update Firestore with premium tier for the specific user
    await firestore.collection('users').doc(SPECIFIC_USER_ID).update({
      accountTier: 'premium',
      updatedAt: now,
      subscriptionStatus: 'active'
    });

    console.log('Account status updated for specific user:', {
      userId: SPECIFIC_USER_ID,
      newTier: 'premium',
      timestamp: now.toISOString()
    });

    return res.status(200).json({ 
      success: true, 
      message: 'Account status updated successfully for the specific user',
      userId: SPECIFIC_USER_ID,
      newTier: 'premium',
      updatedAt: now.toISOString()
    });
  } catch (error: any) {
    console.error('Error updating account status:', error);
    return res.status(500).json({ 
      error: 'Failed to update account status',
      details: error.message 
    });
  }
}