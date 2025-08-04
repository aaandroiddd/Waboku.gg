import { NextApiRequest, NextApiResponse } from 'next';
import { getUserAccountTier } from '@/lib/account-tier-detection';
import { getPremiumStatus } from '@/lib/premium-status';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, adminSecret } = req.body;

    // Verify admin secret
    if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    console.log(`[Admin] Debugging account status for user: ${userId}`);

    // Get account status from multiple sources for comparison
    const [accountTierResult, premiumStatusResult] = await Promise.allSettled([
      getUserAccountTier(userId, true), // Force refresh
      getPremiumStatus(userId, true)    // Force refresh
    ]);

    // Process account tier result
    let accountData = null;
    if (accountTierResult.status === 'fulfilled') {
      accountData = accountTierResult.value;
    } else {
      console.error('[Admin] Account tier detection failed:', accountTierResult.reason);
    }

    // Process premium status result
    let premiumData = null;
    if (premiumStatusResult.status === 'fulfilled') {
      premiumData = premiumStatusResult.value;
    } else {
      console.error('[Admin] Premium status detection failed:', premiumStatusResult.reason);
    }

    // Combine results for comprehensive debugging
    const debugResult = {
      userId,
      accountTier: accountData?.tier || 'unknown',
      isPremium: accountData?.isPremium || false,
      subscription: {
        status: accountData?.subscription?.status || premiumData?.subscription?.status || 'unknown',
        stripeSubscriptionId: accountData?.subscription?.stripeSubscriptionId || premiumData?.subscription?.stripeSubscriptionId,
        startDate: accountData?.subscription?.startDate || premiumData?.subscription?.startDate,
        endDate: accountData?.subscription?.endDate || premiumData?.subscription?.endDate,
        renewalDate: accountData?.subscription?.renewalDate || premiumData?.subscription?.renewalDate
      },
      source: accountData?.source || premiumData?.source || 'error',
      lastChecked: accountData?.lastChecked || premiumData?.lastChecked || Date.now(),
      // Additional debugging info
      debug: {
        accountTierResult: accountData,
        premiumStatusResult: premiumData,
        errors: {
          accountTier: accountTierResult.status === 'rejected' ? accountTierResult.reason?.message : null,
          premiumStatus: premiumStatusResult.status === 'rejected' ? premiumStatusResult.reason?.message : null
        }
      }
    };

    console.log(`[Admin] Account status debug result for ${userId}:`, {
      tier: debugResult.accountTier,
      isPremium: debugResult.isPremium,
      subscriptionStatus: debugResult.subscription.status,
      source: debugResult.source
    });

    return res.status(200).json(debugResult);

  } catch (error: any) {
    console.error('[Admin] Account status debug error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}