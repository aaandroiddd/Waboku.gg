import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { moderatorAuthMiddleware } from '@/middleware/moderatorAuth';

// Initialize Firestore using Firebase Admin
const { db } = getFirebaseAdmin();

// Create a handler with middleware
const handler = async (
  req: NextApiRequest,
  res: NextApiResponse
) => {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get the filter type from query parameters (pending, approved, rejected)
    const filterType = req.query.filter || 'pending';
    console.log(`Fetching listings with filter: ${filterType}`);
    console.log('Request headers:', req.headers);
    console.log('Request query parameters:', req.query);
    
    const listingsRef = db.collection('listings');
    let q;

    // Build query based on filter type
    if (filterType === 'pending') {
      // Query for listings that need review
      q = listingsRef
        .where('needsReview', '==', true)
        .where('status', '==', 'active');
    } else if (filterType === 'approved') {
      // Query for approved listings - using moderationDetails.actionTaken field
      q = listingsRef
        .where('moderationDetails.actionTaken', '==', 'approved')
        .where('hasBeenReviewed', '==', true)
        .limit(50); // Limit to recent 50 approved listings
    } else if (filterType === 'rejected') {
      // Query for rejected listings - using moderationDetails.actionTaken field
      q = listingsRef
        .where('moderationDetails.actionTaken', '==', 'rejected')
        .where('hasBeenReviewed', '==', true)
        .limit(50); // Limit to recent 50 rejected listings
    } else {
      return res.status(400).json({ error: 'Invalid filter type' });
    }

    const querySnapshot = await q.get();
    
    // Convert query snapshot to array of listings
    const listings = querySnapshot.docs.map(doc => {
      const data = doc.data();
      
      // Convert Firestore timestamps to ISO strings for serialization
      const createdAt = data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : null;
      const expiresAt = data.expiresAt?.toDate ? data.expiresAt.toDate().toISOString() : null;
      const moderatedAt = data.moderatedAt?.toDate ? data.moderatedAt.toDate().toISOString() : null;
      
      // Process review reason with more detailed information
      let reviewReason = data.reviewReason || '';
      let reviewCategory = data.reviewCategory || '';
      
      // If no specific reason is provided, categorize it based on available data
      if (!reviewReason) {
        if (data.autoFlagged) {
          reviewReason = 'Automatically flagged by content filtering system';
          reviewCategory = reviewCategory || 'auto-flagged';
        } else if (data.imageAnalysisFlag) {
          reviewReason = 'Image analysis detected potentially inappropriate content';
          reviewCategory = reviewCategory || 'image-content';
        } else if (data.pricingAnomaly) {
          reviewReason = 'Pricing anomaly detected (significantly above or below market value)';
          reviewCategory = reviewCategory || 'pricing';
        } else if (data.keywordFlag) {
          reviewReason = 'Keyword-based content filtering flagged this listing';
          reviewCategory = reviewCategory || 'keyword';
        } else if (data.userTrustLevel === 'low') {
          reviewReason = 'New seller or low trust level account';
          reviewCategory = reviewCategory || 'user-trust';
        } else {
          reviewReason = 'No specific reason provided';
          reviewCategory = reviewCategory || 'manual-review';
        }
      }
      
      return {
        id: doc.id,
        ...data,
        createdAt,
        expiresAt,
        moderatedAt,
        reviewReason,
        reviewCategory
      };
    });

    // Log the results
    console.log(`Found ${listings.length} listings for filter: ${filterType}`);
    if (listings.length > 0) {
      console.log('Sample listing data:', {
        id: listings[0].id,
        title: listings[0].title,
        needsReview: listings[0].needsReview,
        moderationStatus: listings[0].moderationStatus,
        hasBeenReviewed: listings[0].hasBeenReviewed,
        status: listings[0].status,
        moderatedAt: listings[0].moderatedAt
      });
      
      // Log moderation details if available
      if (listings[0].moderationDetails) {
        console.log('Moderation details:', listings[0].moderationDetails);
      }
    } else {
      console.log(`No listings found for filter: ${filterType}`);
      
      // Log the query parameters for debugging
      if (filterType === 'approved') {
        console.log('Query parameters for approved listings:', {
          'moderationDetails.actionTaken': 'approved',
          'hasBeenReviewed': true
        });
      } else if (filterType === 'rejected') {
        console.log('Query parameters for rejected listings:', {
          'moderationDetails.actionTaken': 'rejected',
          'hasBeenReviewed': true
        });
      } else if (filterType === 'pending') {
        console.log('Query parameters for pending listings:', {
          needsReview: true,
          status: 'active'
        });
      }
    }
    
    // Return the listings
    return res.status(200).json({ 
      success: true,
      listings,
      count: listings.length,
      filterType
    });
  } catch (error) {
    console.error('Error fetching listings for moderation:', error);
    
    // Add more detailed error logging
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        filterType: req.query.filter
      });
    }
    
    return res.status(500).json({ 
      error: 'Failed to fetch listings for moderation',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Apply the middleware and export
export default async function (req: NextApiRequest, res: NextApiResponse) {
  return moderatorAuthMiddleware(req, res, () => handler(req, res));
}