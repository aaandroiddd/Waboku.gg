import { NextApiRequest, NextApiResponse } from 'next';
import { 
  generateBackupCodes, 
  getAdminMfaData, 
  saveAdminMfaData, 
  needsBackupCodeRegeneration,
  AdminMfaData 
} from '@/lib/admin-security';

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
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    const { action, userId } = req.body;

    // Verify admin secret or Firebase token
    const adminSecret = process.env.ADMIN_SECRET;
    let verifiedUserId = userId;

    if (token === adminSecret) {
      // Admin secret access - userId must be provided
      if (!userId) {
        return res.status(400).json({ error: 'User ID required for admin secret access' });
      }
    } else {
      // Try to verify as Firebase token
      try {
        const { getFirebaseAdminServices } = await import('@/lib/firebase-admin');
        const { auth } = getFirebaseAdminServices();
        
        const decodedToken = await auth.verifyIdToken(token);
        verifiedUserId = decodedToken.uid;
        
        // Check if user has admin role
        const userRecord = await auth.getUser(verifiedUserId);
        const customClaims = userRecord.customClaims || {};
        
        if (!customClaims.admin && !customClaims.moderator) {
          return res.status(403).json({ error: 'Insufficient permissions' });
        }
      } catch (error) {
        return res.status(401).json({ error: 'Invalid authentication token' });
      }
    }

    switch (action) {
      case 'enable':
        return await enableMfa(verifiedUserId, res);
      
      case 'disable':
        return await disableMfa(verifiedUserId, res);
      
      case 'generate-backup-codes':
        return await generateNewBackupCodes(verifiedUserId, res);
      
      case 'get-status':
        return await getMfaStatus(verifiedUserId, res);
      
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }

  } catch (error: any) {
    console.error('[Admin MFA Setup] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function enableMfa(userId: string, res: NextApiResponse) {
  try {
    const existingData = await getAdminMfaData(userId);
    
    const mfaData: AdminMfaData = {
      enabled: true,
      backupCodes: existingData?.backupCodes || generateBackupCodes(),
      lastBackupGenerated: Date.now()
    };
    
    // If no existing backup codes, generate new ones
    if (!existingData?.backupCodes || existingData.backupCodes.length === 0) {
      mfaData.backupCodes = generateBackupCodes();
    }
    
    await saveAdminMfaData(userId, mfaData);
    
    return res.status(200).json({
      success: true,
      message: 'MFA enabled successfully',
      backupCodes: mfaData.backupCodes.map(code => ({
        code: code.code,
        used: code.used
      })),
      needsRegeneration: needsBackupCodeRegeneration(mfaData)
    });
  } catch (error) {
    console.error('Error enabling MFA:', error);
    return res.status(500).json({ error: 'Failed to enable MFA' });
  }
}

async function disableMfa(userId: string, res: NextApiResponse) {
  try {
    const mfaData: AdminMfaData = {
      enabled: false,
      backupCodes: [],
      lastBackupGenerated: Date.now()
    };
    
    await saveAdminMfaData(userId, mfaData);
    
    return res.status(200).json({
      success: true,
      message: 'MFA disabled successfully'
    });
  } catch (error) {
    console.error('Error disabling MFA:', error);
    return res.status(500).json({ error: 'Failed to disable MFA' });
  }
}

async function generateNewBackupCodes(userId: string, res: NextApiResponse) {
  try {
    const existingData = await getAdminMfaData(userId);
    
    if (!existingData?.enabled) {
      return res.status(400).json({ error: 'MFA is not enabled' });
    }
    
    const newBackupCodes = generateBackupCodes();
    
    const mfaData: AdminMfaData = {
      ...existingData,
      backupCodes: newBackupCodes,
      lastBackupGenerated: Date.now()
    };
    
    await saveAdminMfaData(userId, mfaData);
    
    return res.status(200).json({
      success: true,
      message: 'New backup codes generated successfully',
      backupCodes: newBackupCodes.map(code => ({
        code: code.code,
        used: code.used
      })),
      needsRegeneration: false
    });
  } catch (error) {
    console.error('Error generating backup codes:', error);
    return res.status(500).json({ error: 'Failed to generate backup codes' });
  }
}

async function getMfaStatus(userId: string, res: NextApiResponse) {
  try {
    const mfaData = await getAdminMfaData(userId);
    
    if (!mfaData) {
      return res.status(200).json({
        enabled: false,
        backupCodes: [],
        needsRegeneration: false,
        unusedCodesCount: 0
      });
    }
    
    const unusedCodes = mfaData.backupCodes.filter(code => !code.used);
    
    return res.status(200).json({
      enabled: mfaData.enabled,
      backupCodes: mfaData.backupCodes.map(code => ({
        code: code.code,
        used: code.used,
        usedAt: code.usedAt
      })),
      needsRegeneration: needsBackupCodeRegeneration(mfaData),
      unusedCodesCount: unusedCodes.length,
      lastBackupGenerated: mfaData.lastBackupGenerated
    });
  } catch (error) {
    console.error('Error getting MFA status:', error);
    return res.status(500).json({ error: 'Failed to get MFA status' });
  }
}