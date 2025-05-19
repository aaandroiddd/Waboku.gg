import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { restoreIncorrectlyArchivedListings } from '@/lib/listing-expiration';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('[Restore Archived] Starting restore process', new Date().toISOString());
  
  if (req.method !== 'POST') {
    console.warn('[Restore Archived] Invalid method:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify authentication
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    console.warn('[Restore Archived] Missing or invalid authorization header');
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Missing or invalid authorization token'
    });
  }

  // Extract the token
  const idToken = authHeader.split('Bearer ')[1];
  
  try {
    // Initialize Firebase Admin and verify token
    const { admin } = getFirebaseAdmin();
    
    // Verify the token and get user data
    const decodedToken = await admin.auth().verifyIdToken(idToken, true);
    const userId = decodedToken.uid;
    
    console.log(`[Restore Archived] Authenticated user ${userId}`);
    
    // Get the target user ID from the request body
    const { targetUserId } = req.body;
    
    // If targetUserId is provided and different from authenticated user,
    // check if the authenticated user is an admin
    if (targetUserId && targetUserId !== userId) {
      // Check if user is admin
      const userDoc = await admin.firestore().collection('users').doc(userId).get();
      const userData = userDoc.data();
      
      const isAdmin = userData?.isAdmin === true || 
                     (userData?.roles && 
                      (userData.roles === 'admin' || 
                       (Array.isArray(userData.roles) && userData.roles.includes('admin'))));
      
      if (!isAdmin) {
        console.warn(`[Restore Archived] User ${userId} attempted to restore listings for another user ${targetUserId}`);
        return res.status(403).json({ 
          error: 'Forbidden',
          message: 'You do not have permission to restore listings for other users'
        });
      }
      
      console.log(`[Restore Archived] Admin ${userId} restoring listings for user ${targetUserId}`);
      
      // Use the target user ID for restoration
      const result = await restoreIncorrectlyArchivedListings(targetUserId);
      return res.status(200).json(result);
    }
    
    // User is restoring their own listings
    console.log(`[Restore Archived] User ${userId} restoring their own listings`);
    const result = await restoreIncorrectlyArchivedListings(userId);
    return res.status(200).json(result);
  } catch (error: any) {
    console.error('[Restore Archived] Error:', error);
    return res.status(500).json({ 
      error: 'Failed to restore archived listings',
      message: error.message
    });
  }
}