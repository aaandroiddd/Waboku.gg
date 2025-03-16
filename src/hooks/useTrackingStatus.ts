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
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { user, getIdToken } = useAuth();

  const fetchTrackingStatus = async () => {
    if (!carrier || !trackingNumber || !user) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = await getIdToken();
      const response = await fetch(
        `/api/orders/tracking-status?carrier=${encodeURIComponent(carrier)}&trackingNumber=${encodeURIComponent(trackingNumber)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch tracking status');
      }

      const data = await response.json();
      setStatus(data);
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