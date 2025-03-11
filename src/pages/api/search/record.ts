import { NextApiRequest, NextApiResponse } from 'next';
import { validateSearchTerm, normalizeSearchTerm } from '@/lib/search-validation';
import { checkRateLimit } from '@/lib/rate-limit';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { getDatabase } from 'firebase-admin/database';

// Timeout for database operations
const DB_OPERATION_TIMEOUT = 3000; // 3 seconds

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const requestId = Math.random().toString(36).substring(2, 15);
  const timestamp = new Date().toISOString();
  console.log(`Path: /api/search/record [${requestId}] Search term recording request received at ${timestamp}`);
  
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    console.log(`Path: /api/search/record [${requestId}] Method not allowed:`, req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  console.log(`Path: /api/search/record [${requestId}] Processing search request from IP: ${ip}`);

  try {
    // Apply rate limiting
    const isAllowed = await checkRateLimit(ip);
    if (!isAllowed) {
      console.log(`Path: /api/search/record [${requestId}] Rate limit exceeded for IP: ${ip}`);
      return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
    }

    const { searchTerm } = req.body;
    
    // Validate search term
    if (!searchTerm || typeof searchTerm !== 'string') {
      console.log(`Path: /api/search/record [${requestId}] Invalid search term format:`, searchTerm);
      return res.status(400).json({ 
        error: 'Invalid search term format',
        message: 'Search term must be a non-empty string'
      });
    }

    console.log(`Path: /api/search/record [${requestId}] Processing search term: "${searchTerm}"`);

    // Normalize search term
    const normalizedTerm = normalizeSearchTerm(searchTerm);
    console.log(`Path: /api/search/record [${requestId}] Normalized search term: "${normalizedTerm}"`);
    
    // Apply search term validation
    const isValid = validateSearchTerm(normalizedTerm);
    console.log(`Path: /api/search/record [${requestId}] Validation result:`, isValid);
    
    if (!isValid) {
      console.log(`Path: /api/search/record [${requestId}] Search term validation failed: "${normalizedTerm}"`);
      return res.status(400).json({ 
        error: 'Invalid search term',
        message: 'Search term contains invalid characters or is inappropriate'
      });
    }

    // Return success early to avoid timeout issues
    // This makes the API non-blocking for the client
    res.status(200).json({ 
      success: true,
      message: 'Search term received for processing',
      term: normalizedTerm
    });

    // Continue processing in the background
    // This prevents the client from waiting for the database operation
    try {
      console.log(`Path: /api/search/record [${requestId}] Initializing Firebase Admin...`);
      
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
        console.error(`Path: /api/search/record [${requestId}] Missing required environment variables:`, missingVars);
        return; // Exit silently as we've already sent a response
      }
      
      // Use the centralized Firebase Admin initialization with timeout
      const adminInitPromise = Promise.race([
        getFirebaseAdmin(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Firebase Admin initialization timeout')), 3000)
        )
      ]);
      
      const admin = await adminInitPromise;
      const database = getDatabase();
      
      if (!database) {
        throw new Error('Failed to get Firebase database instance');
      }
      
      // Set a timeout for the database operation
      const dbOperationPromise = Promise.race([
        (async () => {
          const searchRef = database.ref('searchTerms').child(normalizedTerm.toLowerCase());
          const snapshot = await searchRef.once('value');
          const currentCount = snapshot.exists() ? snapshot.val()?.count || 0 : 0;
          
          const updateData = {
            term: normalizedTerm,
            count: currentCount + 1,
            lastUpdated: Date.now()
          };
          
          await searchRef.set(updateData);
          return updateData;
        })(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Database operation timeout')), DB_OPERATION_TIMEOUT)
        )
      ]);
      
      const result = await dbOperationPromise;
      console.log(`Path: /api/search/record [${requestId}] Successfully recorded search term: "${normalizedTerm}"`);
    } catch (dbError: any) {
      console.error(`Path: /api/search/record [${requestId}] Database operation error:`, {
        message: dbError.message,
        stack: dbError.stack,
        searchTerm: normalizedTerm
      });
      // We don't need to send an error response as we've already sent a success response
    }
  } catch (error: any) {
    console.error(`Path: /api/search/record [${requestId}] Error processing search request:`, {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    // Only send an error response if we haven't sent a response yet
    if (!res.writableEnded) {
      return res.status(500).json({ 
        error: 'Internal Server Error',
        message: 'An error occurred while processing your request'
      });
    }
  }
}