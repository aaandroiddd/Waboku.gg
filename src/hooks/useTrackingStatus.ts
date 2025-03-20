import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface TrackingEvent {
  timestamp: string;
  description: string;
  location?: string;
}

export interface TrackingStatus {
  carrier: string;
  trackingNumber: string;
  status: string;
  statusDescription: string;
  estimatedDelivery?: string;
  lastUpdate?: string;
  location?: string;
  events?: TrackingEvent[];
  error?: string;
  isMockData?: boolean; // Flag to indicate if this is mock/demo data
}

export function useTrackingStatus(carrier: string, trackingNumber: string) {
  const [status, setStatus] = useState<TrackingStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true); // Start with loading true
  const [error, setError] = useState<string | null>(null);
  const { user, getIdToken } = useAuth();

  const fetchTrackingStatus = async () => {
    if (!carrier || !trackingNumber) {
      setError('Missing carrier or tracking number');
      setLoading(false);
      return;
    }

    if (!user) {
      setError('User authentication required');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get the authentication token
      let token;
      try {
        token = await getIdToken();
        if (!token) {
          throw new Error('Failed to get authentication token');
        }
      } catch (tokenError) {
        console.error('Error getting auth token:', tokenError);
        setError('Authentication error. Please try signing in again.');
        setLoading(false);
        return;
      }

      // Make the API request
      console.log(`Fetching tracking status for ${carrier} ${trackingNumber}`);
      const response = await fetch(
        `/api/orders/tracking-status?carrier=${encodeURIComponent(carrier)}&trackingNumber=${encodeURIComponent(trackingNumber)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      // Handle non-200 responses
      if (!response.ok) {
        let errorMessage = `Server error (${response.status})`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.details || errorMessage;
        } catch (parseError) {
          console.error('Error parsing error response:', parseError);
        }
        throw new Error(errorMessage);
      }

      // Parse the response
      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error('Error parsing response:', parseError);
        throw new Error('Invalid response from server');
      }

      // Check if the response contains an error
      if (data.error) {
        console.warn('API returned error in response body:', data.error);
        setError(data.error);
        // Still set the status if we have mock data
        if (data.isMockData) {
          setStatus(data);
        }
      } else {
        setStatus(data);
        setError(null);
      }
    } catch (err) {
      console.error('Error fetching tracking status:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (carrier && trackingNumber && user) {
      fetchTrackingStatus();
    }
  }, [carrier, trackingNumber, user]);

  return {
    status,
    loading,
    error,
    refetch: fetchTrackingStatus,
  };
}