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
    // Extract and validate the listing ID from the request body
    const { listingId } = req.body;
    
    if (!listingId) {
      console.warn('[API] Missing listing ID in request body');
      return res.status(400).json({ 
        success: false, 
        error: 'Listing ID is required',
        code: 'missing_listing_id'
      });
    }
    
    // Validate that listingId is a string
    if (typeof listingId !== 'string') {
      console.warn('[API] Invalid listing ID type:', typeof listingId);
      return res.status(400).json({ 
        success: false, 
        error: 'Listing ID must be a string',
        code: 'invalid_listing_id_type'
      });
    }
    
    console.log(`[API] Checking expiration for listing: ${listingId}`);
    
    try {
      // Check and archive the listing if expired
      const result = await checkAndArchiveExpiredListing(listingId);
      
      // Return the result with appropriate status code
      if (result.success) {
        return res.status(200).json(result);
      } else {
        // Log the error but return a 200 status to prevent client-side errors
        // This is a background check that shouldn't disrupt the user experience
        console.error(`[API] Expiration check failed for listing ${listingId}:`, result.error);
        
        // Return a 200 status with error information
        // This prevents the client from showing network errors while still providing error details
        return res.status(200).json({
          success: false,
          handled: true,
          error: result.error || 'Unknown error occurred during expiration check',
          code: 'expiration_check_failed'
        });
      }
    } catch (checkError: any) {
      // Handle any unexpected errors from the check function
      console.error(`[API] Exception during expiration check for listing ${listingId}:`, {
        message: checkError.message,
        stack: checkError.stack?.split('\n').slice(0, 3).join('\n'),
        code: checkError.code,
        name: checkError.name
      });
      
      return res.status(200).json({
        success: false,
        handled: true,
        error: `Exception during expiration check: ${checkError.message || 'Unknown error'}`,
        errorType: checkError.name || 'UnknownError',
        code: 'expiration_check_exception'
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
    
    // Return a 200 status with error information to prevent client-side errors
    // Since this is a background check, we don't want to disrupt the user experience
    return res.status(200).json({ 
      success: false,
      handled: true,
      error: 'Failed to check listing expiration',
      details: error.message,
      errorType: error.name || 'UnknownError',
      code: 'expiration_check_exception'
    });
  }
}