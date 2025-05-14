import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface AccountStatus {
  isConnected: boolean;
  isEnabled: boolean;
  needsMoreInfo: boolean;
}

export function useSellerAccount() {
  const { user } = useAuth();
  const [accountStatus, setAccountStatus] = useState<AccountStatus>({
    isConnected: false,
    isEnabled: false,
    needsMoreInfo: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Function to fetch account status
  async function fetchAccountStatus() {
    if (!user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const token = await user.getIdToken(true);
      const response = await fetch('/api/stripe/connect/account-status', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch account status');
      }
      
      const data = await response.json();
      setAccountStatus({
        isConnected: !!data.accountId,
        isEnabled: data.payoutsEnabled || false,
        needsMoreInfo: data.detailsSubmitted ? !data.payoutsEnabled : true,
      });
    } catch (err) {
      console.error('Error fetching account status:', err);
      setError('Failed to load account status. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  }

  // Function to create a new account
  async function createAccount() {
    if (!user) return;
    
    try {
      const token = await user.getIdToken(true);
      const response = await fetch('/api/stripe/connect/create-account', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to create account');
      }
      
      const data = await response.json();
      
      if (data.url) {
        window.open(data.url, '_blank');
      } else {
        throw new Error('No redirect URL provided');
      }
    } catch (err) {
      console.error('Error creating account:', err);
      throw err;
    }
  }

  // Function to update an existing account
  async function updateAccount() {
    if (!user) return;
    
    try {
      const token = await user.getIdToken(true);
      const response = await fetch('/api/stripe/connect/update-account', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to update account');
      }
      
      const data = await response.json();
      
      if (data.url) {
        window.open(data.url, '_blank');
      } else {
        throw new Error('No redirect URL provided');
      }
    } catch (err) {
      console.error('Error updating account:', err);
      throw err;
    }
  }

  // Fetch account status on component mount
  useEffect(() => {
    fetchAccountStatus();
  }, [user]);

  return {
    accountStatus,
    isLoading,
    error,
    createAccount,
    updateAccount,
    refreshStatus: fetchAccountStatus,
  };
}