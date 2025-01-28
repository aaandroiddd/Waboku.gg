import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { ACCOUNT_TIERS } from '@/types/account';

// Helper function to log errors with context
const logError = (context: string, error: any, additionalInfo?: any) => {
  console.error(`[${new Date().toISOString()}] Error in ${context}:`, {
    message: error.message,
    stack: error.stack,
    ...additionalInfo
  });
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verify that this is a cron job request from Vercel
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.warn('[Archive Expired] Unauthorized access attempt');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Force console log to ensure visibility in Vercel logs
  console.log('[Archive Expired] Starting automated archival process', new Date().toISOString());
  
  try {
    console.log('[Archive Expired] Initializing Firebase Admin');
    const { db } = getFirebaseAdmin();
    const batch = db.batch();
    let totalArchived = 0;
    let totalDeleted = 0;
    
    // Step 1: Archive expired active listings
    const activeListingsSnapshot = await db.collection('listings')
      .where('status', '==', 'active')
      .get();

    console.log(`[Archive Expired] Processing ${activeListingsSnapshot.size} active listings`);
    
    const processPromises = activeListingsSnapshot.docs.map(async (doc) => {
      try {
        const data = doc.data();
        if (!data) return;

        const createdAt = data.createdAt?.toDate() || new Date();
        const userRef = db.collection('users').doc(data.userId);
        const userDoc = await userRef.get();
        
        const userData = userDoc.data();
        if (!userData) {
          console.log(`[Archive Expired] No user data found for listing ${doc.id}`);
          return;
        }
        
        const accountTier = userData.accountTier || 'free';
        const tierDuration = ACCOUNT_TIERS[accountTier]?.listingDuration || ACCOUNT_TIERS.free.listingDuration;
        
        const expirationTime = new Date(createdAt.getTime() + (tierDuration * 60 * 60 * 1000));
        
        if (new Date() > expirationTime) {
          batch.update(doc.ref, {
            status: 'archived',
            archivedAt: Timestamp.now(),
            originalCreatedAt: data.createdAt
          });
          totalArchived++;
          console.log(`[Archive Expired] Marked listing ${doc.id} for archival`);
        }
      } catch (error) {
        logError('Processing active listing', error, {
          listingId: doc.id,
          data: doc.data()
        });
      }
    });

    await Promise.all(processPromises);

    // Step 2: Archive inactive listings older than 7 days
    const inactiveSnapshot = await db.collection('listings')
      .where('status', '==', 'inactive')
      .where('updatedAt', '<', Timestamp.fromDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)))
      .get();

    console.log(`[Archive Expired] Processing ${inactiveSnapshot.size} inactive listings`);

    inactiveSnapshot.docs.forEach((doc) => {
      try {
        const data = doc.data();
        if (!data) return;

        batch.update(doc.ref, {
          status: 'archived',
          archivedAt: Timestamp.now(),
          originalCreatedAt: data.createdAt
        });
        totalArchived++;
        console.log(`[Archive Expired] Marked inactive listing ${doc.id} for archival`);
      } catch (error) {
        logError('Processing inactive listing', error, {
          listingId: doc.id,
          data: doc.data()
        });
      }
    });

    // Step 3: Delete archived listings older than 7 days
    const archivedSnapshot = await db.collection('listings')
      .where('status', '==', 'archived')
      .where('archivedAt', '<', Timestamp.fromDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)))
      .get();

    console.log(`[Archive Expired] Processing ${archivedSnapshot.size} archived listings for deletion`);

    archivedSnapshot.docs.forEach((doc) => {
      try {
        batch.delete(doc.ref);
        totalDeleted++;
        console.log(`[Archive Expired] Marked listing ${doc.id} for deletion`);
      } catch (error) {
        logError('Processing archived listing', error, {
          listingId: doc.id,
          data: doc.data()
        });
      }
    });
    
    // Commit all changes
    if (totalArchived > 0 || totalDeleted > 0) {
      await batch.commit();
      console.log(`[Archive Expired] Successfully committed changes: ${totalArchived} archived, ${totalDeleted} deleted`);
    } else {
      console.log('[Archive Expired] No changes to commit');
    }

    return res.status(200).json({ 
      message: `Successfully processed listings: ${totalArchived} archived, ${totalDeleted} deleted` 
    });
  } catch (error: any) {
    logError('Archive expired listings', error);
    return res.status(500).json({ 
      error: 'Failed to process listings',
      details: error.message 
    });
  }
}