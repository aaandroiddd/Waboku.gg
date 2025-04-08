import { NextApiRequest, NextApiResponse } from 'next';
import { getDatabase } from 'firebase-admin/database';
import { validateSearchTerm } from '@/lib/search-validation';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { initializeApp, getApps, cert } from 'firebase-admin/app';

// Ensure we have a proper origin for CORS
const getAllowedOrigins = () => {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
  const origins = [
    'http://localhost:3000',
    'https://localhost:3000',
    'https://waboku.vercel.app',
    'https://waboku-ee453.vercel.app'
  ];
  
  // Add the app URL if it exists
  if (appUrl && !origins.includes(appUrl)) {
    origins.push(appUrl);
  }
  
  // Add preview URLs for co.dev
  origins.push('https://*.preview.co.dev');
  
  return origins;
};

const CACHE_DURATION = 300 * 1000; // 300 seconds cache (5 minutes)
let cachedTrending: any = null;
let lastCacheTime = 0;

// Fallback data - we'll return an empty array if no data is available
const FALLBACK_TRENDING: Array<{ term: string, count: number }> = [];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const requestId = Math.random().toString(36).substring(2, 15);
  console.info(`Path: /api/trending-searches START RequestId: ${requestId}`);
  
  // Add CORS headers
  const allowedOrigins = getAllowedOrigins();
  const origin = req.headers.origin || '';
  
  // Check if the origin is allowed or matches a wildcard pattern
  const isAllowed = allowedOrigins.some(allowedOrigin => {
    if (allowedOrigin.includes('*')) {
      const pattern = allowedOrigin.replace(/\*/g, '.*');
      return new RegExp(pattern).test(origin);
    }
    return allowedOrigin === origin;
  });
  
  // Set the appropriate CORS headers
  if (isAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    // For security, we'll still respond but with a restricted CORS policy
    // This allows the API to work in development and production environments
    res.setHeader('Access-Control-Allow-Origin', process.env.NEXT_PUBLIC_APP_URL || 'https://waboku.vercel.app');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=300'); // Allow caching for 5 minutes
  
  // Handle preflight request
  if (req.method === 'OPTIONS') {
    console.info(`Path: /api/trending-searches [${requestId}] Handling OPTIONS request`);
    res.status(200).end();
    return;
  }
  
  if (req.method !== 'GET') {
    console.error(`Path: /api/trending-searches [${requestId}] Invalid method:`, req.method);
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only GET requests are supported'
    });
  }
  
  // Check if we have a valid cache
  const now = Date.now();
  if (cachedTrending && (now - lastCacheTime) < CACHE_DURATION) {
    console.info(`Path: /api/trending-searches [${requestId}] Returning cached trending searches`);
    return res.status(200).json(cachedTrending);
  }

  // Set a timeout for the entire request
  const requestTimeout = setTimeout(() => {
    console.warn(`Path: /api/trending-searches [${requestId}] Request timeout reached, returning fallback data`);
    if (!res.writableEnded) {
      res.status(200).json(FALLBACK_TRENDING);
    }
  }, 3000); // 3 seconds timeout

  try {
    // Check if the request has already been aborted by the client
    if (req.socket?.destroyed) {
      console.warn(`Path: /api/trending-searches [${requestId}] Request aborted by client (socket destroyed)`);
      clearTimeout(requestTimeout);
      return res.status(499).end(); // 499 is "Client Closed Request"
    }
    
    // Set fallback data as default
    cachedTrending = FALLBACK_TRENDING;
    lastCacheTime = now;
    
    // Check if required environment variables are present
    const requiredEnvVars = {
      projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY,
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
    };
    
    const missingVars = Object.entries(requiredEnvVars)
      .filter(([_, value]) => !value)
      .map(([key]) => key);
      
    if (missingVars.length > 0) {
      console.error(`Path: /api/trending-searches [${requestId}] Missing required environment variables:`, missingVars);
      clearTimeout(requestTimeout);
      return res.status(200).json(FALLBACK_TRENDING);
    }
    
    // Initialize Firebase Admin
    let admin;
    try {
      // Try using the centralized Firebase Admin initialization with timeout
      admin = await Promise.race([
        getFirebaseAdmin(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Firebase Admin initialization timeout')), 2000)
        )
      ]);
    } catch (initError) {
      console.error(`Path: /api/trending-searches [${requestId}] Firebase admin initialization error:`, initError);
      
      // Try direct initialization as a fallback
      if (getApps().length === 0) {
        try {
          console.log(`Path: /api/trending-searches [${requestId}] Attempting direct Firebase admin initialization`);
          
          // Format private key correctly if it's provided as a string with escaped newlines
          const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
          
          initializeApp({
            credential: cert({
              projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
              clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
              privateKey
            }),
            databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
          });
          
          console.log(`Path: /api/trending-searches [${requestId}] Direct Firebase admin initialization successful`);
        } catch (directInitError) {
          console.error(`Path: /api/trending-searches [${requestId}] Direct Firebase admin initialization failed:`, directInitError);
          clearTimeout(requestTimeout);
          return res.status(200).json(FALLBACK_TRENDING);
        }
      }
    }
    
    // Check if the request has been aborted
    if (req.socket?.destroyed) {
      console.warn(`Path: /api/trending-searches [${requestId}] Request aborted during Firebase admin init`);
      clearTimeout(requestTimeout);
      return res.status(499).end();
    }
    
    // Get database instance
    let database;
    try {
      database = getDatabase();
      
      if (!database) {
        throw new Error('Failed to get Firebase database instance');
      }
    } catch (dbError) {
      console.error(`Path: /api/trending-searches [${requestId}] Failed to get Firebase database instance:`, dbError);
      clearTimeout(requestTimeout);
      return res.status(200).json(FALLBACK_TRENDING);
    }
    
    // Check if the request has been aborted
    if (req.socket?.destroyed) {
      console.warn(`Path: /api/trending-searches [${requestId}] Request aborted after database init`);
      clearTimeout(requestTimeout);
      return res.status(499).end();
    }
    
    // Calculate timestamp for 24 hours ago
    const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
    
    // Query the database with timeout
    let snapshot;
    try {
      snapshot = await Promise.race([
        database
          .ref('searchTerms')
          .orderByChild('lastUpdated')
          .startAt(twentyFourHoursAgo)
          .once('value'),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Database query timeout')), 2500)
        )
      ]);
    } catch (queryError) {
      console.error(`Path: /api/trending-searches [${requestId}] Database query error:`, queryError);
      clearTimeout(requestTimeout);
      return res.status(200).json(FALLBACK_TRENDING);
    }
    
    if (!snapshot || !snapshot.exists()) {
      console.info(`Path: /api/trending-searches [${requestId}] No trending searches found in the last 24 hours`);
      clearTimeout(requestTimeout);
      return res.status(200).json(FALLBACK_TRENDING);
    }

    const searchCounts: { [key: string]: { term: string, count: number } } = {};
    
    // Aggregate search counts from the last 24 hours
    snapshot.forEach((childSnapshot) => {
      const search = childSnapshot.val();
      if (search && search.term && validateSearchTerm(search.term)) {
        const normalizedTerm = search.term.toLowerCase();
        if (!searchCounts[normalizedTerm]) {
          searchCounts[normalizedTerm] = {
            term: search.term.charAt(0).toUpperCase() + search.term.slice(1),
            count: 0
          };
        }
        searchCounts[normalizedTerm].count += 1;
      }
      return false;
    });

    // Convert to array and sort by count
    let trending = Object.values(searchCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Get top 10
      
    // If no trending searches found, use fallback data
    if (trending.length === 0) {
      trending = FALLBACK_TRENDING;
    }

    // Update cache
    cachedTrending = trending;
    lastCacheTime = now;

    console.info(`Path: /api/trending-searches [${requestId}] Successfully fetched ${trending.length} trending searches`);
    clearTimeout(requestTimeout);
    return res.status(200).json(trending);
  } catch (error: any) {
    console.error(`Path: /api/trending-searches [${requestId}] Error:`, {
      message: error.message,
      stack: error.stack?.substring(0, 200), // Limit stack trace length
      code: error.code,
      name: error.name,
      type: error.constructor.name,
      config: {
        hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY,
        hasClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
        hasProjectId: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        hasDatabaseUrl: !!process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
      },
      timestamp: new Date().toISOString()
    });
    
    // Return fallback data instead of error
    console.info(`Path: /api/trending-searches [${requestId}] Returning fallback trending data due to error`);
    clearTimeout(requestTimeout);
    return res.status(200).json(FALLBACK_TRENDING);
  } finally {
    // Ensure timeout is cleared in all cases
    clearTimeout(requestTimeout);
    console.info(`Path: /api/trending-searches [${requestId}] Request completed`);
  }
}