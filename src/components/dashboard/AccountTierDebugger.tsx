import { useAccount } from '@/contexts/AccountContext';
import { useAccountCache } from '@/hooks/useAccountCache';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';

/**
 * A component to help debug account tier issues
 * Only visible in development mode
 */
export function AccountTierDebugger() {
  const { accountTier, isLoading, subscription } = useAccount();
  const { getCachedAccountTier, refreshCache } = useAccountCache();
  const [showDebug, setShowDebug] = useState(false);
  
  // Only show in development mode
  if (process.env.NODE_ENV !== 'development' && !showDebug) {
    return (
      <div className="text-xs text-muted-foreground mt-4">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setShowDebug(true)}
          className="text-xs h-6 px-2"
        >
          Show Account Debug
        </Button>
      </div>
    );
  }
  
  const cachedTier = getCachedAccountTier();
  
  return (
    <Card className="mt-4 border-dashed border-yellow-500/50 bg-yellow-500/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          Account Tier Debug
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowDebug(false)}
            className="text-xs h-6 px-2"
          >
            Hide
          </Button>
        </CardTitle>
        <CardDescription className="text-xs">
          This information helps diagnose premium feature issues
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-2 text-xs space-y-2">
        <div className="grid grid-cols-2 gap-1">
          <div className="font-medium">Current Tier:</div>
          <div>
            {accountTier} 
            {accountTier === 'premium' && (
              <Badge variant="outline" className="ml-2 bg-yellow-500/20 text-yellow-500 border-yellow-500/20">
                ⭐ Premium
              </Badge>
            )}
          </div>
          
          <div className="font-medium">Cached Tier:</div>
          <div>{cachedTier || 'Not cached'}</div>
          
          <div className="font-medium">Loading:</div>
          <div>{isLoading ? 'Yes' : 'No'}</div>
          
          <div className="font-medium">Subscription Status:</div>
          <div>
            {subscription?.status || 'none'}
            {subscription?.status === 'canceled' && (
              <Badge variant="outline" className="ml-2 bg-orange-500/20 text-orange-500 border-orange-500/20">
                Canceled
              </Badge>
            )}
          </div>
          
          {subscription?.stripeSubscriptionId && (
            <>
              <div className="font-medium">Subscription ID:</div>
              <div className="truncate">{subscription.stripeSubscriptionId}</div>
            </>
          )}
          
          {subscription?.startDate && (
            <>
              <div className="font-medium">Start Date:</div>
              <div>{new Date(subscription.startDate).toLocaleDateString()}</div>
            </>
          )}
          
          {subscription?.renewalDate && (
            <>
              <div className="font-medium">Renewal Date:</div>
              <div>{new Date(subscription.renewalDate).toLocaleDateString()}</div>
            </>
          )}
          
          {subscription?.endDate && (
            <>
              <div className="font-medium">End Date:</div>
              <div>{new Date(subscription.endDate).toLocaleDateString()}</div>
            </>
          )}
          
          <div className="font-medium">Current Time:</div>
          <div>{new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</div>
          
          <div className="font-medium">Is Premium Active:</div>
          <div>
            {accountTier === 'premium' ? (
              <Badge variant="outline" className="bg-green-500/20 text-green-500 border-green-500/20">
                Yes
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-red-500/20 text-red-500 border-red-500/20">
                No
              </Badge>
            )}
          </div>
          
          <div className="font-medium">Is Canceled but Active:</div>
          <div>
            {subscription?.status === 'canceled' && accountTier === 'premium' ? (
              <Badge variant="outline" className="bg-amber-500/20 text-amber-500 border-amber-500/20">
                Yes - Active until end date
              </Badge>
            ) : (
              'No'
            )}
          </div>
        </div>
      </CardContent>
      <CardFooter className="pt-2">
        <Button 
          size="sm" 
          variant="outline" 
          className="text-xs w-full"
          onClick={() => {
            if (accountTier) {
              refreshCache(accountTier);
              window.location.reload();
            }
          }}
        >
          Refresh Cache & Reload
        </Button>
      </CardFooter>
    </Card>
  );
}