import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { moderatorAuthMiddleware } from '@/middleware/moderatorAuth';

// Initialize Firestore
const db = getFirestore(firebaseApp);

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
    // Get reference to the listing document
    const listingRef = doc(db, 'listings', listingId);
    
    // Check if listing exists
    const listingSnap = await getDoc(listingRef);
    if (!listingSnap.exists()) {
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
      await updateDoc(listingRef, {
        needsReview: false,
        moderationStatus: 'approved',
        moderatedAt: new Date(),
        moderationDetails: {
          moderatorId,
          actionTaken: 'approved',
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
      await updateDoc(listingRef, {
        status: 'rejected',
        needsReview: false,
        moderationStatus: 'rejected',
        moderatedAt: new Date(),
        moderationDetails: {
          moderatorId,
          actionTaken: 'rejected',
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