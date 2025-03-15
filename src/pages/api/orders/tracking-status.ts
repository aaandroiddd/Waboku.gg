import { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from 'firebase-admin/auth';
import { getFirebaseServices } from '@/lib/firebase';

// Define the tracking status response type
interface TrackingStatus {
  carrier: string;
  trackingNumber: string;
  status: string;
  statusDescription: string;
  estimatedDelivery?: string;
  lastUpdate?: string;
  location?: string;
  events?: Array<{
    timestamp: string;
    description: string;
    location?: string;
  }>;
  error?: string;
}

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

    if (!carrier || !trackingNumber) {
      return res.status(400).json({ error: 'Missing required query parameters' });
    }

    // This is a placeholder for actual tracking API integration
    // In a real implementation, you would call the appropriate carrier API here
    
    // For now, return a mock response based on the carrier
    const mockTrackingStatus: TrackingStatus = await getMockTrackingStatus(
      carrier as string, 
      trackingNumber as string
    );

    return res.status(200).json(mockTrackingStatus);
  } catch (error) {
    console.error('Error fetching tracking status:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch tracking status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Mock function to simulate tracking status
// In a real implementation, this would be replaced with actual API calls to carriers
async function getMockTrackingStatus(carrier: string, trackingNumber: string): Promise<TrackingStatus> {
  // Log the request for debugging
  console.log(`Fetching tracking status for carrier: ${carrier}, tracking number: ${trackingNumber}`);
  
  const normalizedCarrier = carrier.toLowerCase();
  
  // Generate a random status for demonstration
  const statuses = ['in_transit', 'delivered', 'out_for_delivery', 'pending'];
  const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
  
  const currentDate = new Date();
  const yesterday = new Date(currentDate);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const tomorrow = new Date(currentDate);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  // Create mock events
  const events = [
    {
      timestamp: yesterday.toISOString(),
      description: 'Package processed at carrier facility',
      location: 'Sorting Center'
    }
  ];
  
  if (randomStatus === 'in_transit') {
    events.unshift({
      timestamp: currentDate.toISOString(),
      description: 'Package in transit to destination',
      location: 'In Transit'
    });
  } else if (randomStatus === 'out_for_delivery') {
    events.unshift({
      timestamp: currentDate.toISOString(),
      description: 'Out for delivery',
      location: 'Local Delivery Facility'
    });
  } else if (randomStatus === 'delivered') {
    events.unshift({
      timestamp: currentDate.toISOString(),
      description: 'Delivered',
      location: 'Destination'
    });
  }
  
  // Create status description based on status
  let statusDescription = '';
  switch (randomStatus) {
    case 'in_transit':
      statusDescription = 'Package is in transit to the destination';
      break;
    case 'delivered':
      statusDescription = 'Package has been delivered';
      break;
    case 'out_for_delivery':
      statusDescription = 'Package is out for delivery';
      break;
    case 'pending':
      statusDescription = 'Shipping label created, waiting for package';
      break;
  }
  
  return {
    carrier: carrier,
    trackingNumber: trackingNumber,
    status: randomStatus,
    statusDescription: statusDescription,
    estimatedDelivery: tomorrow.toISOString(),
    lastUpdate: events[0].timestamp,
    location: events[0].location,
    events: events
  };
}