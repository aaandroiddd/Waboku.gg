import { NextApiRequest, NextApiResponse } from 'next';
import { validateSearchTerm, normalizeSearchTerm } from '@/lib/search-validation';
import { checkRateLimit } from '@/lib/rate-limit';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

const initializeFirebaseAdmin = () => {
  try {
    if (!process.env.FIREBASE_PRIVATE_KEY || !process.env.FIREBASE_CLIENT_EMAIL) {
      throw new Error('Missing Firebase Admin credentials');
    }

    if (!process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL) {
      throw new Error('Missing Firebase Database URL');
    }

    if (getApps().length === 0) {
      initializeApp({
        credential: cert({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
        databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
      });
    }

    return getDatabase();
  } catch (error: any) {
    console.error('Firebase Admin initialization error:', error);
    throw error;
  }
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  console.log(`Processing search request from IP: ${ip}`);

  try {
    // Apply rate limiting
    const isAllowed = await checkRateLimit(ip);
    if (!isAllowed) {
      console.log(`Rate limit exceeded for IP: ${ip}`);
      return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
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

    // Initialize Firebase Admin and get Database instance
    const database = initializeFirebaseAdmin();

    // Record the search term in Firebase Realtime Database
    try {
      const searchRef = database.ref(`searchTerms/${normalizedTerm.toLowerCase()}`);
      const snapshot = await searchRef.once('value');
      const currentCount = snapshot.exists() ? snapshot.val().count || 0 : 0;
      
      await searchRef.set({
        term: normalizedTerm,
        count: currentCount + 1,
        lastUpdated: Date.now()
      });
      
      console.log(`Successfully recorded search term: ${normalizedTerm}`);
    } catch (dbError) {
      console.error('Database error:', dbError);
      throw new Error(`Failed to record search term: ${dbError.message}`);
    }

    return res.status(200).json({ 
      success: true,
      message: 'Search term recorded successfully'
    });
  } catch (error) {
    console.error('Error processing search request:', error);
    return res.status(500).json({ 
      error: 'An error occurred while processing your request',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}