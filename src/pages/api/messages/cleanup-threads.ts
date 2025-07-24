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
    console.log('[ThreadCleanup] Starting cleanup request processing...');
    
    // Get the authorization header
    const authHeader = req.headers.authorization;
    console.log('[ThreadCleanup] Authorization header present:', !!authHeader);
    console.log('[ThreadCleanup] Authorization header format:', authHeader ? 'Bearer token detected' : 'No Bearer token');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('[ThreadCleanup] Missing or invalid authorization header');
      return res.status(401).json({ error: 'Authorization token required' });
    }

    const token = authHeader.split('Bearer ')[1];
    console.log('[ThreadCleanup] Token extracted, length:', token ? token.length : 0);
    
    // Verify the Firebase ID token
    console.log('[ThreadCleanup] Getting Firebase Admin instance...');
    const admin = await getFirebaseAdmin();
    if (!admin) {
      console.error('[ThreadCleanup] Firebase admin not available');
      return res.status(500).json({ error: 'Firebase admin not available' });
    }
    console.log('[ThreadCleanup] Firebase Admin instance obtained successfully');

    let decodedToken;
    try {
      console.log('[ThreadCleanup] Attempting to verify ID token...');
      decodedToken = await admin.auth().verifyIdToken(token);
      console.log('[ThreadCleanup] Token verification successful for user:', decodedToken.uid);
    } catch (error: any) {
      console.error('[ThreadCleanup] Token verification failed:', {
        message: error.message,
        code: error.code,
        name: error.name,
        stack: error.stack?.split('\n').slice(0, 3).join('\n')
      });
      
      // Provide more specific error information
      let errorMessage = 'Invalid authentication token';
      if (error.code === 'auth/id-token-expired') {
        errorMessage = 'Authentication token has expired';
      } else if (error.code === 'auth/id-token-revoked') {
        errorMessage = 'Authentication token has been revoked';
      } else if (error.code === 'auth/invalid-id-token') {
        errorMessage = 'Invalid authentication token format';
      } else if (error.code === 'auth/project-not-found') {
        errorMessage = 'Firebase project configuration error';
      }
      
      return res.status(401).json({ 
        error: errorMessage,
        code: error.code || 'auth/unknown'
      });
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

  } catch (error: any) {
    console.error('[ThreadCleanup] Unexpected error:', {
      message: error.message,
      name: error.name,
      stack: error.stack?.split('\n').slice(0, 5).join('\n')
    });
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}