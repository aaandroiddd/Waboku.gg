import { NextApiRequest, NextApiResponse } from 'next';
import { validateSearchTerm } from '@/lib/search-validation';
import { rateLimit } from '@/lib/rate-limit';
import { db } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const limiter = rateLimit({
  interval: 60 * 1000, // 60 seconds
  uniqueTokenPerInterval: 500, // Max 500 users per interval
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Apply rate limiting
    await limiter.check(res, 10, req.socket.remoteAddress!);

    const { searchTerm } = req.body;

    // Validate search term
    if (!searchTerm || typeof searchTerm !== 'string') {
      return res.status(400).json({ error: 'Invalid search term' });
    }

    // Apply search term validation (including profanity check)
    if (!validateSearchTerm(searchTerm)) {
      return res.status(400).json({ error: 'Invalid or inappropriate search term' });
    }

    // Record the search term in Firebase
    const searchRef = db.collection('searchStats').doc('trending');
    await searchRef.set({
      [searchTerm.toLowerCase()]: FieldValue.increment(1),
      lastUpdated: FieldValue.serverTimestamp(),
    }, { merge: true });

    return res.status(200).json({ success: true });
  } catch (error) {
    if (error.statusCode === 429) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }
    console.error('Error recording search term:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}