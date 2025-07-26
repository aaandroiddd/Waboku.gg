import type { NextApiRequest, NextApiResponse } from 'next';

// Simple cleanup endpoint that avoids all problematic imports
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('[CleanupSimple] Starting simple cleanup request...');
    
    // Get the authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization token required' });
    }

    const token = authHeader.split('Bearer ')[1];
    console.log('[CleanupSimple] Token received, length:', token ? token.length : 0);
    
    // Basic token validation
    if (!token || token.length < 100) {
      return res.status(401).json({ error: 'Invalid token format' });
    }

    // Initialize Firebase Admin using dynamic import to avoid module loading issues
    let admin: any;
    let db: any;
    let auth: any;
    
    try {
      // Use dynamic import to load firebase-admin
      admin = await import('firebase-admin');
      
      // Initialize Firebase Admin if not already initialized
      if (!admin.apps.length) {
        const serviceAccount = {
          type: "service_account",
          project_id: process.env.FIREBASE_PROJECT_ID,
          private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
          private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
          client_email: process.env.FIREBASE_CLIENT_EMAIL,
          client_id: process.env.FIREBASE_CLIENT_ID,
          auth_uri: "https://accounts.google.com/o/oauth2/auth",
          token_uri: "https://oauth2.googleapis.com/token",
          auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
          client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.FIREBASE_CLIENT_EMAIL}`
        };

        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
        });
      }

      db = admin.database();
      auth = admin.auth();
      
    } catch (initError: any) {
      console.error('[CleanupSimple] Firebase initialization error:', initError.message);
      return res.status(500).json({ 
        error: 'Firebase initialization failed',
        details: initError.message 
      });
    }

    // Verify the token
    let decodedToken: any;
    try {
      decodedToken = await auth.verifyIdToken(token);
      console.log('[CleanupSimple] Token verified for user:', decodedToken.uid);
    } catch (tokenError: any) {
      console.error('[CleanupSimple] Token verification failed:', tokenError.message);
      return res.status(401).json({ error: 'Invalid authentication token' });
    }

    const userId = decodedToken.uid;
    
    // Get all message threads for the user
    const threadsRef = db.ref('messageThreads');
    const userThreadsSnapshot = await threadsRef.orderByChild(`participants/${userId}`).equalTo(true).once('value');
    const userThreads = userThreadsSnapshot.val() || {};
    
    console.log('[CleanupSimple] Found', Object.keys(userThreads).length, 'threads for user');
    
    let cleanedCount = 0;
    const errors: string[] = [];
    
    // Check each thread for orphaned status
    for (const [threadId, threadData] of Object.entries(userThreads)) {
      try {
        const thread = threadData as any;
        
        // Check if thread has any messages
        const messagesRef = db.ref(`messages/${threadId}`);
        const messagesSnapshot = await messagesRef.once('value');
        const messages = messagesSnapshot.val();
        
        // If no messages exist, this is an orphaned thread
        if (!messages || Object.keys(messages).length === 0) {
          console.log('[CleanupSimple] Removing orphaned thread:', threadId);
          
          // Remove the thread
          await threadsRef.child(threadId).remove();
          cleanedCount++;
        }
      } catch (threadError: any) {
        console.error('[CleanupSimple] Error processing thread', threadId, ':', threadError.message);
        errors.push(`Thread ${threadId}: ${threadError.message}`);
      }
    }
    
    console.log('[CleanupSimple] Cleanup completed. Cleaned:', cleanedCount, 'Errors:', errors.length);
    
    return res.status(200).json({
      success: true,
      cleaned: cleanedCount,
      errors: errors,
      message: cleanedCount > 0 
        ? `Successfully removed ${cleanedCount} empty conversation${cleanedCount === 1 ? '' : 's'}`
        : 'No orphaned threads found - all conversations are valid'
    });

  } catch (error: any) {
    console.error('[CleanupSimple] Unexpected error:', error.message);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}