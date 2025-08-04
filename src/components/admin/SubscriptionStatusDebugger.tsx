import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';

export function SubscriptionStatusDebugger() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [debugData, setDebugData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const debugSubscriptionStatus = async () => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to debug subscription status",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const idToken = await user.getIdToken(true);
      
      // Get data from multiple sources
      const [checkResponse, firestoreResponse, realtimeResponse] = await Promise.all([
        // Check subscription API
        fetch('/api/stripe/check-subscription', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json'
          }
        }),
        
        // Get Firestore data
        fetch('/api/debug/check-user-claims', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ userId: user.uid })
        }),
        
        // Get Realtime Database data
        fetch('/api/debug/test-database-write', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            action: 'read',
            path: `users/${user.uid}/account`
          })
        })
      ]);

      const checkData = checkResponse.ok ? await checkResponse.json() : { error: await checkResponse.text() };
      const firestoreData = firestoreResponse.ok ? await firestoreResponse.json() : { error: await firestoreResponse.text() };
      const realtimeData = realtimeResponse.ok ? await realtimeResponse.json() : { error: await realtimeResponse.text() };

      // Calculate current time and comparison
      const now = new Date();
      const endDate = checkData.renewalDate ? new Date(checkData.renewalDate) : null;
      const isWithinPaidPeriod = endDate ? endDate > now : false;

      setDebugData({
        userId: user.uid,
        userEmail: user.email,
        currentTime: now.toISOString(),
        checkSubscriptionAPI: checkData,
        firestoreData: firestoreData,
        realtimeData: realtimeData,
        calculations: {
          endDate: endDate?.toISOString() || 'No end date',
          isWithinPaidPeriod,
          timeUntilExpiry: endDate ? Math.round((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) + ' days' : 'N/A'
        }
      });

      toast({
        title: "Debug Complete",
        description: "Subscription status data retrieved successfully",
      });
    } catch (error: any) {
      console.error('Debug error:', error);
      toast({
        title: "Debug Error",
        description: error.message || "Failed to debug subscription status",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Subscription Status Debugger</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Debug subscription status discrepancies between history and account status display.
      </p>
      
      <Button 
        onClick={debugSubscriptionStatus}
        disabled={isLoading}
        className="mb-4"
      >
        {isLoading ? "Debugging..." : "Debug Subscription Status"}
      </Button>

      {debugData && (
        <div className="mt-4 space-y-4">
          <div className="bg-muted p-4 rounded-lg">
            <h4 className="font-semibold mb-2">User Info</h4>
            <pre className="text-xs overflow-auto">
              {JSON.stringify({
                userId: debugData.userId,
                email: debugData.userEmail,
                currentTime: debugData.currentTime
              }, null, 2)}
            </pre>
          </div>

          <div className="bg-muted p-4 rounded-lg">
            <h4 className="font-semibold mb-2">Check Subscription API Response</h4>
            <pre className="text-xs overflow-auto">
              {JSON.stringify(debugData.checkSubscriptionAPI, null, 2)}
            </pre>
          </div>

          <div className="bg-muted p-4 rounded-lg">
            <h4 className="font-semibold mb-2">Firestore Data</h4>
            <pre className="text-xs overflow-auto">
              {JSON.stringify(debugData.firestoreData, null, 2)}
            </pre>
          </div>

          <div className="bg-muted p-4 rounded-lg">
            <h4 className="font-semibold mb-2">Realtime Database Data</h4>
            <pre className="text-xs overflow-auto">
              {JSON.stringify(debugData.realtimeData, null, 2)}
            </pre>
          </div>

          <div className="bg-muted p-4 rounded-lg">
            <h4 className="font-semibold mb-2">Calculations</h4>
            <pre className="text-xs overflow-auto">
              {JSON.stringify(debugData.calculations, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </Card>
  );
}