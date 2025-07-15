import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useBlockingStatus } from '@/hooks/useBlockingStatus';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { useToast } from './ui/use-toast';

interface BlockingDebuggerProps {
  otherUserId: string;
  otherUsername: string;
}

export function BlockingDebugger({ otherUserId, otherUsername }: BlockingDebuggerProps) {
  const { user } = useAuth();
  const { isBlocked, isBlockedBy, isEitherBlocked, loading } = useBlockingStatus(otherUserId);
  const { toast } = useToast();
  const [isBlocking, setIsBlocking] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);

  const testBlockAPI = async () => {
    if (!user) return;
    
    setIsBlocking(true);
    setDebugInfo(null);
    
    try {
      console.log('Testing block API with:', { otherUserId, otherUsername });
      
      const response = await fetch('/api/users/block', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await user.getIdToken()}`
        },
        body: JSON.stringify({
          blockedUserId: otherUserId
        })
      });

      const responseText = await response.text();
      console.log('Block API response:', { status: response.status, text: responseText });
      
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = { rawResponse: responseText };
      }

      setDebugInfo({
        status: response.status,
        ok: response.ok,
        data: responseData,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (response.ok) {
        toast({
          title: "Block API Success",
          description: `Successfully called block API for ${otherUsername}`,
        });
      } else {
        toast({
          title: "Block API Error",
          description: `API returned ${response.status}: ${responseData.error || responseText}`,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Block API error:', error);
      setDebugInfo({
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      
      toast({
        title: "Block API Error",
        description: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
      });
    } finally {
      setIsBlocking(false);
    }
  };

  const testFirebaseConnection = async () => {
    try {
      console.log('Testing Firebase connection...');
      const response = await fetch('/api/test-block');
      const data = await response.json();
      
      console.log('Firebase test response:', data);
      
      toast({
        title: response.ok ? "Firebase Test Success" : "Firebase Test Failed",
        description: data.message || data.error || 'Unknown result',
        variant: response.ok ? "default" : "destructive"
      });
    } catch (error) {
      console.error('Firebase test error:', error);
      toast({
        title: "Firebase Test Error",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive"
      });
    }
  };

  if (!user) return null;

  return (
    <Card className="p-4 m-4 space-y-4">
      <h3 className="text-lg font-semibold">Blocking Debug Info</h3>
      
      <div className="space-y-2">
        <p><strong>Current User:</strong> {user.uid}</p>
        <p><strong>Other User:</strong> {otherUserId} ({otherUsername})</p>
        <p><strong>Loading:</strong> {loading ? 'Yes' : 'No'}</p>
        <p><strong>Is Blocked:</strong> {isBlocked ? 'Yes' : 'No'}</p>
        <p><strong>Is Blocked By:</strong> {isBlockedBy ? 'Yes' : 'No'}</p>
        <p><strong>Either Blocked:</strong> {isEitherBlocked ? 'Yes' : 'No'}</p>
      </div>

      <div className="flex gap-2">
        <Button 
          onClick={testBlockAPI} 
          disabled={isBlocking}
          variant="destructive"
        >
          {isBlocking ? 'Testing Block API...' : 'Test Block API'}
        </Button>
        
        <Button 
          onClick={testFirebaseConnection}
          variant="outline"
        >
          Test Firebase Connection
        </Button>
      </div>

      {debugInfo && (
        <div className="mt-4 p-3 bg-muted rounded">
          <h4 className="font-semibold mb-2">API Response Debug:</h4>
          <pre className="text-xs overflow-auto">
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        </div>
      )}
    </Card>
  );
}