import { NextApiRequest, NextApiResponse } from 'next';
import { getDatabase, ref, query, orderByChild, get, limitToLast } from 'firebase/database';
import { initializeApp, getApps } from 'firebase/app';
import { validateSearchTerm } from '@/lib/search-validation';

const CACHE_DURATION = 30 * 1000; // 30 seconds cache
let cachedTrending: any = null;
let lastCacheTime = 0;

// Initialize Firebase for server-side
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
};

// Validate Firebase configuration
const validateConfig = () => {
  const requiredFields = [
    'apiKey',
    'authDomain',
    'projectId',
    'databaseURL'
  ];

  const missingFields = requiredFields.filter(field => !firebaseConfig[field as keyof typeof firebaseConfig]);
  
  if (missingFields.length > 0) {
    throw new Error(`Missing required Firebase configuration: ${missingFields.join(', ')}`);
  }
};

// Initialize Firebase if not already initialized
const getFirebaseAdmin = () => {
  try {
    validateConfig();
    
    if (!getApps().length) {
      return initializeApp(firebaseConfig);
    }
    return getApps()[0];
  } catch (error: any) {
    console.error('Firebase initialization error:', {
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
  console.log('Trending searches API called');
  
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  
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

  let app;
  let database;

  try {
    console.log('Initializing Firebase...');
    app = getFirebaseAdmin();
    
    if (!app) {
      throw new Error('Failed to initialize Firebase app');
    }

    database = getDatabase(app);

    if (!database) {
      throw new Error('Failed to initialize Firebase Realtime Database');
    }

    console.log('Fetching trending searches from Firebase...');
    const searchesRef = ref(database, 'searches');
    
    // Get searches from the last 48 hours
    const twoDaysAgo = now - (48 * 60 * 60 * 1000);
    
    const searchesQuery = query(
      searchesRef,
      orderByChild('timestamp'),
      limitToLast(500) // Increased limit for better trending calculation
    );

    const snapshot = await get(searchesQuery);
    
    if (!snapshot.exists()) {
      console.log('No trending searches found');
      cachedTrending = [];
      lastCacheTime = now;
      return res.status(200).json([]);
    }

    const searches: any = [];
    
    snapshot.forEach((childSnapshot) => {
      const search = childSnapshot.val();
      // Only include valid searches from the last 48 hours
      if (search.timestamp >= twoDaysAgo && validateSearchTerm(search.term)) {
        searches.push(search);
      }
    });

    // Count occurrences and sort by frequency
    const searchCounts = searches.reduce((acc: any, curr: any) => {
      const term = curr.term.trim().toLowerCase();
      acc[term] = (acc[term] || 0) + 1;
      return acc;
    }, {});

    let trending = Object.entries(searchCounts)
      .map(([term, count]) => ({ 
        term: term.charAt(0).toUpperCase() + term.slice(1), // Capitalize first letter
        count 
      }))
      .sort((a: any, b: any) => b.count - a.count)
      .slice(0, 5); // Return top 5 trending searches

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
        hasApiKey: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        hasAuthDomain: !!process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        hasProjectId: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        hasDatabaseUrl: !!process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
      },
      timestamp: new Date().toISOString()
    });
    
    // Return a more specific error message
    return res.status(500).json({
      error: 'Internal Server Error',
      message: process.env.NEXT_PUBLIC_CO_DEV_ENV === 'development' 
        ? error.message 
        : 'Failed to fetch trending searches',
      code: error.code
    });
  } finally {
    // Clean up any resources if needed
    if (database) {
      try {
        await database.goOffline();
      } catch (e) {
        console.error('Error closing database connection:', e);
      }
    }
  }
}