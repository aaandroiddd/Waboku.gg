import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(400).json({ error: 'Method not allowed. Use POST request.' });
  }

  // Verify admin secret from header
  const adminSecret = req.headers.authorization?.split(' ')[1];
  if (adminSecret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized. Invalid admin secret.' });
  }

  const { userId, accountTier = 'premium' } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  try {
    const admin = getFirebaseAdmin();
    const now = new Date();

    // Update Firestore with specified tier for the user
    await admin.db.collection('users').doc(userId).update({
      accountTier,
      updatedAt: now,
      subscriptionStatus: accountTier === 'premium' ? 'active' : 'inactive'
    });

    console.log('Account status updated for user:', {
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
    console.error('Error updating account status:', error);
    return res.status(500).json({ 
      error: 'Failed to update account status',
      details: error.message,
      stack: error.stack
    });
  }
}