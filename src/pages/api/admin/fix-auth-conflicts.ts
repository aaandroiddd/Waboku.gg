import { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeAdminApp } from '@/lib/firebase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify admin secret
  const adminSecret = req.headers['x-admin-secret'];
  if (adminSecret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Initialize Firebase Admin
    const { app } = initializeAdminApp();
    const auth = getAuth(app);
    const db = getFirestore(app);

    // Get email from request body
    const { email, primaryUid } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if the email exists in Firestore
    const usersRef = db.collection('users');
    const emailQuery = usersRef.where('email', '==', email);
    const emailSnapshot = await emailQuery.get();

    // If no users found, return error
    if (emailSnapshot.empty) {
      return res.status(404).json({ error: 'No users found with this email' });
    }

    // If only one user found, no conflict to fix
    if (emailSnapshot.size === 1) {
      return res.status(200).json({ 
        message: 'No conflict detected - only one user found with this email',
        user: {
          uid: emailSnapshot.docs[0].id,
          ...emailSnapshot.docs[0].data()
        }
      });
    }

    // Multiple users found - we need to fix the conflict
    const users = emailSnapshot.docs.map(doc => ({
      uid: doc.id,
      ...doc.data()
    }));

    // If primaryUid is provided, use that as the primary account
    // Otherwise, use the first user as the primary account
    const primaryUser = primaryUid 
      ? users.find(user => user.uid === primaryUid) 
      : users[0];

    if (!primaryUser) {
      return res.status(400).json({ error: 'Primary UID not found among users with this email' });
    }

    // Get the subscription status of all users
    const subscriptionStatuses = users.map(user => ({
      uid: user.uid,
      accountTier: user.accountTier,
      subscription: user.subscription
    }));

    // Determine the highest subscription tier
    let highestTier = 'free';
    let highestTierUser = null;

    for (const user of users) {
      if (user.accountTier === 'premium') {
        highestTier = 'premium';
        highestTierUser = user;
      }
    }

    // Update the primary user with the highest tier if needed
    if (highestTier === 'premium' && primaryUser.accountTier !== 'premium') {
      await db.collection('users').doc(primaryUser.uid).update({
        accountTier: 'premium',
        subscription: {
          ...primaryUser.subscription,
          status: 'active',
          currentPlan: 'premium',
          manuallyUpdated: true,
          updatedAt: new Date().toISOString(),
          notes: 'Upgraded during auth conflict resolution'
        }
      });
    }

    // Return the results
    return res.status(200).json({
      message: 'Auth conflict analysis complete',
      primaryUser,
      allUsers: users,
      subscriptionStatuses,
      highestTier,
      highestTierUser: highestTierUser ? highestTierUser.uid : null,
      action: highestTier === 'premium' && primaryUser.accountTier !== 'premium' 
        ? 'Primary user upgraded to premium' 
        : 'No tier change needed'
    });
  } catch (error: any) {
    console.error('Error fixing auth conflicts:', error);
    return res.status(500).json({
      error: 'Failed to fix authentication conflicts',
      message: error.message,
      code: error.code
    });
  }
}