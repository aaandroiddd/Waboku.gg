import { NextApiRequest, NextApiResponse } from 'next';
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
      const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
      
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
    console.error('Firebase Admin initialization error:', error);
    throw error;
  }
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verify the request is authorized using CRON_SECRET
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const database = initializeFirebaseAdmin();
    
    // Calculate timestamp for data older than 7 days (keep more data for better trending analysis)
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    // Get all search terms older than 7 days
    const snapshot = await database
      .ref('searchTerms')
      .orderByChild('lastUpdated')
      .endAt(sevenDaysAgo)
      .once('value');
    
    if (!snapshot.exists()) {
      return res.status(200).json({ 
        message: 'No old search data to clean up (older than 7 days)',
        cleanedCount: 0
      });
    }

    // Collect all old entries to remove
    const updates: { [key: string]: null } = {};
    let cleanedCount = 0;

    snapshot.forEach((childSnapshot) => {
      updates[childSnapshot.key as string] = null;
      cleanedCount++;
      return false;
    });

    // Remove old entries
    if (cleanedCount > 0) {
      await database.ref('searchTerms').update(updates);
    }

    return res.status(200).json({
      message: 'Successfully cleaned up old search data',
      cleanedCount
    });
  } catch (error: any) {
    console.error('Error cleaning up search data:', error);
    return res.status(500).json({ 
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Failed to clean up search data'
    });
  }
}