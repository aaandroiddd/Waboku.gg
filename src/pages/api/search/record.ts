import { NextApiRequest, NextApiResponse } from 'next';
import { validateSearchTerm } from '@/lib/search-validation';
import { checkRateLimit } from '@/lib/rate-limit';
import { db } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Apply rate limiting
    const ip = req.socket.remoteAddress || 'unknown';
    const isAllowed = await checkRateLimit(ip);
    
    if (!isAllowed) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }

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
    console.error('Error recording search term:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}