import { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeAdminApp } from '@/lib/firebase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Initialize Firebase Admin
    const { app } = initializeAdminApp();
    const auth = getAuth(app);
    const db = getFirestore(app);

    // Get email from request body
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if the email exists in Firebase Auth
    let authUser = null;
    try {
      authUser = await auth.getUserByEmail(email);
    } catch (error: any) {
      // If the user doesn't exist in Auth, return empty result
      if (error.code === 'auth/user-not-found') {
        return res.status(200).json({
          exists: false,
          authProviders: [],
          firestoreUsers: []
        });
      }
      throw error;
    }

    // Get the user's auth providers
    const userRecord = await auth.getUser(authUser.uid);
    const authProviders = userRecord.providerData.map(provider => provider.providerId);

    // Check if the email exists in Firestore
    const usersRef = db.collection('users');
    const emailQuery = usersRef.where('email', '==', email);
    const emailSnapshot = await emailQuery.get();

    // Collect all Firestore users with this email
    const firestoreUsers = emailSnapshot.docs.map(doc => ({
      uid: doc.id,
      ...doc.data()
    }));

    // Return the results
    return res.status(200).json({
      exists: true,
      authUser: {
        uid: authUser.uid,
        email: authUser.email,
        emailVerified: authUser.emailVerified,
        displayName: authUser.displayName,
        photoURL: authUser.photoURL,
        disabled: authUser.disabled,
        creationTime: authUser.metadata.creationTime,
        lastSignInTime: authUser.metadata.lastSignInTime,
      },
      authProviders,
      firestoreUsers,
      multipleFirestoreUsers: firestoreUsers.length > 1
    });
  } catch (error: any) {
    console.error('Error checking auth methods:', error);
    return res.status(500).json({
      error: 'Failed to check authentication methods',
      message: error.message,
      code: error.code
    });
  }
}