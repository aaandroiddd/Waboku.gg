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

    const { userId } = req.body;

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const { auth: adminAuth, db: adminDb } = getFirebaseAdmin();

    // Get current user record
    let targetUserRecord;
    try {
      targetUserRecord = await adminAuth.getUser(userId);
    } catch (authError: any) {
      console.error('Error fetching user from Auth:', authError);
      return res.status(404).json({ error: 'User not found in Firebase Auth' });
    }

    // Check if already verified
    if (targetUserRecord.emailVerified) {
      return res.status(400).json({ 
        error: 'User email is already verified',
        message: 'This user\'s email is already verified' 
      });
    }

    // Update the user's email verification status in Firebase Auth
    try {
      await adminAuth.updateUser(userId, {
        emailVerified: true
      });
    } catch (updateError: any) {
      console.error('Error updating user verification status:', updateError);
      return res.status(500).json({ 
        error: 'Failed to update email verification status',
        details: updateError.message 
      });
    }

    // Update Firestore user document with verification timestamp
    try {
      const userDocRef = adminDb.collection('users').doc(userId);
      await userDocRef.update({
        isEmailVerified: true,
        emailVerifiedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      });
    } catch (firestoreError: any) {
      console.error('Error updating Firestore user document:', firestoreError);
      // Don't fail the request if Firestore update fails, as Auth update succeeded
      console.warn('Auth update succeeded but Firestore update failed');
    }

    // Get updated user data
    const updatedUserRecord = await adminAuth.getUser(userId);
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const firestoreUser = userDoc.exists ? userDoc.data() : {};

    const updatedUserData = {
      uid: updatedUserRecord.uid,
      email: updatedUserRecord.email || 'No email',
      displayName: firestoreUser?.displayName || updatedUserRecord.displayName || 'Not set',
      isEmailVerified: updatedUserRecord.emailVerified,
      joinDate: updatedUserRecord.metadata.creationTime,
      lastUpdated: updatedUserRecord.metadata.lastSignInTime || updatedUserRecord.metadata.creationTime,
      accountTier: firestoreUser?.accountTier || 'free'
    };

    return res.status(200).json({ 
      success: true,
      message: `Email verification successfully enabled for user ${updatedUserRecord.email}`,
      updatedUser: updatedUserData
    });

  } catch (error: any) {
    console.error('Error in enable-email-verification:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}