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
    console.log('[test-firebase-admin-enhanced] Testing Firebase Admin SDK initialization');
    
    // Log the private key format (safely)
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    console.log('[test-firebase-admin-enhanced] Private key format check:', {
      exists: !!privateKey,
      length: privateKey ? privateKey.length : 0,
      hasEscapedNewlines: privateKey ? privateKey.includes('\\n') : false,
      hasQuotes: privateKey ? (privateKey.startsWith('"') && privateKey.endsWith('"')) : false,
      hasSingleQuotes: privateKey ? (privateKey.startsWith("'") && privateKey.endsWith("'")) : false,
    });
    
    // Try to initialize Firebase Admin
    console.log('[test-firebase-admin-enhanced] Initializing Firebase Admin...');
    const { admin, db } = initializeFirebaseAdmin();
    console.log('[test-firebase-admin-enhanced] Firebase Admin initialized successfully');
    
    // Test a simple database operation
    try {
      console.log('[test-firebase-admin-enhanced] Testing database access');
      
      // Create a test document
      const testId = `test-${Date.now()}`;
      const testData = {
        id: testId,
        timestamp: new Date().toISOString(),
        test: true
      };
      
      console.log('[test-firebase-admin-enhanced] Writing test document:', testId);
      await db.collection('_test_').doc(testId).set(testData);
      console.log('[test-firebase-admin-enhanced] Write successful');
      
      // Read the document back to verify
      console.log('[test-firebase-admin-enhanced] Reading test document:', testId);
      const docSnapshot = await db.collection('_test_').doc(testId).get();
      
      if (!docSnapshot.exists) {
        console.error('[test-firebase-admin-enhanced] Test document not found after writing');
        return res.status(500).json({
          success: false,
          message: 'Test document not found after writing',
          details: { testId }
        });
      }
      
      const readData = docSnapshot.data();
      console.log('[test-firebase-admin-enhanced] Successfully read test document:', readData);
      
      // Clean up - delete the test document
      console.log('[test-firebase-admin-enhanced] Deleting test document:', testId);
      await db.collection('_test_').doc(testId).delete();
      console.log('[test-firebase-admin-enhanced] Delete successful');
      
      return res.status(200).json({
        success: true,
        message: 'Firebase Admin SDK initialized and database operations successful',
        details: {
          adminInitialized: !!admin,
          dbInitialized: !!db,
          testId,
          writeData: testData,
          readData
        }
      });
    } catch (dbError: any) {
      console.error('[test-firebase-admin-enhanced] Database operation error:', dbError);
      console.error('[test-firebase-admin-enhanced] Error details:', JSON.stringify(dbError, Object.getOwnPropertyNames(dbError)));
      
      return res.status(500).json({
        success: false,
        message: 'Firebase Admin SDK initialized but database operations failed',
        details: {
          error: dbError.message,
          code: dbError.code,
          stack: dbError.stack,
          adminInitialized: !!admin,
          dbInitialized: !!db
        }
      });
    }
  } catch (error: any) {
    console.error('[test-firebase-admin-enhanced] Initialization error:', error);
    console.error('[test-firebase-admin-enhanced] Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    
    return res.status(500).json({
      success: false,
      message: 'Failed to initialize Firebase Admin SDK',
      details: {
        error: error.message,
        code: error.code,
        stack: error.stack
      }
    });
  }
}