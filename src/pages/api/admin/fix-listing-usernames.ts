import { NextApiRequest, NextApiResponse } from 'next';
import { checkAndFixListingUsernames, getListingUsernameSample, fixSpecificListingUsernames } from '@/lib/username-migration';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { action, limit, listingIds } = req.body;

    switch (action) {
      case 'sample':
        // Get a sample of listings to check their username status
        const sample = await getListingUsernameSample(limit || 10);
        return res.status(200).json({
          success: true,
          data: sample,
          message: `Retrieved sample of ${sample.length} listings`
        });

      case 'check':
        // Check and fix listings with user ID usernames
        const checkResults = await checkAndFixListingUsernames(limit || 50);
        return res.status(200).json({
          success: true,
          data: checkResults,
          message: `Checked ${checkResults.checked} listings, fixed ${checkResults.fixed} listings`
        });

      case 'fix-specific':
        // Fix specific listing IDs
        if (!listingIds || !Array.isArray(listingIds)) {
          return res.status(400).json({ error: 'listingIds array is required for fix-specific action' });
        }
        
        const fixResults = await fixSpecificListingUsernames(listingIds);
        return res.status(200).json({
          success: true,
          data: fixResults,
          message: `Fixed ${fixResults.fixed} listings`
        });

      default:
        return res.status(400).json({ error: 'Invalid action. Use: sample, check, or fix-specific' });
    }
  } catch (error) {
    console.error('Error in fix-listing-usernames API:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
}