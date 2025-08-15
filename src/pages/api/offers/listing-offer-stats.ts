import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

type Data =
  | {
      success: true;
      listingId: string;
      offerCount: number;
      pending: number;
      countered: number;
    }
  | {
      success: false;
      error: string;
      code?: string;
    };

export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { listingId } = req.query;

    if (!listingId || typeof listingId !== 'string') {
      return res.status(400).json({ success: false, error: 'Missing or invalid listingId' });
    }

    // Initialize Firebase Admin (safe server-side)
    getFirebaseAdmin();
    const db = getFirestore();

    // Count pending and countered offers separately to avoid composite index/orderBy issues
    const [pendingSnap, counteredSnap] = await Promise.all([
      db.collection('offers').where('listingId', '==', listingId).where('status', '==', 'pending').get(),
      db.collection('offers').where('listingId', '==', listingId).where('status', '==', 'countered').get(),
    ]);

    const pending = pendingSnap.size;
    const countered = counteredSnap.size;
    const offerCount = pending + countered;

    // Cache for CDNs/edge (safe, does not expose user data)
    // - s-maxage: 60s shared cache
    // - stale-while-revalidate: 60s
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=60');

    return res.status(200).json({
      success: true,
      listingId,
      offerCount,
      pending,
      countered,
    });
  } catch (error: any) {
    console.error('Error fetching listing offer stats:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch listing offer stats',
      code: error?.code,
    });
  }
}