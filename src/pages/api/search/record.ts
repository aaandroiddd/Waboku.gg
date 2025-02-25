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

    // Check all required environment variables and log their presence (not values)
    const missingVars = Object.entries(requiredEnvVars)
      .filter(([_, value]) => !value)
      .map(([key]) => key);

    Object.keys(requiredEnvVars).forEach(key => {
      console.log(`${key} is ${requiredEnvVars[key] ? 'present' : 'missing'}`);
    });

    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }

    if (getApps().length === 0) {
      console.log('Initializing Firebase Admin...');
      
      // Handle the private key properly
      let privateKey = process.env.FIREBASE_PRIVATE_KEY;
      
      // Check if the private key needs to be processed
      if (privateKey?.includes('\\n')) {
        console.log('Processing private key newlines...');
        privateKey = privateKey.replace(/\\n/g, '\n');
      }
      
      // Additional validation for private key format
      if (!privateKey?.includes('BEGIN PRIVATE KEY') || !privateKey?.includes('END PRIVATE KEY')) {
        console.error('Private key appears to be malformed');
        throw new Error('Invalid private key format');
      }

      const config = {
        credential: cert({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey,
        }),
        databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
      };

      console.log('Firebase config prepared (excluding sensitive data):', {
        projectId: config.credential.projectId,
        databaseURL: config.databaseURL
      });
      
      initializeApp(config);
      console.log('Firebase Admin initialized successfully');
    }

    const db = getDatabase();
    // Verify database connection
    if (!db) {
      throw new Error('Failed to get database instance');
    }
    return db;
  } catch (error: any) {
    console.error('Firebase Admin initialization error:', error);
    console.error('Error stack:', error.stack);
    throw new Error(`Firebase initialization failed: ${error.message}`);
  }
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Search term recording request received`);
  
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
    console.log('Initializing Firebase Admin...');
    const database = initializeFirebaseAdmin();
    console.log('Firebase Admin initialized, attempting to record search term');

    // Record the search term in Firebase Realtime Database
    try {
      const searchRef = database.ref('searchTerms').child(normalizedTerm.toLowerCase());
      console.log('Getting current count for term...');
      
      const snapshot = await searchRef.once('value');
      const currentCount = snapshot.exists() ? snapshot.val()?.count || 0 : 0;
      
      console.log(`Current count for "${normalizedTerm}": ${currentCount}`);
      
      const updateData = {
        term: normalizedTerm,
        count: currentCount + 1,
        lastUpdated: Date.now()
      };

      await searchRef.set(updateData);
      console.log(`Successfully recorded search term: ${normalizedTerm} (new count: ${currentCount + 1})`);
      
      return res.status(200).json({ 
        success: true,
        message: 'Search term recorded successfully',
        data: updateData
      });
    } catch (dbError: any) {
      console.error('Database operation error:', dbError);
      console.error('Error stack:', dbError.stack);
      throw new Error(`Failed to record search term in database: ${dbError.message}`);
    }
  } catch (error: any) {
    console.error('Error processing search request:', error);
    console.error('Error stack:', error.stack);
    
    // Send a more detailed error response
    return res.status(500).json({ 
      error: 'An error occurred while processing your request',
      message: error.message,
      timestamp: new Date().toISOString(),
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}