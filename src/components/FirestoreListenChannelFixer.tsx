import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Badge } from './ui/badge';
import { Loader2 } from 'lucide-react';
import { fixFirestoreListenChannel, clearFirestoreCaches } from '@/lib/firebase-connection-fix';

export function FirestoreListenChannelFixer() {
  const [isFixing, setIsFixing] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [fixResult, setFixResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const runListenChannelFix = async () => {
    setIsFixing(true);
    setFixResult(null);
    
    try {
      const result = await fixFirestoreListenChannel();
      setFixResult(result);
    } catch (error) {
      console.error('Error fixing Listen channel:', error);
      setFixResult({
        success: false,
        message: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setIsFixing(false);
    }
  };

  const clearCaches = async () => {
    setIsClearing(true);
    
    try {
      await clearFirestoreCaches();
      setFixResult({
        success: true,
        message: 'Firestore caches cleared successfully'
      });
    } catch (error) {
      console.error('Error clearing caches:', error);
      setFixResult({
        success: false,
        message: `Error clearing caches: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>Firestore Listen Channel Fixer</CardTitle>
        <CardDescription>
          Fix issues with Firestore Listen channel connections
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm">
            If you're seeing "Failed to fetch" errors related to Firestore Listen channels, this tool can help fix the issue.
            The Listen channel is used for real-time updates from Firestore.
          </p>
          
          <Alert>
            <AlertTitle>When to use this tool</AlertTitle>
            <AlertDescription>
              <ul className="list-disc list-inside text-sm space-y-1 ml-4">
                <li>You see "Failed to fetch" errors in the console</li>
                <li>The error URL contains "/Listen/channel"</li>
                <li>Real-time updates aren't working properly</li>
                <li>You're experiencing connection issues after returning from another tab</li>
              </ul>
            </AlertDescription>
          </Alert>
        </div>
        
        {fixResult && (
          <Alert variant={fixResult.success ? "default" : "destructive"}>
            <AlertTitle>
              {fixResult.success ? "Fix Successful" : "Fix Failed"}
            </AlertTitle>
            <AlertDescription>
              {fixResult.message}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button 
          onClick={runListenChannelFix} 
          disabled={isFixing || isClearing}
          className="flex items-center gap-2"
        >
          {isFixing && <Loader2 className="h-4 w-4 animate-spin" />}
          {isFixing ? 'Fixing Listen Channel...' : 'Fix Listen Channel'}
        </Button>
        <Button 
          onClick={clearCaches} 
          variant="outline"
          disabled={isFixing || isClearing}
          className="flex items-center gap-2"
        >
          {isClearing && <Loader2 className="h-4 w-4 animate-spin" />}
          {isClearing ? 'Clearing Caches...' : 'Clear Firestore Caches'}
        </Button>
      </CardFooter>
    </Card>
  );
}