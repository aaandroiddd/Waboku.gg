import { NextApiRequest, NextApiResponse } from 'next';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];

    // First, check if it's the admin secret
    if (token === process.env.ADMIN_SECRET) {
      return res.status(200).json({ 
        success: true, 
        isAdmin: true, 
        isModerator: false,
        method: 'admin_secret'
      });
    }

    // If not admin secret, try to verify as Firebase ID token
    try {
      const decodedToken = await adminAuth.verifyIdToken(token);
      const userId = decodedToken.uid;

      // Check user's role in Firestore
      const userDoc = await adminDb.collection('users').doc(userId).get();
      
      if (!userDoc.exists) {
        return res.status(401).json({ error: 'User not found' });
      }

      const userData = userDoc.data();
      const isAdmin = userData?.isAdmin === true;
      const isModerator = userData?.isModerator === true;

      if (isAdmin || isModerator) {
        return res.status(200).json({ 
          success: true, 
          isAdmin, 
          isModerator,
          userId,
          method: 'firebase_auth'
        });
      } else {
        return res.status(401).json({ error: 'Access denied - Admin or moderator privileges required' });
      }
    } catch (firebaseError) {
      console.error('Firebase token verification failed:', firebaseError);
      return res.status(401).json({ error: 'Invalid admin secret' });
    }
  } catch (error) {
    console.error('Admin verification error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}