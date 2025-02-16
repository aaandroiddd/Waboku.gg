import { NextApiRequest, NextApiResponse } from 'next';
import { validateSearchTerm, normalizeSearchTerm } from '@/lib/search-validation';
import { checkRateLimit } from '@/lib/rate-limit';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const ip = req.socket.remoteAddress || 'unknown';
    console.log(`Processing search request from IP: ${ip}`);

    // Apply rate limiting
    try {
      const isAllowed = await checkRateLimit(ip);
      if (!isAllowed) {
        console.log(`Rate limit exceeded for IP: ${ip}`);
        return res.status(429).json({ error: 'Rate limit exceeded' });
      }
    } catch (rateLimitError) {
      console.error('Rate limit check error:', rateLimitError);
      // Continue processing if rate limit check fails
    }

    const { searchTerm } = req.body;
    console.log(`Received search term: ${searchTerm}`);

    // Validate search term
    if (!searchTerm || typeof searchTerm !== 'string') {
      console.log('Invalid search term format');
      return res.status(400).json({ error: 'Invalid search term format' });
    }

    // Normalize search term
    const normalizedTerm = normalizeSearchTerm(searchTerm);
    console.log(`Normalized search term: ${normalizedTerm}`);

    // Apply search term validation (including profanity check)
    if (!validateSearchTerm(normalizedTerm)) {
      console.log(`Search term validation failed: ${normalizedTerm}`);
      return res.status(400).json({ error: 'Invalid or inappropriate search term' });
    }

    // Initialize Firebase Admin
    const { db } = getFirebaseAdmin();

    // Record the search term in Firebase
    try {
      const searchRef = db.collection('searchStats').doc('trending');
      await searchRef.set({
        [normalizedTerm]: db.FieldValue.increment(1),
        lastUpdated: db.FieldValue.serverTimestamp(),
      }, { merge: true });
      console.log(`Successfully recorded search term: ${normalizedTerm}`);
    } catch (dbError) {
      console.error('Database error:', dbError);
      throw dbError; // Re-throw to be caught by main error handler
    }

    return res.status(200).json({ 
      success: true,
      message: 'Search term recorded successfully'
    });
  } catch (error) {
    console.error('Error processing search request:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}