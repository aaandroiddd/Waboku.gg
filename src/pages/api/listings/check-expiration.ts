import { NextApiRequest, NextApiResponse } from 'next';
import { checkAndArchiveExpiredListing } from '@/middleware/listingExpiration';

/**
 * API route to check and archive expired listings in the background
 * This will be called by the client when viewing a listing
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Allow only POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { listingId } = req.body;
    
    if (!listingId) {
      return res.status(400).json({ error: 'Listing ID is required' });
    }
    
    // Check and archive the listing if expired
    const result = await checkAndArchiveExpiredListing(listingId);
    
    // Return the result
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error: any) {
    console.error('[API] Error checking listing expiration:', error);
    return res.status(500).json({ 
      error: 'Failed to check listing expiration',
      details: error.message
    });
  }
}