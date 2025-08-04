import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify admin secret
    const adminSecret = req.headers['x-admin-secret'] as string;
    if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { identifier } = req.body;

    if (!identifier || typeof identifier !== 'string') {
      return res.status(400).json({ error: 'User identifier is required' });
    }

    const { auth: adminAuth, db: adminDb } = getFirebaseAdmin();
    let targetUserRecord;
    let firestoreUser;

    try {
      // Try to get user by email first, then by UID
      if (identifier.includes('@')) {
        targetUserRecord = await adminAuth.getUserByEmail(identifier);
      } else {
        targetUserRecord = await adminAuth.getUser(identifier);
      }

      // Get additional user data from Firestore
      const userDoc = await adminDb.collection('users').doc(targetUserRecord.uid).get();
      firestoreUser = userDoc.exists ? userDoc.data() : {};

    } catch (authError: any) {
      console.error('Error fetching user from Auth:', authError);
      return res.status(404).json({ error: 'User not found in Firebase Auth' });
    }

    // Combine Auth and Firestore data
    const userData = {
      uid: targetUserRecord.uid,
      email: targetUserRecord.email || 'No email',
      displayName: firestoreUser?.displayName || targetUserRecord.displayName || 'Not set',
      isEmailVerified: targetUserRecord.emailVerified,
      joinDate: targetUserRecord.metadata.creationTime,
      lastUpdated: targetUserRecord.metadata.lastSignInTime || targetUserRecord.metadata.creationTime,
      accountTier: firestoreUser?.accountTier || 'free'
    };

    return res.status(200).json({ 
      success: true, 
      user: userData 
    });

  } catch (error: any) {
    console.error('Error in lookup-user-verification:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}