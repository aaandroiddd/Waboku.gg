import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

// Initialize Firestore and Auth using Firebase Admin
const { db, auth } = getFirebaseAdmin();

/**
 * Middleware to check if the user is a moderator or admin
 */
export const moderatorAuthMiddleware = async (
  req: NextApiRequest,
  res: NextApiResponse,
  next: () => void
) => {
  // Check for admin secret first (admins can access moderator routes)
  const adminSecret = req.headers['x-admin-secret'] as string;
  if (adminSecret && adminSecret === process.env.ADMIN_SECRET) {
    return next();
  }

  // If no admin secret, check for moderator role via Firebase auth
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split('Bearer ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Verify the token
    const decodedToken = await auth.verifyIdToken(token);
    const uid = decodedToken.uid;

    // Check if user has moderator role
    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    
    if (!userSnap.exists) {
      return res.status(403).json({ error: 'Forbidden - User not found' });
    }

    const userData = userSnap.data();
    const isAdmin = userData.roles?.includes('admin') || false;
    const isModerator = userData.roles?.includes('moderator') || false;

    if (!isAdmin && !isModerator) {
      return res.status(403).json({ error: 'Forbidden - Insufficient permissions' });
    }

    // User is a moderator or admin, proceed
    return next();
  } catch (error) {
    console.error('Error verifying moderator status:', error);
    return res.status(401).json({ error: 'Unauthorized' });
  }
};

/**
 * Helper function to check if a user is a moderator
 */
export const isUserModerator = async (userId: string): Promise<boolean> => {
  try {
    const userRef = db.collection('users').doc(userId);
    const userSnap = await userRef.get();
    
    if (!userSnap.exists) {
      return false;
    }

    const userData = userSnap.data();
    return userData.roles?.includes('admin') || userData.roles?.includes('moderator') || false;
  } catch (error) {
    console.error('Error checking moderator status:', error);
    return false;
  }
};