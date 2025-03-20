import { NextApiRequest, NextApiResponse } from 'next';
import { getTrackingInfo, TrackingStatus } from '@/lib/shipping-carriers';
import NodeCache from 'node-cache';
import { initializeFirebaseAdmin } from '@/lib/firebase-admin';

// Create a cache for tracking results to avoid excessive API calls
// Cache results for 1 hour (3600 seconds)
const trackingCache = new NodeCache({ stdTTL: 3600 });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Initialize Firebase Admin - this is now optional for tracking
    try {
      initializeFirebaseAdmin();
      console.log('Firebase Admin initialized successfully for tracking API');
    } catch (firebaseError) {
      console.warn('Firebase Admin initialization failed, but continuing with tracking request:', 
        firebaseError instanceof Error ? firebaseError.message : 'Unknown error');
      // We'll continue without Firebase authentication for tracking requests
    }
    
    // Authentication is now optional for tracking requests
    // We'll check for auth token but proceed without it if not present
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split('Bearer ')[1];
      if (token && token !== 'null' && token !== 'undefined') {
        try {
          // Verify the token if provided, but don't block if verification fails
          const { auth } = initializeFirebaseAdmin();
          await auth().verifyIdToken(token);
          console.log('User authenticated for tracking request');
        } catch (authError) {
          console.warn('Authentication failed, but continuing with tracking request:', 
            authError instanceof Error ? authError.message : 'Unknown error');
        }
      }
    } else {
      console.log('No authentication provided for tracking request - proceeding as public request');
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
    
    // Verify Shippo API key is available
    if (!process.env.SHIPPO_API_KEY) {
      console.warn('SHIPPO_API_KEY is not configured. Using mock tracking data.');
      
      // Return mock data with a warning
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
        error: 'Shippo API key is not configured. Using demo data.'
      };
      
      return res.status(200).json(mockStatus);
    }
    
    // Log the Shippo API key (partially masked for security)
    const apiKey = process.env.SHIPPO_API_KEY;
    console.log(`Using Shippo API key: ${apiKey.substring(0, 5)}...${apiKey.substring(apiKey.length - 4)}`);
    
    // Get real-time tracking information from carrier APIs
    console.log(`Fetching live tracking info for ${carrierStr} ${trackingNumberStr}`);
    try {
      const trackingStatus = await getTrackingInfo(carrierStr, trackingNumberStr);
      
      // Log the result
      console.log(`Tracking status for ${carrierStr} ${trackingNumberStr}: ${trackingStatus.status}`);
      
      // Check if we got mock data despite having an API key
      if (trackingStatus.isMockData) {
        console.warn(`Received mock data despite having Shippo API key. Possible API error.`);
      }
      
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