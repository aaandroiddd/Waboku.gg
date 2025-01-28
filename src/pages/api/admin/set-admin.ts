import { NextApiRequest, NextApiResponse } from 'next';
import { getDatabase, ref, set, get } from '@firebase/database';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { adminSecret, userId } = req.body;

    // Verify admin secret
    if (adminSecret !== process.env.ADMIN_SECRET) {
      console.error('Invalid admin secret provided');
      return res.status(403).json({ error: 'Invalid admin secret' });
    }

    // Verify user exists
    const auth = getAuth();
    try {
      await auth.getUser(userId);
    } catch (error) {
      console.error('User not found:', error);
      return res.status(404).json({ error: 'User not found' });
    }

    // Set admin flag in database
    const db = getDatabase();
    const userRef = ref(db, `users/${userId}`);
    
    // Get current user data
    const snapshot = await get(userRef);
    const userData = snapshot.val() || {};

    // Update user data with admin flag
    await set(userRef, {
      ...userData,
      isAdmin: true
    });

    console.log(`Admin rights granted to user: ${userId}`);
    return res.status(200).json({ message: 'Admin rights granted successfully' });

  } catch (error: any) {
    console.error('Error setting admin rights:', error);
    return res.status(500).json({ error: 'Failed to set admin rights' });
  }
}