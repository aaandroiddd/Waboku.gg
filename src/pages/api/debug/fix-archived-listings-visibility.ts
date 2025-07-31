import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check admin authorization
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  if (token !== process.env.NEXT_PUBLIC_ADMIN_SECRET) {
    return res.status(401).json({ error: 'Invalid admin token' });
  }

  try {
    console.log('[Fix Archived Listings] Starting fix for archived listings visibility');
    
    const { db } = getFirebaseAdmin();
    let fixedCount = 0;
    let totalChecked = 0;
    const issues = [];

    // Get all listings that are archived but might be showing on public pages
    const archivedListingsSnapshot = await db.collection('listings')
      .where('status', '==', 'archived')
      .get();

    console.log(`[Fix Archived Listings] Found ${archivedListingsSnapshot.size} archived listings to check`);

    for (const doc of archivedListingsSnapshot.docs) {
      totalChecked++;
      const data = doc.data();
      
      if (!data) {
        console.warn(`[Fix Archived Listings] Empty data for listing ${doc.id}`);
        continue;
      }

      let needsUpdate = false;
      const updateData: any = {};
      const listingIssues = [];

      // Check if the listing has proper TTL for deletion
      if (!data.deleteAt) {
        needsUpdate = true;
        const now = new Date();
        const sevenDaysFromNow = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));
        updateData.deleteAt = Timestamp.fromDate(sevenDaysFromNow);
        updateData.ttlSetAt = Timestamp.now();
        updateData.ttlReason = 'fix_missing_ttl';
        listingIssues.push('Missing TTL field');
      }

      // Ensure updatedAt is recent for archived listings
      if (!data.updatedAt || !data.archivedAt) {
        needsUpdate = true;
        updateData.updatedAt = Timestamp.now();
        if (!data.archivedAt) {
          updateData.archivedAt = Timestamp.now();
          listingIssues.push('Missing archivedAt timestamp');
        }
        listingIssues.push('Missing updatedAt timestamp');
      }

      // Ensure status is definitely 'archived'
      if (data.status !== 'archived') {
        needsUpdate = true;
        updateData.status = 'archived';
        listingIssues.push(`Status was '${data.status}' instead of 'archived'`);
      }

      if (needsUpdate) {
        try {
          await doc.ref.update(updateData);
          fixedCount++;
          
          console.log(`[Fix Archived Listings] Fixed listing ${doc.id}:`, {
            title: data.title?.substring(0, 50) + '...',
            userId: data.userId,
            issues: listingIssues,
            updates: Object.keys(updateData)
          });

          issues.push({
            listingId: doc.id,
            title: data.title?.substring(0, 50) + '...',
            userId: data.userId,
            issues: listingIssues,
            fixed: true
          });
        } catch (error) {
          console.error(`[Fix Archived Listings] Error fixing listing ${doc.id}:`, error);
          issues.push({
            listingId: doc.id,
            title: data.title?.substring(0, 50) + '...',
            userId: data.userId,
            issues: listingIssues,
            fixed: false,
            error: error.message
          });
        }
      }
    }

    // Also check for any active listings that should be archived
    const activeListingsSnapshot = await db.collection('listings')
      .where('status', '==', 'active')
      .get();

    console.log(`[Fix Archived Listings] Checking ${activeListingsSnapshot.size} active listings for expiration issues`);

    for (const doc of activeListingsSnapshot.docs) {
      totalChecked++;
      const data = doc.data();
      
      if (!data) continue;

      // Check if this listing should have been archived based on creation date
      let createdAt: Date;
      try {
        if (data.createdAt?.toDate) {
          createdAt = data.createdAt.toDate();
        } else if (data.createdAt) {
          createdAt = new Date(data.createdAt);
        } else {
          continue; // Skip if no creation date
        }
      } catch (error) {
        continue; // Skip if can't parse date
      }

      const now = new Date();
      const hoursActive = Math.round((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60));
      
      // Check if it's been active for more than 48 hours (free tier limit)
      // We'll be conservative and only flag listings active for more than 72 hours
      if (hoursActive > 72) {
        issues.push({
          listingId: doc.id,
          title: data.title?.substring(0, 50) + '...',
          userId: data.userId,
          issues: [`Active for ${hoursActive} hours (likely should be archived)`],
          fixed: false,
          status: 'active',
          hoursActive
        });
      }
    }

    const summary = {
      totalChecked,
      fixedCount,
      issuesFound: issues.length,
      timestamp: new Date().toISOString()
    };

    console.log('[Fix Archived Listings] Process completed', summary);

    return res.status(200).json({
      success: true,
      message: `Fixed ${fixedCount} archived listings out of ${totalChecked} checked`,
      summary,
      issues: issues.slice(0, 20) // Limit response size
    });

  } catch (error: any) {
    console.error('[Fix Archived Listings] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fix archived listings',
      details: error.message
    });
  }
}