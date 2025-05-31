import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

/**
 * Expires all pending offers that are past their expiresAt timestamp.
 * 
 * This route should be protected by a secret (e.g. CRON_SECRET) to prevent abuse.
 * 
 * Can be triggered by a cron job or manually.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Optional: Protect with a secret
  const cronSecret = process.env.CRON_SECRET;
  const providedSecret = req.headers['x-cron-secret'] || req.query.secret;
  if (!cronSecret || providedSecret !== cronSecret) {
    return res.status(403).json({ error: 'Forbidden: Invalid or missing secret' });
  }

  try {
    getFirebaseAdmin();
    const db = getFirestore();

    const now = admin.firestore.Timestamp.now();

    // Query all pending offers that have expired
    const expiredOffersSnap = await db.collection('offers')
      .where('status', '==', 'pending')
      .where('expiresAt', '<', now)
      .get();

    if (expiredOffersSnap.empty) {
      return res.status(200).json({ message: 'No expired offers found.' });
    }

    const batch = db.batch();
    let count = 0;

    expiredOffersSnap.forEach(doc => {
      batch.update(doc.ref, {
        status: 'expired',
        updatedAt: FieldValue.serverTimestamp()
      });
      count++;
    });

    await batch.commit();

    return res.status(200).json({ message: `Expired ${count} offers.` });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to expire offers', details: error.message });
  }
}