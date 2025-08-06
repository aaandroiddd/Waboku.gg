import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

const { db, auth } = getFirebaseAdmin();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check admin authorization
  const authHeader = req.headers.authorization;
  const adminSecret = authHeader?.replace('Bearer ', '');
  
  if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    let userId: string;
    let userRecord;

    // Check if query looks like a user ID (Firebase UIDs are typically 28 characters)
    if (query.length === 28 && !query.includes('@')) {
      userId = query;
      try {
        userRecord = await auth.getUser(userId);
      } catch (error) {
        return res.status(404).json({ error: 'User not found' });
      }
    } else {
      // Assume it's an email
      try {
        userRecord = await auth.getUserByEmail(query);
        userId = userRecord.uid;
      } catch (error) {
        return res.status(404).json({ error: 'User not found' });
      }
    }

    // Get user data from Firestore
    const userDocRef = db.collection('users').doc(userId);
    const userDoc = await userDocRef.get();
    
    const userData = userDoc.exists ? userDoc.data() : {};

    // Check if user has Stripe Connect account
    const hasStripeAccount = !!userData.stripeConnectAccountId;

    // Format the response
    const userInfo = {
      userId: userRecord.uid,
      email: userRecord.email || 'No email',
      displayName: userRecord.displayName || userData.username || 'Not set',
      isEligible: userData.stripeConnectEligible === true,
      approvedBy: userData.stripeConnectApprovedBy,
      approvedAt: userData.stripeConnectApprovedAt?.toDate()?.toISOString(),
      reason: userData.stripeConnectApprovalReason,
      hasStripeAccount,
      accountCreatedAt: userRecord.metadata.creationTime
    };

    res.status(200).json({ user: userInfo });
  } catch (error) {
    console.error('Error looking up user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}