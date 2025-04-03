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
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get listing ID and action from request body
  const { listingId, action } = req.body;

  if (!listingId) {
    return res.status(400).json({ error: 'Listing ID is required' });
  }

  if (action !== 'approve' && action !== 'reject') {
    return res.status(400).json({ error: 'Invalid action. Must be "approve" or "reject"' });
  }

  try {
    // Log the request for debugging
    console.log(`Moderation request: ${action} listing ${listingId}`);
    console.log('Request headers:', req.headers);
    console.log('Request body:', req.body);
    // Get reference to the listing document
    const listingRef = db.collection('listings').doc(listingId);
    
    // Check if listing exists
    const listingSnap = await listingRef.get();
    if (!listingSnap.exists) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    // Get listing data
    const listingData = listingSnap.data();
    
    // Check if listing needs review
    if (!listingData.needsReview) {
      return res.status(400).json({ error: 'Listing does not need review' });
    }

    // Get moderator information from request if available
    const moderatorId = req.headers.moderatorid || 'system';
    const moderatorNotes = req.body.notes || '';
    const rejectionReason = req.body.rejectionReason || '';
    
    // Update the listing based on the action
    if (action === 'approve') {
      // Remove the needsReview flag and add detailed moderation info
      await listingRef.update({
        needsReview: false,
        moderatedAt: new Date(),
        hasBeenReviewed: true,
        moderationDetails: {
          moderatorId,
          actionTaken: 'approved',
          moderationStatus: 'approved',
          timestamp: new Date(),
          notes: moderatorNotes,
          originalReviewReason: listingData.reviewReason || 'No reason provided'
        }
      });

      // Log the approval for auditing purposes
      console.log(`Listing ${listingId} approved by moderator ${moderatorId}`);

      return res.status(200).json({ 
        success: true,
        message: 'Listing approved successfully'
      });
    } else {
      // Reject the listing by changing its status to 'rejected' with detailed info
      await listingRef.update({
        status: 'rejected',
        needsReview: false,
        moderatedAt: new Date(),
        hasBeenReviewed: true,
        moderationDetails: {
          moderatorId,
          actionTaken: 'rejected',
          moderationStatus: 'rejected',
          timestamp: new Date(),
          notes: moderatorNotes,
          rejectionReason: rejectionReason || 'Violation of platform guidelines',
          originalReviewReason: listingData.reviewReason || 'No reason provided'
        }
      });

      // Log the rejection for auditing purposes
      console.log(`Listing ${listingId} rejected by moderator ${moderatorId}. Reason: ${rejectionReason || 'Not specified'}`);

      return res.status(200).json({ 
        success: true,
        message: 'Listing rejected successfully'
      });
    }
  } catch (error) {
    console.error(`Error ${action}ing listing:`, error);
    return res.status(500).json({ error: `Failed to ${action} listing` });
  }
};

// Apply the middleware and export
export default async function (req: NextApiRequest, res: NextApiResponse) {
  return moderatorAuthMiddleware(req, res, () => handler(req, res));
}