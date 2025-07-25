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
    console.log('[ThreadCleanup] Environment check:', {
      hasProjectId: !!process.env.FIREBASE_PROJECT_ID,
      hasPublicProjectId: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      hasClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
      hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY,
      privateKeyLength: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.length : 0,
      projectIdMatch: process.env.FIREBASE_PROJECT_ID === process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
    });
    
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
    console.log('[ThreadCleanup] Token format check:', {
      startsWithEy: token ? token.startsWith('ey') : false,
      hasDots: token ? (token.match(/\./g) || []).length : 0,
      firstChars: token ? token.substring(0, 10) + '...' : 'none'
    });
    
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
      console.log('[ThreadCleanup] Using Firebase project ID:', process.env.FIREBASE_PROJECT_ID);
      
      // Try to decode the token without verification first to see its contents
      try {
        const tokenParts = token.split('.');
        if (tokenParts.length === 3) {
          const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
          console.log('[ThreadCleanup] Token payload preview:', {
            iss: payload.iss,
            aud: payload.aud,
            exp: payload.exp,
            iat: payload.iat,
            uid: payload.uid ? payload.uid.substring(0, 8) + '...' : 'none',
            currentTime: Math.floor(Date.now() / 1000),
            isExpired: payload.exp < Math.floor(Date.now() / 1000)
          });
          
          // Check if the audience matches our project ID
          const expectedAudience = process.env.FIREBASE_PROJECT_ID;
          if (payload.aud !== expectedAudience) {
            console.error('[ThreadCleanup] Token audience mismatch:', {
              tokenAudience: payload.aud,
              expectedAudience: expectedAudience
            });
          }
          
          // Check if the issuer is correct
          const expectedIssuer = `https://securetoken.google.com/${process.env.FIREBASE_PROJECT_ID}`;
          if (payload.iss !== expectedIssuer) {
            console.error('[ThreadCleanup] Token issuer mismatch:', {
              tokenIssuer: payload.iss,
              expectedIssuer: expectedIssuer
            });
          }
        }
      } catch (decodeError) {
        console.error('[ThreadCleanup] Error decoding token for preview:', decodeError);
      }
      
      decodedToken = await admin.auth().verifyIdToken(token);
      console.log('[ThreadCleanup] Token verification successful for user:', decodedToken.uid);
    } catch (error: any) {
      console.error('[ThreadCleanup] Token verification failed:', {
        message: error.message,
        code: error.code,
        name: error.name,
        stack: error.stack?.split('\n').slice(0, 3).join('\n')
      });
      
      // Additional debugging for specific error types
      if (error.code === 'auth/project-not-found') {
        console.error('[ThreadCleanup] Project not found - check Firebase project configuration');
      } else if (error.code === 'auth/invalid-id-token') {
        console.error('[ThreadCleanup] Invalid ID token - token may be malformed or from wrong project');
      } else if (error.message && error.message.includes('audience')) {
        console.error('[ThreadCleanup] Audience mismatch - client and server may be using different Firebase projects');
      }
      
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
      } else if (error.message && error.message.includes('audience')) {
        errorMessage = 'Token project mismatch - please refresh the page and try again';
      }
      
      return res.status(401).json({ 
        error: errorMessage,
        code: error.code || 'auth/unknown',
        debug: process.env.NODE_ENV === 'development' ? {
          projectId: process.env.FIREBASE_PROJECT_ID,
          publicProjectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          errorCode: error.code,
          errorMessage: error.message
        } : undefined
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