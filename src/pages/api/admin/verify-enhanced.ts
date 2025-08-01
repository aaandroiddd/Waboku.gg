import { NextApiRequest, NextApiResponse } from 'next';
import { getClientIP, isIPWhitelisted, verifyBackupCode, getAdminMfaData } from '@/lib/admin-security';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('[Admin Verify Enhanced] Starting verification process');

  try {
    const clientIP = getClientIP(req);
    console.log('[Admin Verify Enhanced] Client IP:', clientIP);

    // Check IP whitelist first
    if (isIPWhitelisted(clientIP)) {
      console.log('[Admin Verify Enhanced] IP is whitelisted, granting access');
      return res.status(200).json({ 
        success: true, 
        isAdmin: true, 
        isModerator: false,
        method: 'ip_whitelist',
        mfaRequired: false,
        ipWhitelisted: true
      });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[Admin Verify Enhanced] Missing or invalid authorization header');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    const { mfaCode, backupCode } = req.body;

    console.log('[Admin Verify Enhanced] Token received, length:', token.length);

    // Check if it's the admin secret
    const adminSecret = process.env.ADMIN_SECRET;
    if (!adminSecret) {
      console.error('[Admin Verify Enhanced] ADMIN_SECRET environment variable not set');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    if (token === adminSecret) {
      console.log('[Admin Verify Enhanced] Admin secret matched');
      return res.status(200).json({ 
        success: true, 
        isAdmin: true, 
        isModerator: false,
        method: 'admin_secret',
        mfaRequired: false,
        ipWhitelisted: false
      });
    }

    // If not admin secret, try to verify as Firebase user token
    try {
      const { getFirebaseAdminServices } = await import('@/lib/firebase-admin');
      const { auth } = getFirebaseAdminServices();
      
      const decodedToken = await auth.verifyIdToken(token);
      const userId = decodedToken.uid;
      
      console.log('[Admin Verify Enhanced] Firebase token verified for user:', userId);
      
      // Check if user has admin/moderator role in custom claims
      const userRecord = await auth.getUser(userId);
      const customClaims = userRecord.customClaims || {};
      
      const isAdmin = customClaims.admin === true;
      const isModerator = customClaims.moderator === true;
      
      if (!isAdmin && !isModerator) {
        console.log('[Admin Verify Enhanced] User does not have admin/moderator role');
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      
      // Check if MFA is required for this user
      const mfaData = await getAdminMfaData(userId);
      const mfaRequired = mfaData?.enabled || false;
      
      if (mfaRequired) {
        // Check if MFA code or backup code is provided
        if (!mfaCode && !backupCode) {
          console.log('[Admin Verify Enhanced] MFA required but no code provided');
          return res.status(200).json({
            success: false,
            isAdmin,
            isModerator,
            method: 'user_auth',
            mfaRequired: true,
            mfaVerified: false,
            userId,
            error: 'MFA verification required'
          });
        }
        
        let mfaVerified = false;
        
        if (backupCode) {
          // Verify backup code
          mfaVerified = await verifyBackupCode(userId, backupCode);
          if (!mfaVerified) {
            console.log('[Admin Verify Enhanced] Invalid backup code');
            return res.status(401).json({ error: 'Invalid backup code' });
          }
          console.log('[Admin Verify Enhanced] Backup code verified');
        } else if (mfaCode) {
          // For now, we'll implement a simple MFA verification
          // In a real implementation, you'd verify against the user's enrolled MFA methods
          console.log('[Admin Verify Enhanced] MFA code verification not fully implemented');
          return res.status(501).json({ error: 'MFA code verification not implemented. Please use backup codes.' });
        }
        
        if (!mfaVerified) {
          return res.status(401).json({ error: 'MFA verification failed' });
        }
      }
      
      console.log('[Admin Verify Enhanced] User authenticated successfully');
      return res.status(200).json({
        success: true,
        isAdmin,
        isModerator,
        method: 'user_auth',
        mfaRequired,
        mfaVerified: mfaRequired,
        userId,
        ipWhitelisted: false
      });
      
    } catch (firebaseError: any) {
      console.log('[Admin Verify Enhanced] Firebase token verification failed:', firebaseError.message);
      return res.status(401).json({ error: 'Invalid authentication token' });
    }

  } catch (error: any) {
    console.error('[Admin Verify Enhanced] General error:', {
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 3).join('\n')
    });
    return res.status(500).json({ error: 'Internal server error' });
  }
}