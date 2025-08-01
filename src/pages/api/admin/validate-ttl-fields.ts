import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { validateTTLFieldUpdate, TTL_FIELDS } from '@/lib/ttl-field-manager';

// Maximum number of documents to process in a single batch
const BATCH_SIZE = 500;

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

  const { collection = 'listings', dryRun = true } = req.body;

  try {
    console.log(`[TTL Validation] Starting TTL field validation for ${collection} collection`);
    
    const { db } = getFirebaseAdmin();
    let totalChecked = 0;
    let totalIssues = 0;
    let totalFixed = 0;
    const issues = [];
    const ttlFieldsToCheck = ['deleteAt', 'ttlSetAt', 'ttlReason', 'archivedAt', 'expirationReason', 'expiredAt'];

    // Get all documents from the specified collection
    const snapshot = await db.collection(collection).get();
    
    console.log(`[TTL Validation] Found ${snapshot.size} documents to check`);

    for (const doc of snapshot.docs) {
      totalChecked++;
      const data = doc.data();
      
      if (!data) {
        console.warn(`[TTL Validation] Empty data for document ${doc.id}`);
        continue;
      }

      const documentIssues = [];
      const fixUpdates: Record<string, any> = {};
      let needsFix = false;

      // Check each TTL field for null values
      for (const field of ttlFieldsToCheck) {
        if (data.hasOwnProperty(field) && data[field] === null) {
          documentIssues.push(`Field '${field}' is set to null instead of being deleted`);
          fixUpdates[field] = FieldValue.delete();
          needsFix = true;
        }
      }

      // Check for other common TTL field issues
      if (data.status === 'archived' && !data.deleteAt && !data.archivedAt) {
        documentIssues.push('Archived document missing both deleteAt TTL and archivedAt timestamp');
        if (!dryRun) {
          fixUpdates.archivedAt = Timestamp.now();
          const sevenDaysFromNow = new Date(Date.now() + (7 * 24 * 60 * 60 * 1000));
          fixUpdates.deleteAt = Timestamp.fromDate(sevenDaysFromNow);
          fixUpdates.ttlSetAt = Timestamp.now();
          fixUpdates.ttlReason = 'validation_fix';
          needsFix = true;
        }
      }

      if (data.status === 'expired' && collection === 'offers' && !data.deleteAt && !data.expiredAt) {
        documentIssues.push('Expired offer missing both deleteAt TTL and expiredAt timestamp');
        if (!dryRun) {
          fixUpdates.expiredAt = Timestamp.now();
          const twentyFourHoursFromNow = new Date(Date.now() + (24 * 60 * 60 * 1000));
          fixUpdates.deleteAt = Timestamp.fromDate(twentyFourHoursFromNow);
          fixUpdates.ttlSetAt = Timestamp.now();
          fixUpdates.ttlReason = 'validation_fix';
          needsFix = true;
        }
      }

      if (documentIssues.length > 0) {
        totalIssues++;
        
        const issueRecord = {
          documentId: doc.id,
          collection,
          issues: documentIssues,
          status: data.status,
          hasDeleteAt: !!data.deleteAt,
          hasArchivedAt: !!data.archivedAt,
          hasExpiredAt: !!data.expiredAt,
          fixed: false
        };

        // Apply fixes if not in dry run mode
        if (!dryRun && needsFix && Object.keys(fixUpdates).length > 0) {
          try {
            // Validate the update object before applying
            validateTTLFieldUpdate(fixUpdates);
            
            await doc.ref.update(fixUpdates);
            issueRecord.fixed = true;
            totalFixed++;
            
            console.log(`[TTL Validation] Fixed document ${doc.id}:`, {
              issues: documentIssues,
              updates: Object.keys(fixUpdates)
            });
          } catch (error) {
            console.error(`[TTL Validation] Error fixing document ${doc.id}:`, error);
            issueRecord.fixed = false;
            issueRecord.error = error.message;
          }
        }

        issues.push(issueRecord);
      }
    }

    const summary = {
      collection,
      totalChecked,
      totalIssues,
      totalFixed,
      dryRun,
      timestamp: new Date().toISOString()
    };

    console.log('[TTL Validation] Validation completed', summary);

    return res.status(200).json({
      success: true,
      message: dryRun 
        ? `Found ${totalIssues} TTL field issues in ${totalChecked} documents (dry run)`
        : `Fixed ${totalFixed} out of ${totalIssues} TTL field issues in ${totalChecked} documents`,
      summary,
      issues: issues.slice(0, 50), // Limit response size
      hasMoreIssues: issues.length > 50
    });

  } catch (error: any) {
    console.error('[TTL Validation] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to validate TTL fields',
      details: error.message
    });
  }
}