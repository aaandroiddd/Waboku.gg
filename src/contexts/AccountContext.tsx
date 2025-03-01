import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { AccountTier, ACCOUNT_TIERS, AccountFeatures, SubscriptionDetails } from '@/types/account';
import { getFirestore, doc, onSnapshot, setDoc, updateDoc, getDoc } from 'firebase/firestore';
import { getFirebaseServices } from '@/lib/firebase';

interface AccountContextType {
  accountTier: AccountTier;
  features: AccountFeatures;
  isLoading: boolean;
  subscription: SubscriptionDetails;
  upgradeToPremium: () => Promise<void>;
  cancelSubscription: () => Promise<void>;
}

const defaultSubscription: SubscriptionDetails = {
  status: 'none',
  stripeSubscriptionId: undefined,
  startDate: undefined,
  endDate: undefined,
  renewalDate: undefined
};

const defaultContext: AccountContextType = {
  accountTier: 'free',
  features: ACCOUNT_TIERS['free'],
  isLoading: true,
  subscription: defaultSubscription,
  upgradeToPremium: async () => {
    throw new Error('Context not initialized');
  },
  cancelSubscription: async () => {
    throw new Error('Context not initialized');
  },
};

const AccountContext = createContext<AccountContextType>(defaultContext);

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [accountTier, setAccountTier] = useState<AccountTier>('free');
  const [isLoading, setIsLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionDetails>(defaultSubscription);

  useEffect(() => {
    let isMounted = true;

    const checkSubscriptionStatus = async () => {
      if (!user) return null;
      
      try {
        const idToken = await user.getIdToken();
        const response = await fetch('/api/stripe/check-subscription', {
          headers: {
            'Authorization': `Bearer ${idToken}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to check subscription status');
        }

        return await response.json();
      } catch (error) {
        console.error('Error checking subscription status:', error);
        return null;
      }
    };

    const initializeAccount = async () => {
      if (!user) {
        if (isMounted) {
          setAccountTier('free');
          setSubscription(defaultSubscription);
          setIsLoading(false);
        }
        return;
      }

      try {
        const { app } = getFirebaseServices();
        const firestore = getFirestore(app);
        const userDocRef = doc(firestore, 'users', user.uid);

        // Initialize account for new users
        const docSnapshot = await getDoc(userDocRef);
        if (!docSnapshot.exists()) {
          // Set default values for new users
          await setDoc(userDocRef, {
            accountTier: 'free',
            subscription: {
              status: 'none',
              startDate: new Date().toISOString()
            },
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }

        // Set up listener for Firestore document changes
        const unsubscribe = onSnapshot(userDocRef, async (doc) => {
          if (!isMounted) return;

          const data = doc.data();
          if (data) {
            // Check subscription status
            const subscriptionStatus = await checkSubscriptionStatus();
            
            // Get subscription data
            const subscriptionData = subscriptionStatus || data.subscription || defaultSubscription;
            
            // Determine account status based on subscription
            const now = new Date();
            const endDate = subscriptionData.endDate ? new Date(subscriptionData.endDate) : null;
            const startDate = subscriptionData.startDate ? new Date(subscriptionData.startDate) : null;
            
            // Enhanced premium status check with better logging
            const isActivePremium = (
              // Stripe subscription checks
              subscriptionData.status === 'active' ||
              (subscriptionData.status === 'canceled' && endDate && endDate > now) ||
              (subscriptionData.stripeSubscriptionId && startDate && startDate <= now && !subscriptionData.status) ||
              
              // Admin-set premium status checks
              (data.accountTier === 'premium' && subscriptionData.manuallyUpdated) ||
              (subscriptionData.currentPlan === 'premium') || // Check for currentPlan set by admin
              (subscriptionData.stripeSubscriptionId?.includes('admin_')) || // Check for admin-assigned subscription ID
              
              // Direct Firestore premium tier check
              (data.accountTier === 'premium' && data.subscription?.manuallyUpdated === true)
            );
            
            console.log('Account tier determination:', {
              uid: user.uid,
              email: user.email,
              currentTier: data.accountTier,
              calculatedTier: isActivePremium ? 'premium' : 'free',
              subscriptionStatus: subscriptionData.status,
              hasStripeId: !!subscriptionData.stripeSubscriptionId,
              isManuallyUpdated: !!subscriptionData.manuallyUpdated,
              currentPlan: subscriptionData.currentPlan
            });
            
            // Set subscription data with enhanced validation
            const currentStatus = (() => {
              if (subscriptionData.status === 'active') return 'active';
              if (subscriptionData.status === 'canceled' && endDate && endDate > now) return 'canceled';
              if (subscriptionData.stripeSubscriptionId && !subscriptionData.status) return 'active';
              return 'none';
            })();

            // For admin-assigned subscriptions, ensure we have a renewal date
            let renewalDate = subscriptionData.renewalDate;
            if (subscriptionData.stripeSubscriptionId?.includes('admin_') && !renewalDate) {
              const endDate = new Date();
              endDate.setFullYear(endDate.getFullYear() + 1); // Set end date to 1 year from now
              renewalDate = endDate.toISOString();
            }

            const subscriptionDetails = {
              startDate: subscriptionData.startDate,
              endDate: subscriptionData.endDate,
              renewalDate: renewalDate,
              status: currentStatus,
              stripeSubscriptionId: subscriptionData.stripeSubscriptionId
            };
            
            setSubscription(subscriptionDetails);
            setAccountTier(isActivePremium ? 'premium' : 'free');

            // Update the database if needed
            if (data.accountTier !== (isActivePremium ? 'premium' : 'free')) {
              await updateDoc(userDocRef, {
                accountTier: isActivePremium ? 'premium' : 'free',
                updatedAt: new Date()
              });
            }
          } else {
            setAccountTier('free');
            setSubscription(defaultSubscription);
          }
          setIsLoading(false);
        }, (error) => {
          console.error('Error loading account tier:', error);
          if (isMounted) {
            setAccountTier('free');
            setSubscription(defaultSubscription);
            setIsLoading(false);
          }
        });

        return () => {
          unsubscribe();
        };
      } catch (error) {
        console.error('Error initializing account:', error);
        if (isMounted) {
          setAccountTier('free');
          setSubscription(defaultSubscription);
          setIsLoading(false);
        }
      }
    };

    initializeAccount();

    return () => {
      isMounted = false;
    };
  }, [user]);

  const upgradeToPremium = async () => {
    if (!user) throw new Error('Must be logged in to upgrade');

    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create checkout session');
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (error) {
      console.error('Error upgrading account:', error);
      throw error;
    }
  };

  const cancelSubscription = async () => {
    if (!user) throw new Error('Must be logged in to cancel subscription');
    
    if (!subscription) {
      throw new Error('No subscription information available');
    }

    if (subscription.status === 'canceled') {
      throw new Error('Subscription is already canceled');
    }

    if (!subscription.stripeSubscriptionId) {
      throw new Error('No active subscription ID found. Please contact support.');
    }

    try {
      console.log('Initiating subscription cancellation:', {
        subscriptionId: subscription.stripeSubscriptionId,
        userId: user.uid,
        currentStatus: subscription.status,
        environment: process.env.NEXT_PUBLIC_CO_DEV_ENV || 'production'
      });
      
      // Special handling for preview environment
      if (process.env.NEXT_PUBLIC_CO_DEV_ENV === 'preview') {
        console.log('Preview environment detected, using direct database update');
        
        // For preview environment, we'll update the local state directly
        // The actual database update will be handled in the account-status.tsx page
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 30); // 30 days from now
        
        setSubscription(prev => ({
          ...prev,
          status: 'canceled',
          endDate: endDate.toISOString(),
          renewalDate: endDate.toISOString()
        }));
        
        return {
          success: true,
          message: 'Subscription will be canceled at the end of the billing period',
          endDate: endDate.toISOString(),
          status: 'canceled',
          isPreview: true
        };
      }
      
      // Production flow
      const idToken = await user.getIdToken(true); // Force token refresh
      const response = await fetch('/api/stripe/cancel-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          subscriptionId: subscription.stripeSubscriptionId,
          userId: user.uid
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error('Subscription cancellation API error:', data);
        throw new Error(data.message || data.error || 'Failed to cancel subscription');
      }

      console.log('Subscription cancellation successful:', data);
      
      // Update local state with the new subscription status
      setSubscription(prev => ({
        ...prev,
        status: 'canceled', // Explicitly set to 'canceled' instead of using data.status
        endDate: data.endDate,
        renewalDate: data.endDate // Set renewal date to end date for canceled subscriptions
      }));
      
      // If there was a database error but Stripe cancellation was successful
      if (data.databaseError) {
        console.warn('Subscription canceled in Stripe but database update failed:', data.databaseError);
        // We could show a warning to the user here if needed
      }

      // Force a reload to ensure all components reflect the updated subscription status
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
      }, 1500);

      return data;
    } catch (error: any) {
      console.error('Error canceling subscription:', error);
      throw error;
    }
  };

  const value = {
    accountTier,
    features: ACCOUNT_TIERS[accountTier],
    isLoading,
    subscription,
    upgradeToPremium,
    cancelSubscription,
  };

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount() {
  const context = useContext(AccountContext);
  if (context === undefined) {
    throw new Error('useAccount must be used within an AccountProvider');
  }
  return context;
}