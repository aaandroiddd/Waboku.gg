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
    console.log('[test-write] Testing Firebase Admin SDK write operation');
    
    // Initialize Firebase Admin
    const { db } = initializeFirebaseAdmin();
    
    // Create a test document
    const testId = `test-${Date.now()}`;
    const testData = {
      id: testId,
      timestamp: new Date().toISOString(),
      test: true
    };
    
    console.log('[test-write] Writing test document:', testId);
    await db.collection('_test_').doc(testId).set(testData);
    
    // Read the document back to verify
    console.log('[test-write] Reading test document:', testId);
    const docSnapshot = await db.collection('_test_').doc(testId).get();
    
    if (!docSnapshot.exists) {
      console.error('[test-write] Test document not found after writing');
      return res.status(500).json({
        success: false,
        message: 'Test document not found after writing',
        details: { testId }
      });
    }
    
    const readData = docSnapshot.data();
    console.log('[test-write] Successfully read test document:', readData);
    
    // Clean up - delete the test document
    console.log('[test-write] Deleting test document:', testId);
    await db.collection('_test_').doc(testId).delete();
    
    return res.status(200).json({
      success: true,
      message: 'Firebase Admin SDK write test successful',
      details: {
        testId,
        writeData: testData,
        readData
      }
    });
  } catch (error: any) {
    console.error('[test-write] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error testing Firebase Admin SDK write operation',
      details: {
        error: error.message,
        stack: error.stack
      }
    });
  }
}