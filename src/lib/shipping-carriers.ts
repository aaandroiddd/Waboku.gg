import axios from 'axios';

// Define the common tracking status interface
export interface TrackingStatus {
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

// Normalized status mapping to ensure consistent status values across carriers
const normalizeStatus = (carrierStatus: string, carrier: string): string => {
  const lowercaseStatus = carrierStatus.toLowerCase();
  
  // USPS status normalization
  if (carrier === 'usps') {
    if (lowercaseStatus.includes('delivered')) return 'delivered';
    if (lowercaseStatus.includes('out for delivery')) return 'out_for_delivery';
    if (lowercaseStatus.includes('in transit')) return 'in_transit';
    if (lowercaseStatus.includes('pre-shipment') || lowercaseStatus.includes('shipping label created')) return 'pending';
    return 'in_transit';
  }
  
  // FedEx status normalization
  if (carrier === 'fedex') {
    if (lowercaseStatus.includes('delivered')) return 'delivered';
    if (lowercaseStatus.includes('out for delivery')) return 'out_for_delivery';
    if (lowercaseStatus.includes('in transit')) return 'in_transit';
    if (lowercaseStatus.includes('label created') || lowercaseStatus.includes('shipment information sent')) return 'pending';
    return 'in_transit';
  }
  
  // UPS status normalization
  if (carrier === 'ups') {
    if (lowercaseStatus.includes('delivered')) return 'delivered';
    if (lowercaseStatus.includes('out for delivery')) return 'out_for_delivery';
    if (lowercaseStatus.includes('in transit')) return 'in_transit';
    if (lowercaseStatus.includes('order processed') || lowercaseStatus.includes('label created')) return 'pending';
    return 'in_transit';
  }
  
  // DHL status normalization
  if (carrier === 'dhl') {
    if (lowercaseStatus.includes('delivered')) return 'delivered';
    if (lowercaseStatus.includes('out for delivery')) return 'out_for_delivery';
    if (lowercaseStatus.includes('in transit') || lowercaseStatus.includes('shipment in transit')) return 'in_transit';
    if (lowercaseStatus.includes('shipment information received')) return 'pending';
    return 'in_transit';
  }
  
  // Default fallback
  if (lowercaseStatus.includes('delivered')) return 'delivered';
  if (lowercaseStatus.includes('out for delivery')) return 'out_for_delivery';
  if (lowercaseStatus.includes('in transit')) return 'in_transit';
  if (lowercaseStatus.includes('label') || lowercaseStatus.includes('created') || lowercaseStatus.includes('pending')) return 'pending';
  
  return 'in_transit';
};

// Base carrier API class
abstract class CarrierAPI {
  protected apiKey: string;
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }
  
  abstract getTrackingInfo(trackingNumber: string): Promise<TrackingStatus>;
}

// USPS API implementation
export class USPSCarrierAPI extends CarrierAPI {
  private readonly baseUrl = 'https://secure.shippingapis.com/ShippingAPI.dll';
  
  constructor(apiKey: string) {
    super(apiKey);
  }
  
  async getTrackingInfo(trackingNumber: string): Promise<TrackingStatus> {
    try {
      // USPS uses XML for their API
      const xmlRequest = `
        <TrackFieldRequest USERID="${this.apiKey}">
          <TrackID ID="${trackingNumber}"></TrackID>
        </TrackFieldRequest>
      `;
      
      const response = await axios.get(this.baseUrl, {
        params: {
          API: 'TrackV2',
          XML: xmlRequest
        }
      });
      
      // Parse XML response - in a real implementation, you would use an XML parser
      // This is a simplified example
      
      // For now, we'll return a placeholder response
      // In production, you would parse the XML and map it to the TrackingStatus interface
      
      return {
        carrier: 'usps',
        trackingNumber,
        status: 'in_transit', // This would come from the parsed response
        statusDescription: 'Package is in transit to the destination',
        estimatedDelivery: new Date(Date.now() + 86400000 * 2).toISOString(), // +2 days
        lastUpdate: new Date().toISOString(),
        location: 'USPS Facility',
        events: [
          {
            timestamp: new Date().toISOString(),
            description: 'Package in transit',
            location: 'USPS Facility'
          }
        ]
      };
    } catch (error) {
      console.error('Error fetching USPS tracking:', error);
      throw new Error(`Failed to fetch USPS tracking: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// FedEx API implementation
export class FedExCarrierAPI extends CarrierAPI {
  private readonly baseUrl = 'https://apis.fedex.com/track/v1/trackingnumbers';
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  
  constructor(apiKey: string, private readonly apiSecret: string) {
    super(apiKey);
  }
  
  private async getAccessToken(): Promise<string> {
    // Check if we have a valid token
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }
    
    try {
      // Get a new token
      const response = await axios.post('https://apis.fedex.com/oauth/token', {
        grant_type: 'client_credentials',
        client_id: this.apiKey,
        client_secret: this.apiSecret
      });
      
      this.accessToken = response.data.access_token;
      // Set expiry to 5 minutes before actual expiry to be safe
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 300000;
      
      return this.accessToken;
    } catch (error) {
      console.error('Error getting FedEx access token:', error);
      throw new Error(`Failed to get FedEx access token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  async getTrackingInfo(trackingNumber: string): Promise<TrackingStatus> {
    try {
      const token = await this.getAccessToken();
      
      const response = await axios.post(this.baseUrl, {
        trackingInfo: [
          {
            trackingNumberInfo: {
              trackingNumber
            }
          }
        ],
        includeDetailedScans: true
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      // Parse the response and map to our TrackingStatus interface
      // This is a simplified example
      
      return {
        carrier: 'fedex',
        trackingNumber,
        status: 'in_transit', // This would come from the parsed response
        statusDescription: 'Package is in transit to the destination',
        estimatedDelivery: new Date(Date.now() + 86400000 * 2).toISOString(), // +2 days
        lastUpdate: new Date().toISOString(),
        location: 'FedEx Facility',
        events: [
          {
            timestamp: new Date().toISOString(),
            description: 'Package in transit',
            location: 'FedEx Facility'
          }
        ]
      };
    } catch (error) {
      console.error('Error fetching FedEx tracking:', error);
      throw new Error(`Failed to fetch FedEx tracking: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// UPS API implementation
export class UPSCarrierAPI extends CarrierAPI {
  private readonly baseUrl = 'https://onlinetools.ups.com/track/v1/details/';
  
  constructor(apiKey: string) {
    super(apiKey);
  }
  
  async getTrackingInfo(trackingNumber: string): Promise<TrackingStatus> {
    try {
      const response = await axios.get(`${this.baseUrl}${trackingNumber}`, {
        headers: {
          'AccessLicenseNumber': this.apiKey,
          'Content-Type': 'application/json'
        }
      });
      
      // Parse the response and map to our TrackingStatus interface
      // This is a simplified example
      
      return {
        carrier: 'ups',
        trackingNumber,
        status: 'in_transit', // This would come from the parsed response
        statusDescription: 'Package is in transit to the destination',
        estimatedDelivery: new Date(Date.now() + 86400000 * 2).toISOString(), // +2 days
        lastUpdate: new Date().toISOString(),
        location: 'UPS Facility',
        events: [
          {
            timestamp: new Date().toISOString(),
            description: 'Package in transit',
            location: 'UPS Facility'
          }
        ]
      };
    } catch (error) {
      console.error('Error fetching UPS tracking:', error);
      throw new Error(`Failed to fetch UPS tracking: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// DHL API implementation
export class DHLCarrierAPI extends CarrierAPI {
  private readonly baseUrl = 'https://api-eu.dhl.com/track/shipments';
  
  constructor(apiKey: string) {
    super(apiKey);
  }
  
  async getTrackingInfo(trackingNumber: string): Promise<TrackingStatus> {
    try {
      const response = await axios.get(this.baseUrl, {
        params: {
          trackingNumber
        },
        headers: {
          'DHL-API-Key': this.apiKey
        }
      });
      
      // Parse the response and map to our TrackingStatus interface
      // This is a simplified example
      
      return {
        carrier: 'dhl',
        trackingNumber,
        status: 'in_transit', // This would come from the parsed response
        statusDescription: 'Package is in transit to the destination',
        estimatedDelivery: new Date(Date.now() + 86400000 * 2).toISOString(), // +2 days
        lastUpdate: new Date().toISOString(),
        location: 'DHL Facility',
        events: [
          {
            timestamp: new Date().toISOString(),
            description: 'Package in transit',
            location: 'DHL Facility'
          }
        ]
      };
    } catch (error) {
      console.error('Error fetching DHL tracking:', error);
      throw new Error(`Failed to fetch DHL tracking: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Shippo API implementation (multi-carrier API service)
export class ShippoCarrierAPI extends CarrierAPI {
  private readonly baseUrl = 'https://api.goshippo.com/tracks/';
  
  constructor(apiKey: string) {
    super(apiKey);
  }
  
  async getTrackingInfo(trackingNumber: string, carrier: string): Promise<TrackingStatus> {
    try {
      const response = await axios.get(`${this.baseUrl}${carrier}/${trackingNumber}`, {
        headers: {
          'Authorization': `ShippoToken ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = response.data;
      
      // Map Shippo response to our TrackingStatus interface
      const status = normalizeStatus(data.tracking_status.status, carrier);
      
      const events = data.tracking_history.map((event: any) => ({
        timestamp: new Date(event.status_date).toISOString(),
        description: event.status.description,
        location: event.location.city ? `${event.location.city}, ${event.location.state}` : undefined
      }));
      
      return {
        carrier,
        trackingNumber,
        status,
        statusDescription: data.tracking_status.status_description,
        estimatedDelivery: data.eta ? new Date(data.eta).toISOString() : undefined,
        lastUpdate: events.length > 0 ? events[0].timestamp : undefined,
        location: events.length > 0 ? events[0].location : undefined,
        events
      };
    } catch (error) {
      console.error(`Error fetching ${carrier} tracking via Shippo:`, error);
      throw new Error(`Failed to fetch ${carrier} tracking: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Factory function to get the appropriate carrier API
export function getCarrierAPI(carrier: string): CarrierAPI | null {
  const normalizedCarrier = carrier.toLowerCase();
  
  // In a real implementation, these API keys would come from environment variables
  switch (normalizedCarrier) {
    case 'usps':
      return new USPSCarrierAPI(process.env.USPS_API_KEY || '');
    case 'fedex':
      return new FedExCarrierAPI(
        process.env.FEDEX_API_KEY || '',
        process.env.FEDEX_API_SECRET || ''
      );
    case 'ups':
      return new UPSCarrierAPI(process.env.UPS_API_KEY || '');
    case 'dhl':
      return new DHLCarrierAPI(process.env.DHL_API_KEY || '');
    default:
      return null;
  }
}

// Shippo multi-carrier API (alternative approach)
export function getShippoAPI(): ShippoCarrierAPI | null {
  if (process.env.SHIPPO_API_KEY) {
    return new ShippoCarrierAPI(process.env.SHIPPO_API_KEY);
  }
  return null;
}

// Function to get tracking info from any supported carrier
export async function getTrackingInfo(carrier: string, trackingNumber: string): Promise<TrackingStatus> {
  console.log(`Fetching tracking info for ${carrier} tracking number: ${trackingNumber}`);
  
  try {
    // First try using Shippo (multi-carrier API) if available
    const shippoAPI = getShippoAPI();
    if (shippoAPI) {
      try {
        return await shippoAPI.getTrackingInfo(trackingNumber, carrier);
      } catch (shippoError) {
        console.warn(`Shippo API failed, falling back to direct carrier API: ${shippoError}`);
        // Fall through to carrier-specific API
      }
    }
    
    // Try carrier-specific API
    const carrierAPI = getCarrierAPI(carrier);
    if (carrierAPI) {
      return await carrierAPI.getTrackingInfo(trackingNumber);
    }
    
    // If no API is available, return a mock response
    console.warn(`No API available for carrier: ${carrier}, using mock data`);
    return getMockTrackingStatus(carrier, trackingNumber);
  } catch (error) {
    console.error(`Error getting tracking info for ${carrier}:`, error);
    
    // Return an error status
    return {
      carrier,
      trackingNumber,
      status: 'error',
      statusDescription: 'Unable to retrieve tracking information',
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

// Mock function for fallback when APIs are not available
function getMockTrackingStatus(carrier: string, trackingNumber: string): TrackingStatus {
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
    carrier,
    trackingNumber,
    status: randomStatus,
    statusDescription,
    estimatedDelivery: tomorrow.toISOString(),
    lastUpdate: events[0].timestamp,
    location: events[0].location,
    events
  };
}