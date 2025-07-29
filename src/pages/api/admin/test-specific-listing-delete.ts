import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verify admin access
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized - missing authorization header' });
  }
  
  const token = authHeader.split(' ')[1];
  if (token !== process.env.ADMIN_SECRET && token !== process.env.NEXT_PUBLIC_ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized - invalid token' });
  }

  console.log('[Test Specific Listing Delete] Starting diagnostic test', new Date().toISOString());

  try {
    // Initialize Firebase Admin SDK
    const { admin, db } = getFirebaseAdmin();
    
    if (!admin || !db) {
      return res.status(500).json({ 
        error: 'Firebase Admin SDK not initialized properly',
        hasAdmin: !!admin,
        hasDb: !!db
      });
    }

    const listingId = 'Gze7qt051XMClg9Ur0af';
    
    console.log(`[Test] Step 1: Checking if listing ${listingId} exists`);
    
    // Step 1: Check if listing exists
    const listingRef = db.collection('listings').doc(listingId);
    const listingDoc = await listingRef.get();
    
    if (!listingDoc.exists) {
      return res.status(404).json({ 
        error: 'Listing not found',
        listingId,
        step: 'check_existence'
      });
    }
    
    const listingData = listingDoc.data();
    console.log(`[Test] Step 2: Listing found`, {
      id: listingId,
      status: listingData?.status,
      userId: listingData?.userId,
      title: listingData?.title?.substring(0, 50) + '...'
    });
    
    // Step 2: Try to read the document using different approaches
    console.log(`[Test] Step 3: Testing different read approaches`);
    
    // Approach 1: Direct document read
    try {
      const directRead = await db.collection('listings').doc(listingId).get();
      console.log(`[Test] Direct read successful:`, { exists: directRead.exists });
    } catch (directError: any) {
      console.log(`[Test] Direct read failed:`, { error: directError.message, code: directError.code });
    }
    
    // Approach 2: Query-based read
    try {
      const queryRead = await db.collection('listings').where('__name__', '==', listingId).get();
      console.log(`[Test] Query read successful:`, { size: queryRead.size });
    } catch (queryError: any) {
      console.log(`[Test] Query read failed:`, { error: queryError.message, code: queryError.code });
    }
    
    // Step 3: Test delete operation with detailed error handling
    console.log(`[Test] Step 4: Testing delete operation`);
    
    try {
      // First, let's try a simple delete without any batch operations
      await listingRef.delete();
      console.log(`[Test] Delete operation successful`);
      
      return res.status(200).json({
        message: 'Successfully deleted the listing',
        listingId,
        timestamp: new Date().toISOString(),
        method: 'direct_delete'
      });
      
    } catch (deleteError: any) {
      console.error(`[Test] Delete operation failed:`, {
        message: deleteError.message,
        code: deleteError.code,
        name: deleteError.name,
        stack: deleteError.stack?.split('\n').slice(0, 5).join('\n')
      });
      
      // Let's try to understand the specific error
      let errorAnalysis = {
        errorCode: deleteError.code,
        errorMessage: deleteError.message,
        errorName: deleteError.name,
        isPreconditionError: deleteError.code === 9 || deleteError.message.includes('FAILED_PRECONDITION'),
        isPermissionError: deleteError.code === 7 || deleteError.message.includes('PERMISSION_DENIED'),
        isNotFoundError: deleteError.code === 5 || deleteError.message.includes('NOT_FOUND'),
        possibleCauses: []
      };
      
      if (errorAnalysis.isPreconditionError) {
        errorAnalysis.possibleCauses.push('Document may have been modified since read');
        errorAnalysis.possibleCauses.push('Firestore security rules may be interfering');
        errorAnalysis.possibleCauses.push('Document may be in an inconsistent state');
      }
      
      if (errorAnalysis.isPermissionError) {
        errorAnalysis.possibleCauses.push('Firebase Admin SDK may not be properly authenticated');
        errorAnalysis.possibleCauses.push('Firestore security rules may be blocking the operation');
      }
      
      return res.status(500).json({
        error: 'Delete operation failed',
        listingId,
        errorAnalysis,
        rawError: {
          message: deleteError.message,
          code: deleteError.code,
          name: deleteError.name
        },
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error: any) {
    console.error('[Test] Unexpected error:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      name: error.name
    });
    
    return res.status(500).json({
      error: 'Test failed with unexpected error',
      details: error.message,
      code: error.code || 'UNKNOWN_ERROR',
      timestamp: new Date().toISOString()
    });
  }
}