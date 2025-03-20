import { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from 'firebase-admin/auth';
import { getFirebaseServices } from '@/lib/firebase';
import { getTrackingInfo, TrackingStatus } from '@/lib/shipping-carriers';
import NodeCache from 'node-cache';

// Create a cache for tracking results to avoid excessive API calls
// Cache results for 1 hour (3600 seconds)
const trackingCache = new NodeCache({ stdTTL: 3600 });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get the authorization token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('Missing or invalid authorization header');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split('Bearer ')[1];
    
    // Verify the token
    const { admin } = getFirebaseServices();
    let decodedToken;
    try {
      decodedToken = await getAuth().verifyIdToken(token);
    } catch (error) {
      console.error('Error verifying auth token:', error);
      return res.status(401).json({ error: 'Invalid authentication token' });
    }

    const { carrier, trackingNumber } = req.query;

    if (!trackingNumber) {
      console.error('Missing tracking number parameter');
      return res.status(400).json({ error: 'Missing tracking number parameter' });
    }

    const trackingNumberStr = trackingNumber as string;
    let carrierStr = (carrier as string) || 'auto-detect';
    
    console.log(`Processing tracking request for carrier: ${carrierStr}, tracking number: ${trackingNumberStr}`);
    
    // Check if we should bypass cache (for debugging or forced refresh)
    const bypassCache = req.query.refresh === 'true';
    
    // Create a cache key
    const cacheKey = `${carrierStr.toLowerCase()}_${trackingNumberStr}`;
    
    // Check if we have a cached result
    if (!bypassCache && trackingCache.has(cacheKey)) {
      console.log(`Using cached tracking info for ${carrierStr} ${trackingNumberStr}`);
      return res.status(200).json(trackingCache.get(cacheKey));
    }
    
    // Check if SHIPPO_API_KEY is configured
    if (!process.env.SHIPPO_API_KEY) {
      console.warn('SHIPPO_API_KEY is not configured. Using mock tracking data.');
    }
    
    // Get real-time tracking information from carrier APIs
    console.log(`Fetching live tracking info for ${carrierStr} ${trackingNumberStr}`);
    try {
      const trackingStatus = await getTrackingInfo(carrierStr, trackingNumberStr);
      
      // Log the result
      console.log(`Tracking status for ${carrierStr} ${trackingNumberStr}: ${trackingStatus.status}`);
      
      // Cache the result if it's not an error
      if (trackingStatus.status !== 'error') {
        trackingCache.set(cacheKey, trackingStatus);
        
        // For delivered packages, we can cache longer (1 week)
        if (trackingStatus.status === 'delivered') {
          trackingCache.ttl(cacheKey, 604800); // 7 days in seconds
        }
      }

      return res.status(200).json(trackingStatus);
    } catch (fetchError) {
      console.error('Error in getTrackingInfo:', fetchError);
      
      // Return a more user-friendly error with fallback to mock data
      const errorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown error occurred';
      console.error(`Tracking API error: ${errorMessage}`);
      
      // Return a mock tracking status with error information
      const mockStatus: TrackingStatus = {
        carrier: carrierStr,
        trackingNumber: trackingNumberStr,
        status: 'in_transit',
        statusDescription: '[DEMO DATA] Package is in transit to the destination',
        events: [
          {
            timestamp: new Date().toISOString(),
            description: 'Package in transit',
            location: 'Sorting Facility'
          }
        ],
        isMockData: true,
        error: `Could not fetch live tracking data: ${errorMessage}`
      };
      
      return res.status(200).json(mockStatus);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in tracking-status API:', errorMessage);
    
    if (error instanceof Error && error.stack) {
      console.error('Stack trace:', error.stack);
    }
    
    return res.status(500).json({ 
      error: 'Failed to fetch tracking status',
      details: errorMessage,
      isMockData: true
    });
  }
}