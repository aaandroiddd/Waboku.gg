import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { getDatabase } from 'firebase-admin/database';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    console.log('Testing search term recording...');
    
    // Initialize Firebase Admin
    const admin = await getFirebaseAdmin();
    const database = getDatabase();
    
    if (!database) {
      throw new Error('Failed to get Firebase database instance');
    }
    
    // Test term
    const testTerm = 'test-search-' + Date.now();
    
    // Try to write directly to the database
    const searchRef = database.ref('searchTerms').child(testTerm.toLowerCase());
    
    const updateData = {
      term: testTerm,
      count: 1,
      lastUpdated: Date.now()
    };
    
    await searchRef.set(updateData);
    console.log(`Successfully wrote test search term: "${testTerm}"`);
    
    // Read it back to verify
    const snapshot = await searchRef.once('value');
    const data = snapshot.val();
    
    // Return success with the data
    return res.status(200).json({
      success: true,
      message: 'Test search term recorded successfully',
      testTerm,
      data,
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || 'Not configured'
    });
  } catch (error: any) {
    console.error('Error testing search term recording:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Error testing search term recording',
      error: error.message,
      stack: error.stack,
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || 'Not configured'
    });
  }
}