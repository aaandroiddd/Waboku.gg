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
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  // Check admin authorization
  const adminSecret = req.headers.authorization?.replace('Bearer ', '');
  if (adminSecret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  try {
    console.log('[migrate-review-usernames] Starting migration...');
    
    const { db: adminDb } = initializeFirebaseAdmin();
    
    // Get all reviews that don't have reviewerUsername
    const reviewsSnapshot = await adminDb.collection('reviews')
      .where('reviewerUsername', '==', null)
      .get();
    
    console.log(`[migrate-review-usernames] Found ${reviewsSnapshot.size} reviews to process`);
    
    let processed = 0;
    let updated = 0;
    let errors = 0;
    
    // Process reviews in batches to avoid overwhelming the system
    const batchSize = 50;
    const reviews = reviewsSnapshot.docs;
    
    for (let i = 0; i < reviews.length; i += batchSize) {
      const batch = reviews.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (reviewDoc) => {
        try {
          processed++;
          const reviewData = reviewDoc.data();
          const reviewerId = reviewData.reviewerId;
          
          if (!reviewerId) {
            console.log(`[migrate-review-usernames] Skipping review ${reviewDoc.id} - no reviewerId`);
            return;
          }
          
          // Get the user's profile data
          const userDoc = await adminDb.collection('users').doc(reviewerId).get();
          
          if (userDoc.exists) {
            const userData = userDoc.data();
            const reviewerUsername = userData.username || userData.displayName || null;
            const reviewerAvatarUrl = userData.avatarUrl || userData.photoURL || null;
            
            if (reviewerUsername) {
              // Update the review with username and avatar
              const updateData: any = {
                reviewerUsername,
                updatedAt: new Date()
              };
              
              if (reviewerAvatarUrl) {
                updateData.reviewerAvatarUrl = reviewerAvatarUrl;
              }
              
              await adminDb.collection('reviews').doc(reviewDoc.id).update(updateData);
              
              // Also update in seller's subcollection if it exists
              try {
                const sellerReviewDoc = await adminDb
                  .collection('users')
                  .doc(reviewData.sellerId)
                  .collection('reviews')
                  .doc(reviewDoc.id)
                  .get();
                
                if (sellerReviewDoc.exists) {
                  await adminDb
                    .collection('users')
                    .doc(reviewData.sellerId)
                    .collection('reviews')
                    .doc(reviewDoc.id)
                    .update(updateData);
                }
              } catch (subcollectionError) {
                console.warn(`[migrate-review-usernames] Error updating seller subcollection for review ${reviewDoc.id}:`, subcollectionError);
              }
              
              updated++;
              console.log(`[migrate-review-usernames] Updated review ${reviewDoc.id} with username: ${reviewerUsername}`);
            } else {
              console.log(`[migrate-review-usernames] No username found for user ${reviewerId} in review ${reviewDoc.id}`);
            }
          } else {
            console.log(`[migrate-review-usernames] User ${reviewerId} not found for review ${reviewDoc.id} (likely deleted)`);
          }
        } catch (error) {
          errors++;
          console.error(`[migrate-review-usernames] Error processing review ${reviewDoc.id}:`, error);
        }
      }));
      
      // Log progress
      console.log(`[migrate-review-usernames] Processed ${Math.min(i + batchSize, reviews.length)}/${reviews.length} reviews`);
    }
    
    console.log(`[migrate-review-usernames] Migration completed. Processed: ${processed}, Updated: ${updated}, Errors: ${errors}`);
    
    return res.status(200).json({
      success: true,
      message: 'Review username migration completed',
      processed,
      updated,
      errors
    });
    
  } catch (error) {
    console.error('[migrate-review-usernames] Migration error:', error);
    return res.status(500).json({
      success: false,
      message: 'Migration failed',
      processed: 0,
      updated: 0,
      errors: 1
    });
  }
}