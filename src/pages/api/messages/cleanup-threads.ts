import { NextApiRequest, NextApiResponse } from 'next';
import { cleanupOrphanedThreads } from '@/lib/message-thread-cleanup';

// Dynamic import to avoid module loading issues
async function getFirebaseAdmin() {
  try {
    const { getFirebaseAdmin } = await import('@/lib/firebase-admin');
    return getFirebaseAdmin();
  } catch (error) {
    console.error('Error loading firebase-admin:', error);
    return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization token required' });
    }

    const token = authHeader.split('Bearer ')[1];
    
    // Verify the Firebase ID token
    const admin = await getFirebaseAdmin();
    if (!admin) {
      return res.status(500).json({ error: 'Firebase admin not available' });
    }

    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(token);
    } catch (error) {
      console.error('Error verifying token:', error);
      return res.status(401).json({ error: 'Invalid authentication token' });
    }

    const userId = decodedToken.uid;
    
    console.log(`[ThreadCleanup] Starting cleanup for user: ${userId}`);
    
    // Clean up orphaned threads for the user
    const results = await cleanupOrphanedThreads(userId);
    
    console.log(`[ThreadCleanup] Cleanup completed for user ${userId}:`, results);
    
    return res.status(200).json({
      success: true,
      cleaned: results.cleaned,
      errors: results.errors,
      message: results.cleaned > 0 
        ? `Successfully cleaned up ${results.cleaned} orphaned message threads`
        : 'No orphaned threads found to clean up'
    });

  } catch (error) {
    console.error('Error cleaning up message threads:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}