import type { NextApiRequest, NextApiResponse } from 'next';
import { initializeFirebaseAdmin } from '@/lib/firebase-admin';

type ResponseData = {
  success: boolean;
  message: string;
  results?: any;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { sellerId } = req.query;

    if (!sellerId) {
      return res.status(400).json({ success: false, message: 'Seller ID is required' });
    }

    console.log('[test-review-path] Testing review paths for seller:', sellerId);
    
    // Initialize Firebase Admin SDK
    const { db } = initializeFirebaseAdmin();
    
    // Check different possible paths for reviews
    const results: any = {
      collections: {}
    };
    
    // Check top-level reviews collection
    try {
      const topLevelQuery = db.collection('reviews').where('sellerId', '==', sellerId);
      const topLevelSnapshot = await topLevelQuery.get();
      
      results.collections.topLevel = {
        path: 'reviews',
        count: topLevelSnapshot.size,
        samples: []
      };
      
      if (topLevelSnapshot.size > 0) {
        // Get sample documents
        topLevelSnapshot.docs.slice(0, 3).forEach(doc => {
          const data = doc.data();
          results.collections.topLevel.samples.push({
            id: doc.id,
            sellerId: data.sellerId,
            reviewerId: data.reviewerId,
            rating: data.rating,
            isPublic: data.isPublic,
            status: data.status,
            createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : null
          });
        });
      }
    } catch (error) {
      console.error('[test-review-path] Error checking top-level collection:', error);
      results.collections.topLevel = { error: 'Failed to query collection' };
    }
    
    // Check user subcollection
    try {
      const userSubcollectionPath = `users/${sellerId}/reviews`;
      const userSubcollectionQuery = db.collection(userSubcollectionPath);
      const userSubcollectionSnapshot = await userSubcollectionQuery.get();
      
      results.collections.userSubcollection = {
        path: userSubcollectionPath,
        count: userSubcollectionSnapshot.size,
        samples: []
      };
      
      if (userSubcollectionSnapshot.size > 0) {
        // Get sample documents
        userSubcollectionSnapshot.docs.slice(0, 3).forEach(doc => {
          const data = doc.data();
          results.collections.userSubcollection.samples.push({
            id: doc.id,
            sellerId: data.sellerId,
            reviewerId: data.reviewerId,
            rating: data.rating,
            isPublic: data.isPublic,
            status: data.status,
            createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : null
          });
        });
      }
    } catch (error) {
      console.error('[test-review-path] Error checking user subcollection:', error);
      results.collections.userSubcollection = { error: 'Failed to query collection' };
    }
    
    // Check if there are any orders with reviews for this seller
    try {
      const ordersQuery = db.collection('orders')
        .where('sellerId', '==', sellerId)
        .where('reviewSubmitted', '==', true);
      const ordersSnapshot = await ordersQuery.get();
      
      results.orders = {
        count: ordersSnapshot.size,
        samples: []
      };
      
      if (ordersSnapshot.size > 0) {
        // Get sample documents
        ordersSnapshot.docs.slice(0, 3).forEach(doc => {
          const data = doc.data();
          results.orders.samples.push({
            id: doc.id,
            buyerId: data.buyerId,
            sellerId: data.sellerId,
            reviewSubmitted: data.reviewSubmitted,
            reviewId: data.reviewId,
            status: data.status,
            createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : null
          });
          
          // If there's a reviewId, check if it exists in the reviews collection
          if (data.reviewId) {
            results.orders.samples[results.orders.samples.length - 1].reviewExists = 
              results.collections.topLevel.samples.some(r => r.id === data.reviewId);
          }
        });
      }
    } catch (error) {
      console.error('[test-review-path] Error checking orders:', error);
      results.orders = { error: 'Failed to query orders' };
    }
    
    console.log('[test-review-path] Test completed for seller:', sellerId);
    
    return res.status(200).json({ 
      success: true, 
      message: 'Review paths tested successfully',
      results
    });
  } catch (error) {
    console.error('[test-review-path] Unhandled error:', error);
    
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error'
    });
  }
}