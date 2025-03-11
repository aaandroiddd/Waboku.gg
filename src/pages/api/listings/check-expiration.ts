import { NextApiRequest, NextApiResponse } from 'next';
import { checkAndArchiveExpiredListing } from '@/middleware/listingExpiration';

/**
 * API route to check and archive expired listings in the background
 * This will be called by the client when viewing a listing
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Allow only POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { listingId } = req.body;
    
    if (!listingId) {
      return res.status(400).json({ success: false, error: 'Listing ID is required' });
    }
    
    console.log(`[API] Checking expiration for listing: ${listingId}`);
    
    // Check and archive the listing if expired
    const result = await checkAndArchiveExpiredListing(listingId);
    
    // Return the result with appropriate status code
    if (result.success) {
      return res.status(200).json(result);
    } else {
      console.error(`[API] Expiration check failed for listing ${listingId}:`, result.error);
      return res.status(400).json({
        success: false,
        error: result.error || 'Unknown error occurred during expiration check'
      });
    }
  } catch (error: any) {
    // Log detailed error information
    console.error('[API] Error checking listing expiration:', {
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 3).join('\n'),
      code: error.code,
      name: error.name
    });
    
    return res.status(500).json({ 
      success: false,
      error: 'Failed to check listing expiration',
      details: error.message,
      errorType: error.name || 'UnknownError'
    });
  }
}