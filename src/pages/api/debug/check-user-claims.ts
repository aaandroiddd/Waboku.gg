import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing authorization header' });
    }

    const token = authHeader.split(' ')[1];
    
    // Check if it's the admin secret first
    const adminSecret = process.env.ADMIN_SECRET;
    if (token === adminSecret) {
      return res.status(200).json({
        success: true,
        method: 'admin_secret',
        message: 'Admin secret verified successfully'
      });
    }

    // Try to verify as Firebase token
    try {
      const { getFirebaseAdminServices } = await import('@/lib/firebase-admin');
      const { auth } = getFirebaseAdminServices();
      
      const decodedToken = await auth.verifyIdToken(token);
      const userId = decodedToken.uid;
      
      // Get user record to check custom claims
      const userRecord = await auth.getUser(userId);
      const customClaims = userRecord.customClaims || {};
      
      return res.status(200).json({
        success: true,
        method: 'firebase_token',
        userId,
        email: userRecord.email,
        emailVerified: userRecord.emailVerified,
        disabled: userRecord.disabled,
        customClaims,
        hasAdminClaim: customClaims.admin === true,
        hasModeratorClaim: customClaims.moderator === true,
        tokenClaims: {
          iss: decodedToken.iss,
          aud: decodedToken.aud,
          auth_time: decodedToken.auth_time,
          user_id: decodedToken.user_id,
          sub: decodedToken.sub,
          iat: decodedToken.iat,
          exp: decodedToken.exp,
          email: decodedToken.email,
          email_verified: decodedToken.email_verified,
          firebase: decodedToken.firebase
        }
      });
      
    } catch (firebaseError: any) {
      return res.status(401).json({
        success: false,
        error: 'Invalid Firebase token',
        details: firebaseError.message
      });
    }

  } catch (error: any) {
    console.error('[Check User Claims] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
}