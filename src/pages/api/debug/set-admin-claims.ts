import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing authorization header' });
    }

    const token = authHeader.split(' ')[1];
    const { userId, isAdmin, isModerator } = req.body;
    
    // Only allow admin secret for this operation
    const adminSecret = process.env.ADMIN_SECRET;
    if (token !== adminSecret) {
      return res.status(403).json({ error: 'Admin secret required for this operation' });
    }

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    try {
      const { getFirebaseAdmin } = await import('@/lib/firebase-admin');
      const { auth } = getFirebaseAdmin();
      
      // Get current user record
      const userRecord = await auth.getUser(userId);
      const currentClaims = userRecord.customClaims || {};
      
      // Prepare new claims
      const newClaims = {
        ...currentClaims,
        admin: isAdmin === true,
        moderator: isModerator === true
      };
      
      // Remove false values to keep claims clean
      if (!newClaims.admin) delete newClaims.admin;
      if (!newClaims.moderator) delete newClaims.moderator;
      
      // Set custom claims
      await auth.setCustomUserClaims(userId, newClaims);
      
      // Get updated user record to confirm
      const updatedUserRecord = await auth.getUser(userId);
      
      return res.status(200).json({
        success: true,
        message: 'Custom claims updated successfully',
        userId,
        email: updatedUserRecord.email,
        previousClaims: currentClaims,
        newClaims: updatedUserRecord.customClaims || {},
        note: 'User may need to refresh their token to see the new claims'
      });
      
    } catch (firebaseError: any) {
      return res.status(500).json({
        success: false,
        error: 'Failed to update custom claims',
        details: firebaseError.message
      });
    }

  } catch (error: any) {
    console.error('[Set Admin Claims] Error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
}