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

  console.log('[Test Admin Privileges] Starting admin privileges test');

  try {
    const { admin, db } = getFirebaseAdmin();
    
    console.log('[Test Admin Privileges] Firebase Admin SDK initialized');
    console.log('[Test Admin Privileges] Admin app name:', admin.app().name);
    console.log('[Test Admin Privileges] Admin app options:', {
      projectId: admin.app().options.projectId,
      hasCredential: !!admin.app().options.credential
    });

    // Test 1: Try to read a listing without authentication context
    console.log('[Test Admin Privileges] Test 1: Reading listings without auth context');
    const listingsSnapshot = await db.collection('listings')
      .where('status', '==', 'archived')
      .limit(1)
      .get();
    
    console.log('[Test Admin Privileges] Test 1 Result:', {
      success: true,
      documentsFound: listingsSnapshot.size,
      message: 'Successfully read listings using Admin SDK'
    });

    // Test 2: Try to delete a test document (create it first)
    console.log('[Test Admin Privileges] Test 2: Creating and deleting test document');
    const testDocRef = db.collection('testAdminPrivileges').doc('test-doc');
    
    // Create test document
    await testDocRef.set({
      testField: 'test value',
      createdAt: new Date(),
      userId: 'test-user-id'
    });
    console.log('[Test Admin Privileges] Test document created');

    // Try to delete it
    await testDocRef.delete();
    console.log('[Test Admin Privileges] Test document deleted successfully');

    // Test 3: Try to access a specific archived listing
    if (listingsSnapshot.size > 0) {
      const testListing = listingsSnapshot.docs[0];
      console.log('[Test Admin Privileges] Test 3: Attempting to delete archived listing:', testListing.id);
      
      try {
        // This should work with Admin SDK privileges
        await testListing.ref.delete();
        console.log('[Test Admin Privileges] Test 3 Result: Successfully deleted archived listing');
        
        // Restore the listing for testing purposes
        await testListing.ref.set(testListing.data());
        console.log('[Test Admin Privileges] Test listing restored');
        
      } catch (deleteError: any) {
        console.error('[Test Admin Privileges] Test 3 Error:', {
          message: deleteError.message,
          code: deleteError.code,
          details: deleteError.details
        });
        
        return res.status(500).json({
          error: 'Admin privileges test failed',
          details: {
            test1: 'PASSED - Can read listings',
            test2: 'PASSED - Can create/delete test documents',
            test3: 'FAILED - Cannot delete archived listings',
            errorMessage: deleteError.message,
            errorCode: deleteError.code
          }
        });
      }
    }

    return res.status(200).json({
      message: 'All admin privileges tests passed',
      details: {
        test1: 'PASSED - Can read listings without auth',
        test2: 'PASSED - Can create/delete test documents',
        test3: 'PASSED - Can delete archived listings',
        adminSDKInfo: {
          appName: admin.app().name,
          projectId: admin.app().options.projectId,
          hasCredential: !!admin.app().options.credential
        }
      }
    });

  } catch (error: any) {
    console.error('[Test Admin Privileges] Fatal error:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      name: error.name
    });
    
    return res.status(500).json({
      error: 'Admin privileges test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}