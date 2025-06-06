import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check environment variables
    const config = {
      apiKey: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: !!process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: !!process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: !!process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: !!process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      databaseURL: !!process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
    };

    const configValues = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? 
        `${process.env.NEXT_PUBLIC_FIREBASE_API_KEY.substring(0, 5)}...` : 'missing',
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'missing',
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'missing',
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'missing',
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || 'missing',
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ? 
        `${process.env.NEXT_PUBLIC_FIREBASE_APP_ID.substring(0, 10)}...` : 'missing',
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || 'missing'
    };

    // Check for missing values
    const missingValues = Object.entries(config)
      .filter(([key, value]) => !value)
      .map(([key]) => key);

    return res.status(200).json({
      success: true,
      config: configValues,
      hasAllRequiredValues: missingValues.length === 0,
      missingValues,
      databaseURLPresent: !!process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
      databaseURLFormat: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ? 
        (process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL.includes('firebaseio.com') ? 'valid' : 'invalid') : 'missing'
    });

  } catch (error) {
    console.error('Error checking Firebase config:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}