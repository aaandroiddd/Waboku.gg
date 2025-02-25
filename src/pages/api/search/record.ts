import { NextApiRequest, NextApiResponse } from 'next';
import { validateSearchTerm, normalizeSearchTerm } from '@/lib/search-validation';
import { checkRateLimit } from '@/lib/rate-limit';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

const initializeFirebaseAdmin = () => {
  try {
    // Check for required environment variables
    const requiredEnvVars = {
      'FIREBASE_PRIVATE_KEY': process.env.FIREBASE_PRIVATE_KEY,
      'FIREBASE_CLIENT_EMAIL': process.env.FIREBASE_CLIENT_EMAIL,
      'NEXT_PUBLIC_FIREBASE_DATABASE_URL': process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
      'NEXT_PUBLIC_FIREBASE_PROJECT_ID': process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
    };

    // Check all required environment variables
    const missingVars = Object.entries(requiredEnvVars)
      .filter(([_, value]) => !value)
      .map(([key]) => key);

    if (missingVars.length > 0) {
      console.error('Missing environment variables:', missingVars);
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }

    if (getApps().length === 0) {
      console.log('Initializing new Firebase Admin instance...');
      
      const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
      
      const config = {
        credential: cert({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey,
        }),
        databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
      };

      initializeApp(config);
      console.log('Firebase Admin initialized successfully');
    }

    const db = getDatabase();
    if (!db) {
      throw new Error('Failed to get database instance');
    }
    return db;
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
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Search term recording request received`);
  
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
    console.log('Method not allowed:', req.method);
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
    
    // Validate search term
    if (!searchTerm || typeof searchTerm !== 'string') {
      console.log('Invalid search term format:', searchTerm);
      return res.status(400).json({ 
        error: 'Invalid search term format',
        message: 'Search term must be a non-empty string'
      });
    }

    console.log(`Processing search term: "${searchTerm}"`);

    // Normalize search term
    const normalizedTerm = normalizeSearchTerm(searchTerm);
    console.log(`Normalized search term: "${normalizedTerm}"`);
    
    // Log the validation process
    console.log('Starting search term validation...');
    console.log('Term length:', normalizedTerm.length);
    console.log('Character test:', /^[a-zA-Z0-9\s\-',.:"()&]+$/.test(normalizedTerm));
    
    // Apply search term validation
    if (!validateSearchTerm(normalizedTerm)) {
      console.log(`Search term validation failed: "${normalizedTerm}"`);
      return res.status(400).json({ 
        error: 'Invalid search term',
        message: 'Search term contains invalid characters or is inappropriate'
      });
    }

    // Initialize Firebase Admin and get Database instance
    console.log('Initializing Firebase Admin...');
    const database = initializeFirebaseAdmin();

    // Record the search term in Firebase Realtime Database
    try {
      const searchRef = database.ref('searchTerms').child(normalizedTerm.toLowerCase());
      
      const snapshot = await searchRef.once('value');
      const currentCount = snapshot.exists() ? snapshot.val()?.count || 0 : 0;
      
      const updateData = {
        term: normalizedTerm,
        count: currentCount + 1,
        lastUpdated: Date.now()
      };

      await searchRef.set(updateData);
      console.log(`Successfully recorded search term: "${normalizedTerm}" (count: ${currentCount + 1})`);
      
      return res.status(200).json({ 
        success: true,
        message: 'Search term recorded successfully',
        data: updateData
      });
    } catch (dbError: any) {
      console.error('Database operation error:', {
        message: dbError.message,
        stack: dbError.stack,
        searchTerm: normalizedTerm
      });
      throw new Error(`Failed to record search term in database: ${dbError.message}`);
    }
  } catch (error: any) {
    console.error('Error processing search request:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    return res.status(500).json({ 
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred while processing your request',
      timestamp: new Date().toISOString()
    });
  }
}