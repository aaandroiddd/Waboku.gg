import { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from 'firebase-admin/auth';
import { initializeAdminApp } from '@/lib/firebase-admin';
import { rateLimit } from '@/lib/rate-limit';

// Rate limiting to prevent abuse
const limiter = rateLimit({
  limit: 5,
  window: 60 * 1000 // 60 seconds
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // Apply rate limiting - 5 requests per minute per IP
    await limiter(req, res);
  } catch (error) {
    return res.status(429).json({ message: 'Rate limit exceeded. Please try again later.' });
  }

  try {
    // Validate Firebase configuration
    if (!process.env.FIREBASE_PRIVATE_KEY || !process.env.FIREBASE_CLIENT_EMAIL) {
      console.error('Firebase admin configuration is incomplete');
      return res.status(500).json({ 
        error: 'Authentication service configuration error',
        message: 'Authentication service is currently unavailable. Please try again later.'
      });
    }
    
    // Initialize Firebase Admin
    const { app } = initializeAdminApp();
    const auth = getAuth(app);

    // Get email from request body
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if the email exists in Firebase Auth
    let authUser = null;
    try {
      authUser = await auth.getUserByEmail(email);
    } catch (error: any) {
      // If the user doesn't exist in Auth, return empty result
      if (error.code === 'auth/user-not-found') {
        return res.status(200).json({
          exists: false,
          hasGoogleAuth: false
        });
      }
      throw error;
    }

    // Get the user's auth providers
    const userRecord = await auth.getUser(authUser.uid);
    const authProviders = userRecord.providerData.map(provider => provider.providerId);
    
    // Check if Google is one of the providers
    const hasGoogleAuth = authProviders.includes('google.com');

    // Return the results
    return res.status(200).json({
      exists: true,
      hasGoogleAuth,
      authProviders
    });
  } catch (error: any) {
    console.error('Error checking Google auth:', error);
    return res.status(500).json({
      error: 'Failed to check authentication methods',
      message: error.message,
      code: error.code
    });
  }
}