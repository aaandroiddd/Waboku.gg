import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

type ResponseData = {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  try {
    console.log('[test-listings-fetch] Starting listings fetch test');
    
    // Get Firebase Admin services
    const { db, admin } = getFirebaseAdmin();
    
    if (!db) {
      return res.status(500).json({
        success: false,
        message: 'Firebase Admin database not initialized',
        error: 'Database connection failed'
      });
    }
    
    console.log('[test-listings-fetch] Database connection established');
    
    // Test 1: Check if listings collection exists and get total count
    const listingsRef = db.collection('listings');
    const allListingsSnapshot = await listingsRef.get();
    
    console.log('[test-listings-fetch] Total listings in database:', allListingsSnapshot.size);
    
    // Test 2: Get active listings only
    const activeListingsQuery = listingsRef.where('status', '==', 'active');
    const activeListingsSnapshot = await activeListingsQuery.get();
    
    console.log('[test-listings-fetch] Active listings count:', activeListingsSnapshot.size);
    
    // Test 3: Get first 5 active listings with details
    const limitedActiveQuery = listingsRef
      .where('status', '==', 'active')
      .orderBy('createdAt', 'desc')
      .limit(5);
    
    const limitedActiveSnapshot = await limitedActiveQuery.get();
    
    const sampleListings = limitedActiveSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title,
        price: data.price,
        status: data.status,
        createdAt: data.createdAt?.toDate?.() || data.createdAt,
        expiresAt: data.expiresAt?.toDate?.() || data.expiresAt,
        userId: data.userId,
        game: data.game,
        city: data.city,
        state: data.state,
        imageUrls: Array.isArray(data.imageUrls) ? data.imageUrls.length : 'not array'
      };
    });
    
    console.log('[test-listings-fetch] Sample listings:', sampleListings);
    
    // Test 4: Check for any listings that might be expired
    const now = new Date();
    const expiredQuery = listingsRef
      .where('status', '==', 'active')
      .where('expiresAt', '<', now);
    
    const expiredSnapshot = await expiredQuery.get();
    console.log('[test-listings-fetch] Expired active listings:', expiredSnapshot.size);
    
    return res.status(200).json({
      success: true,
      message: 'Listings fetch test completed successfully',
      data: {
        totalListings: allListingsSnapshot.size,
        activeListings: activeListingsSnapshot.size,
        expiredActiveListings: expiredSnapshot.size,
        sampleListings,
        currentTime: now.toISOString()
      }
    });
    
  } catch (error: any) {
    console.error('[test-listings-fetch] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch listings',
      error: error.message,
      data: {
        errorCode: error.code,
        errorStack: error.stack?.split('\n').slice(0, 5).join('\n')
      }
    });
  }
}