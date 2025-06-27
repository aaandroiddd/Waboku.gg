import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('[Admin Verify] Starting verification process');

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[Admin Verify] Missing or invalid authorization header');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    console.log('[Admin Verify] Token received, length:', token.length);

    // First, check if it's the admin secret
    if (token === process.env.ADMIN_SECRET) {
      console.log('[Admin Verify] Admin secret matched');
      return res.status(200).json({ 
        success: true, 
        isAdmin: true, 
        isModerator: false,
        method: 'admin_secret'
      });
    }

    console.log('[Admin Verify] Not admin secret, trying Firebase token verification');

    // If not admin secret, try to verify as Firebase ID token
    try {
      const { auth, db } = getFirebaseAdmin();
      console.log('[Admin Verify] Got Firebase admin instances');
      
      const decodedToken = await auth.verifyIdToken(token);
      const userId = decodedToken.uid;
      console.log('[Admin Verify] Firebase token verified for user:', userId);

      // Check user's role in Firestore
      const userDoc = await db.collection('users').doc(userId).get();
      console.log('[Admin Verify] User document exists:', userDoc.exists);
      
      if (!userDoc.exists) {
        console.log('[Admin Verify] User document not found in Firestore');
        return res.status(401).json({ error: 'User not found' });
      }

      const userData = userDoc.data();
      const isAdmin = userData?.isAdmin === true;
      const isModerator = userData?.isModerator === true;
      
      console.log('[Admin Verify] User roles:', { isAdmin, isModerator, userData: { isAdmin: userData?.isAdmin, isModerator: userData?.isModerator } });

      if (isAdmin || isModerator) {
        console.log('[Admin Verify] User authorized with roles:', { isAdmin, isModerator });
        return res.status(200).json({ 
          success: true, 
          isAdmin, 
          isModerator,
          userId,
          method: 'firebase_auth'
        });
      } else {
        console.log('[Admin Verify] User lacks required privileges');
        return res.status(401).json({ error: 'Access denied - Admin or moderator privileges required' });
      }
    } catch (firebaseError: any) {
      console.error('[Admin Verify] Firebase token verification failed:', {
        message: firebaseError.message,
        code: firebaseError.code,
        name: firebaseError.name
      });
      return res.status(401).json({ error: 'Invalid admin secret' });
    }
  } catch (error: any) {
    console.error('[Admin Verify] General error:', {
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 3).join('\n')
    });
    return res.status(500).json({ error: 'Internal server error' });
  }
}