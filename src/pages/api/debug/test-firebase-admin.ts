import type { NextApiRequest, NextApiResponse } from 'next';
import { initializeFirebaseAdmin } from '@/lib/firebase-admin';

type ResponseData = {
  success: boolean;
  message: string;
  details?: any;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  try {
    console.log('[test-firebase-admin] Testing Firebase Admin SDK initialization');
    
    // Log the private key format (safely)
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    console.log('[test-firebase-admin] Private key format check:', {
      exists: !!privateKey,
      length: privateKey ? privateKey.length : 0,
      hasEscapedNewlines: privateKey ? privateKey.includes('\\n') : false,
      hasQuotes: privateKey ? (privateKey.startsWith('"') && privateKey.endsWith('"')) : false,
      hasSingleQuotes: privateKey ? (privateKey.startsWith("'") && privateKey.endsWith("'")) : false,
    });
    
    // Try to initialize Firebase Admin
    const { admin, db } = initializeFirebaseAdmin();
    
    // Test a simple database operation
    try {
      console.log('[test-firebase-admin] Testing database access');
      const testDoc = await db.collection('_test_').doc('test').get();
      console.log('[test-firebase-admin] Database access successful');
      
      return res.status(200).json({
        success: true,
        message: 'Firebase Admin SDK initialized successfully',
        details: {
          adminInitialized: !!admin,
          dbInitialized: !!db,
          testDocExists: testDoc.exists
        }
      });
    } catch (dbError: any) {
      console.error('[test-firebase-admin] Database access error:', dbError);
      return res.status(500).json({
        success: false,
        message: 'Firebase Admin SDK initialized but database access failed',
        details: {
          error: dbError.message,
          code: dbError.code,
          adminInitialized: !!admin,
          dbInitialized: !!db
        }
      });
    }
  } catch (error: any) {
    console.error('[test-firebase-admin] Initialization error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to initialize Firebase Admin SDK',
      details: {
        error: error.message,
        code: error.code
      }
    });
  }
}