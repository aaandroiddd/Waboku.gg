import { NextApiRequest, NextApiResponse } from 'next';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { validateSearchTerm } from '@/lib/search-validation';

const CACHE_DURATION = 30 * 1000; // 30 seconds cache
let cachedTrending: any = null;
let lastCacheTime = 0;

// Initialize Firebase Admin for server-side
const initializeFirebaseAdmin = () => {
  try {
    if (!process.env.FIREBASE_PRIVATE_KEY || !process.env.FIREBASE_CLIENT_EMAIL) {
      console.error('Missing Firebase credentials:', {
        hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY,
        hasClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL
      });
      throw new Error('Missing Firebase Admin credentials');
    }

    if (!process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL) {
      console.error('Missing Firebase Database URL');
      throw new Error('Missing Firebase Database URL');
    }

    if (getApps().length === 0) {
      const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
      
      console.log('Initializing Firebase Admin with config:', {
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
        hasPrivateKey: !!privateKey,
        privateKeyLength: privateKey.length
      });

      initializeApp({
        credential: cert({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey,
        }),
        databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
      });
    }

    return getDatabase();
  } catch (error: any) {
    console.error('Firebase Admin initialization error:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log('Trending searches API called at:', new Date().toISOString());
  
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  if (req.method !== 'GET') {
    console.error('Invalid method for trending-searches:', req.method);
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only GET requests are supported'
    });
  }

  // Check if we have a valid cache
  const now = Date.now();
  if (cachedTrending && (now - lastCacheTime) < CACHE_DURATION) {
    console.log('Returning cached trending searches');
    return res.status(200).json(cachedTrending);
  }

  try {
    console.log('Initializing Firebase Admin...');
    const database = initializeFirebaseAdmin();
    
    console.log('Fetching trending searches from Firebase...');
    
    const snapshot = await database
      .ref('searchTerms')
      .orderByChild('count')
      .limitToLast(10)
      .once('value');
    
    if (!snapshot.exists()) {
      console.log('No trending searches found');
      cachedTrending = [];
      lastCacheTime = now;
      return res.status(200).json([]);
    }

    const trending: any[] = [];
    
    snapshot.forEach((childSnapshot) => {
      const search = childSnapshot.val();
      if (search && search.term && validateSearchTerm(search.term)) {
        trending.push({
          term: search.term.charAt(0).toUpperCase() + search.term.slice(1),
          count: search.count || 0
        });
      }
      return false; // Required for TypeScript forEach
    });

    // Sort by count in descending order
    trending.sort((a, b) => b.count - a.count);

    // Update cache
    cachedTrending = trending;
    lastCacheTime = now;

    console.log(`Successfully fetched ${trending.length} trending searches`);
    return res.status(200).json(trending);
  } catch (error: any) {
    console.error('Error in trending-searches API:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      config: {
        hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY,
        hasClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
        hasProjectId: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        hasDatabaseUrl: !!process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
      },
      timestamp: new Date().toISOString()
    });
    
    return res.status(500).json({
      error: 'Internal Server Error',
      message: process.env.NEXT_PUBLIC_CO_DEV_ENV === 'development' 
        ? error.message 
        : 'Failed to fetch trending searches',
      code: error.code
    });
  }
}