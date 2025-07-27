import type { NextApiRequest, NextApiResponse } from 'next';
import { initializeFirebaseAdmin } from '@/lib/firebase-admin';

type ResponseData = {
  success: boolean;
  message: string;
  processed?: number;
  updated?: number;
  errors?: number;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    console.log('[migrate-review-usernames] Starting migration...');
    
    // Initialize Firebase Admin SDK
    const { db: adminDb } = initializeFirebaseAdmin();
    
    // Get all reviews that don't have reviewerUsername stored
    console.log('[migrate-review-usernames] Fetching reviews without stored usernames...');
    const reviewsSnapshot = await adminDb.collection('reviews').get();
    
    let processed = 0;
    let updated = 0;
    let errors = 0;
    
    console.log(`[migrate-review-usernames] Found ${reviewsSnapshot.docs.length} reviews to check`);
    
    // Process reviews in batches to avoid overwhelming the system
    const batchSize = 50;
    const reviews = reviewsSnapshot.docs;
    
    for (let i = 0; i < reviews.length; i += batchSize) {
      const batch = reviews.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (reviewDoc) => {
        try {
          processed++;
          const reviewData = reviewDoc.data();
          const reviewId = reviewDoc.id;
          
          // Skip if already has reviewerUsername
          if (reviewData.reviewerUsername) {
            console.log(`[migrate-review-usernames] Review ${reviewId} already has username: ${reviewData.reviewerUsername}`);
            return;
          }
          
          // Get the reviewer's user data
          const reviewerId = reviewData.reviewerId;
          if (!reviewerId) {
            console.log(`[migrate-review-usernames] Review ${reviewId} has no reviewerId, skipping`);
            return;
          }
          
          console.log(`[migrate-review-usernames] Fetching user data for reviewer: ${reviewerId}`);
          const userDoc = await adminDb.collection('users').doc(reviewerId).get();
          
          let updateData: any = {};
          
          if (userDoc.exists) {
            const userData = userDoc.data();
            const username = userData.username || userData.displayName || 'Anonymous User';
            const avatarUrl = userData.avatarUrl || userData.photoURL || null;
            
            updateData.reviewerUsername = username;
            if (avatarUrl) {
              updateData.reviewerAvatarUrl = avatarUrl;
            }
            
            console.log(`[migrate-review-usernames] Found user data for ${reviewerId}: ${username}`);
          } else {
            // User doesn't exist (deleted account), store a placeholder
            updateData.reviewerUsername = 'Deleted User';
            console.log(`[migrate-review-usernames] User ${reviewerId} not found, marking as deleted`);
          }
          
          // Update the review document
          await adminDb.collection('reviews').doc(reviewId).update({
            ...updateData,
            updatedAt: new Date()
          });
          
          // Also update in seller's subcollection if it exists
          try {
            if (reviewData.sellerId) {
              const sellerReviewRef = adminDb.collection('users').doc(reviewData.sellerId).collection('reviews').doc(reviewId);
              const sellerReviewDoc = await sellerReviewRef.get();
              
              if (sellerReviewDoc.exists) {
                await sellerReviewRef.update({
                  ...updateData,
                  updatedAt: new Date()
                });
                console.log(`[migrate-review-usernames] Updated seller subcollection for review ${reviewId}`);
              }
            }
          } catch (subcollectionError) {
            console.error(`[migrate-review-usernames] Error updating seller subcollection for review ${reviewId}:`, subcollectionError);
            // Don't fail the main update for this
          }
          
          updated++;
          console.log(`[migrate-review-usernames] Updated review ${reviewId} with username: ${updateData.reviewerUsername}`);
          
        } catch (error) {
          errors++;
          console.error(`[migrate-review-usernames] Error processing review ${reviewDoc.id}:`, error);
        }
      }));
      
      // Add a small delay between batches to avoid rate limiting
      if (i + batchSize < reviews.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`[migrate-review-usernames] Migration completed. Processed: ${processed}, Updated: ${updated}, Errors: ${errors}`);
    
    return res.status(200).json({
      success: true,
      message: `Migration completed successfully. Processed ${processed} reviews, updated ${updated}, encountered ${errors} errors.`,
      processed,
      updated,
      errors
    });
    
  } catch (error) {
    console.error('[migrate-review-usernames] Error during migration:', error);
    return res.status(500).json({
      success: false,
      message: 'Migration failed: ' + error.message
    });
  }
}