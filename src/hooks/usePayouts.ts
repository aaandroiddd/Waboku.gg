import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { PayoutResponse } from '@/types/payout';

export function usePayouts() {
  const { user } = useAuth();
  const [payoutData, setPayoutData] = useState<PayoutResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPayouts = async () => {
    if (!user) {
      setIsLoading(false);
      setPayoutData(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const token = await user.getIdToken(true);
      
      const response = await fetch('/api/stripe/connect/payouts', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch payout data');
      }

      const data = await response.json();
      setPayoutData(data);
    } catch (err: any) {
      console.error('Error fetching payout data:', err);
      setError(err.message || 'Failed to fetch payout data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPayouts();
  }, [user]);

  const refreshPayouts = () => {
    fetchPayouts();
  };

  return {
    payoutData,
    isLoading,
    error,
    refreshPayouts,
  };
}