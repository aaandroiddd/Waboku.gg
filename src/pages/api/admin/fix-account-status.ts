import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  // Verify admin secret
  const adminSecret = req.headers.authorization?.split(' ')[1];
  if (adminSecret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { rtdb } = getFirebaseAdmin();
    
    // Update account status in Firebase
    await rtdb.ref(`users/${userId}/account`).set({
      tier: 'premium',
      subscription: {
        status: 'active',
        startDate: new Date().toISOString(),
        renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
        stripeSubscriptionId: `restored_${Date.now()}`
      }
    });

    return res.status(200).json({ 
      success: true, 
      message: 'Account status updated successfully',
      userId
    });
  } catch (error: any) {
    console.error('Error updating account status:', error);
    return res.status(500).json({ 
      error: 'Failed to update account status',
      details: error.message 
    });
  }
}