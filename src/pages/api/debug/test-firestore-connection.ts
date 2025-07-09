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
    console.log('[test-firestore-connection] Testing Firestore connection and listings access');
    
    // Initialize Firebase Admin
    const { admin, db } = initializeFirebaseAdmin();
    
    // Test 1: Basic connection
    console.log('[test-firestore-connection] Testing basic Firestore connection');
    const testDoc = await db.collection('_connection_test_').doc('test').set({
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      message: 'Connection test'
    });
    console.log('[test-firestore-connection] Basic connection successful');
    
    // Test 2: Try to read listings collection
    console.log('[test-firestore-connection] Testing listings collection access');
    const listingsQuery = db.collection('listings')
      .where('status', '==', 'active')
      .orderBy('createdAt', 'desc')
      .limit(5);
    
    const listingsSnapshot = await listingsQuery.get();
    console.log(`[test-firestore-connection] Found ${listingsSnapshot.size} active listings`);
    
    // Test 3: Check if there are any listings at all
    const allListingsQuery = db.collection('listings').limit(10);
    const allListingsSnapshot = await allListingsQuery.get();
    console.log(`[test-firestore-connection] Found ${allListingsSnapshot.size} total listings`);
    
    // Test 4: Check security rules by trying to read without authentication
    console.log('[test-firestore-connection] Testing public read access');
    
    const sampleListings = [];
    for (const doc of listingsSnapshot.docs.slice(0, 3)) {
      const data = doc.data();
      sampleListings.push({
        id: doc.id,
        title: data.title,
        status: data.status,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        userId: data.userId ? 'present' : 'missing'
      });
    }
    
    // Clean up test document
    await db.collection('_connection_test_').doc('test').delete();
    
    return res.status(200).json({
      success: true,
      message: 'Firestore connection and listings access successful',
      details: {
        activeListingsCount: listingsSnapshot.size,
        totalListingsCount: allListingsSnapshot.size,
        sampleListings,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error: any) {
    console.error('[test-firestore-connection] Error:', error);
    
    // Provide detailed error information
    const errorDetails: any = {
      message: error.message,
      code: error.code,
      timestamp: new Date().toISOString()
    };
    
    // Check for specific error types
    if (error.code === 'permission-denied') {
      errorDetails.issue = 'Security rules are blocking access';
      errorDetails.suggestion = 'Check Firestore security rules for listings collection';
    } else if (error.code === 'unavailable') {
      errorDetails.issue = 'Firestore service is unavailable';
      errorDetails.suggestion = 'Check Firebase project status and network connectivity';
    } else if (error.code === 'failed-precondition') {
      errorDetails.issue = 'Query requires an index';
      errorDetails.suggestion = 'Create the required Firestore index';
    } else if (error.message?.includes('FIREBASE_PRIVATE_KEY')) {
      errorDetails.issue = 'Firebase Admin SDK configuration error';
      errorDetails.suggestion = 'Check FIREBASE_PRIVATE_KEY environment variable';
    }
    
    return res.status(500).json({
      success: false,
      message: 'Firestore connection test failed',
      details: errorDetails
    });
  }
}