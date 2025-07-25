import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('[ThreadCleanup] Starting simplified cleanup request...');
    
    // Get the authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization token required' });
    }

    const token = authHeader.split('Bearer ')[1];
    console.log('[ThreadCleanup] Token received, length:', token ? token.length : 0);
    
    // Initialize Firebase Admin with minimal imports
    let admin;
    let decodedToken;
    
    try {
      // Use dynamic import to avoid module loading issues
      const firebaseAdmin = await import('firebase-admin');
      
      // Initialize Firebase Admin if not already initialized
      if (!firebaseAdmin.apps.length) {
        const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
        
        admin = firebaseAdmin.initializeApp({
          credential: firebaseAdmin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: privateKey,
          }),
          databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
        });
      } else {
        admin = firebaseAdmin.app();
      }
      
      // Verify the token
      decodedToken = await admin.auth().verifyIdToken(token);
      console.log('[ThreadCleanup] Token verified for user:', decodedToken.uid);
      
    } catch (error: any) {
      console.error('[ThreadCleanup] Firebase initialization or token verification failed:', error.message);
      return res.status(401).json({ 
        error: 'Authentication failed',
        details: error.message 
      });
    }

    const userId = decodedToken.uid;
    
    // Import and run cleanup function
    try {
      const { cleanupOrphanedThreads } = await import('@/lib/message-thread-cleanup');
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
      
    } catch (cleanupError: any) {
      console.error('[ThreadCleanup] Cleanup function failed:', cleanupError.message);
      return res.status(500).json({ 
        error: 'Cleanup failed',
        details: cleanupError.message 
      });
    }

  } catch (error: any) {
    console.error('[ThreadCleanup] Unexpected error:', error.message);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}