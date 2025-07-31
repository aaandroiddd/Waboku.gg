import { NextApiRequest, NextApiResponse } from 'next';
import { 
  getUserAccountTier, 
  getBatchAccountTiers, 
  getAccountTierCacheStats, 
  clearAllAccountTierCache 
} from '@/lib/account-tier-detection';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check authorization
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  if (token !== process.env.NEXT_PUBLIC_ADMIN_SECRET) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const { action, userId, userIds } = req.body;

  try {
    switch (action) {
      case 'single': {
        if (!userId) {
          return res.status(400).json({ error: 'User ID is required' });
        }

        console.log(`[AccountTierDebug] Testing single user: ${userId}`);
        const result = await getUserAccountTier(userId);
        
        return res.status(200).json({
          success: true,
          result
        });
      }

      case 'batch': {
        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
          return res.status(400).json({ error: 'User IDs array is required' });
        }

        if (userIds.length > 20) {
          return res.status(400).json({ error: 'Maximum 20 user IDs allowed' });
        }

        console.log(`[AccountTierDebug] Testing batch users: ${userIds.length} users`);
        const batchResults = await getBatchAccountTiers(userIds);
        
        // Convert Map to array for JSON response
        const results = userIds.map(userId => {
          const result = batchResults.get(userId);
          if (result) {
            return {
              userId,
              result
            };
          } else {
            return {
              userId,
              error: 'User not found or error occurred'
            };
          }
        });

        return res.status(200).json({
          success: true,
          results
        });
      }

      case 'cache-stats': {
        console.log('[AccountTierDebug] Getting cache stats');
        const stats = getAccountTierCacheStats();
        
        return res.status(200).json({
          success: true,
          stats
        });
      }

      case 'clear-cache': {
        console.log('[AccountTierDebug] Clearing cache');
        clearAllAccountTierCache();
        
        return res.status(200).json({
          success: true,
          message: 'Cache cleared successfully'
        });
      }

      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error: any) {
    console.error('[AccountTierDebug] Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}