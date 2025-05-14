import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { useRouter } from 'next/router';

interface AccountStatus {
  isConnected: boolean;
  isEnabled: boolean;
  needsMoreInfo: boolean;
  accountLink?: string;
}

export function useSellerAccount() {
  const [accountStatus, setAccountStatus] = useState<AccountStatus>({
    isConnected: false,
    isEnabled: false,
    needsMoreInfo: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  const fetchAccountStatus = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/stripe/connect/account-status');
      
      if (!response.ok) {
        throw new Error('Failed to fetch account status');
      }
      
      const data = await response.json();
      setAccountStatus({
        isConnected: !!data.accountId,
        isEnabled: data.payoutsEnabled || false,
        needsMoreInfo: data.detailsSubmitted ? !data.payoutsEnabled : true,
        accountLink: data.accountLink,
      });
    } catch (err) {
      console.error('Error fetching account status:', err);
      setError('Failed to load account status. Please try again later.');
      toast({
        title: 'Error',
        description: 'Failed to load account status. Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const createAccount = async () => {
    try {
      const response = await fetch('/api/stripe/connect/create-account', {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Failed to create account');
      }
      
      const data = await response.json();
      
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No redirect URL provided');
      }
    } catch (err) {
      console.error('Error creating account:', err);
      toast({
        title: 'Error',
        description: 'Failed to create seller account. Please try again later.',
        variant: 'destructive',
      });
      throw err;
    }
  };

  const updateAccount = async () => {
    try {
      const response = await fetch('/api/stripe/connect/update-account', {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Failed to update account');
      }
      
      const data = await response.json();
      
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No redirect URL provided');
      }
    } catch (err) {
      console.error('Error updating account:', err);
      toast({
        title: 'Error',
        description: 'Failed to update seller account. Please try again later.',
        variant: 'destructive',
      });
      throw err;
    }
  };

  useEffect(() => {
    fetchAccountStatus();
  }, [fetchAccountStatus]);

  return {
    accountStatus,
    isLoading,
    error,
    createAccount,
    updateAccount,
    refreshStatus: fetchAccountStatus,
  };
}