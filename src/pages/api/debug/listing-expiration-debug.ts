import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { ACCOUNT_TIERS } from '@/types/account';
import { parseDate } from '@/lib/date-utils';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { listingId } = req.body;

    if (!listingId || typeof listingId !== 'string') {
      return res.status(400).json({ 
        error: 'Invalid listing ID provided',
        listingId: listingId || 'undefined',
        exists: false
      });
    }

    const { db } = getFirebaseAdmin();
    
    // Get the listing document
    const listingRef = db.collection('listings').doc(listingId);
    const listingDoc = await listingRef.get();

    if (!listingDoc.exists) {
      return res.status(200).json({
        listingId,
        exists: false,
        error: 'Listing not found'
      });
    }

    const data = listingDoc.data();
    if (!data) {
      return res.status(200).json({
        listingId,
        exists: false,
        error: 'Listing data is empty'
      });
    }

    // Convert Firestore timestamps to readable dates
    const processedData = {
      ...data,
      createdAt: data.createdAt ? parseDate(data.createdAt).toISOString() : null,
      expiresAt: data.expiresAt ? parseDate(data.expiresAt).toISOString() : null,
      archivedAt: data.archivedAt ? parseDate(data.archivedAt).toISOString() : null,
      updatedAt: data.updatedAt ? parseDate(data.updatedAt).toISOString() : null,
    };

    // Calculate what the expiration should have been
    let calculatedExpiration = null;

    if (data.createdAt && data.userId) {
      try {
        // Get user data to determine account tier
        const userRef = db.collection('users').doc(data.userId);
        const userDoc = await userRef.get();
        
        let accountTier = 'free'; // Default
        if (userDoc.exists) {
          const userData = userDoc.data();
          accountTier = userData?.accountTier || 'free';
        }

        // Get the tier duration
        const tierDuration = ACCOUNT_TIERS[accountTier as 'free' | 'premium']?.listingDuration || ACCOUNT_TIERS.free.listingDuration;
        
        // Calculate when it should have expired
        const createdAt = parseDate(data.createdAt);
        const shouldHaveExpiredAt = new Date(createdAt.getTime() + (tierDuration * 60 * 60 * 1000));
        
        calculatedExpiration = {
          fromCreatedAt: createdAt.toISOString(),
          fromExpiresAt: data.expiresAt ? parseDate(data.expiresAt).toISOString() : 'Not set',
          accountTier,
          tierDuration,
          shouldHaveExpiredAt: shouldHaveExpiredAt.toISOString(),
        };

        // If the listing was archived, compare the times
        if (data.archivedAt) {
          const actualArchivedAt = parseDate(data.archivedAt);
          calculatedExpiration.actualArchivedAt = actualArchivedAt.toISOString();
          
          // Calculate the difference
          const timeDifferenceMs = actualArchivedAt.getTime() - shouldHaveExpiredAt.getTime();
          const timeDifferenceHours = Math.abs(timeDifferenceMs) / (1000 * 60 * 60);
          const timeDifferenceDays = timeDifferenceHours / 24;
          
          if (timeDifferenceMs < 0) {
            // Archived early
            calculatedExpiration.timeDifference = `${timeDifferenceHours.toFixed(2)} hours early (${timeDifferenceDays.toFixed(2)} days early)`;
            calculatedExpiration.wasArchivedEarly = true;
            calculatedExpiration.wasArchivedLate = false;
          } else if (timeDifferenceMs > 0) {
            // Archived late
            calculatedExpiration.timeDifference = `${timeDifferenceHours.toFixed(2)} hours late (${timeDifferenceDays.toFixed(2)} days late)`;
            calculatedExpiration.wasArchivedEarly = false;
            calculatedExpiration.wasArchivedLate = true;
          } else {
            // Archived at the right time (within reasonable margin)
            calculatedExpiration.timeDifference = 'Archived at the correct time';
            calculatedExpiration.wasArchivedEarly = false;
            calculatedExpiration.wasArchivedLate = false;
          }

          // Consider a 1-hour margin as "correct timing"
          if (Math.abs(timeDifferenceMs) <= (60 * 60 * 1000)) {
            calculatedExpiration.wasArchivedEarly = false;
            calculatedExpiration.wasArchivedLate = false;
            calculatedExpiration.timeDifference = `${timeDifferenceHours.toFixed(2)} hours difference (within acceptable margin)`;
          }
        }
      } catch (error) {
        console.error('Error calculating expiration:', error);
        calculatedExpiration = {
          fromCreatedAt: data.createdAt ? parseDate(data.createdAt).toISOString() : 'Error parsing',
          fromExpiresAt: data.expiresAt ? parseDate(data.expiresAt).toISOString() : 'Not set',
          accountTier: 'Error determining tier',
          tierDuration: 0,
          shouldHaveExpiredAt: 'Error calculating',
          error: 'Failed to calculate expiration: ' + (error as Error).message
        };
      }
    }

    return res.status(200).json({
      listingId,
      exists: true,
      data: processedData,
      calculatedExpiration
    });

  } catch (error) {
    console.error('Error in listing expiration debug:', error);
    return res.status(500).json({
      error: 'Internal server error: ' + (error as Error).message,
      listingId: req.body?.listingId || 'unknown',
      exists: false
    });
  }
}