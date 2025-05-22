import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Badge } from './ui/badge';
import { fixFirebaseConnection, forceReconnectFirebase, fixFirestoreListenChannel } from '@/lib/firebase-connection-fix';
import { Loader2 } from 'lucide-react';

export function FirebaseConnectionFixer() {
  const [isFixing, setIsFixing] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isFixingListenChannel, setIsFixingListenChannel] = useState(false);
  const [fixResult, setFixResult] = useState<{
    success: boolean;
    message: string;
    details?: any;
  } | null>(null);
  const [reconnectResult, setReconnectResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [listenChannelResult, setListenChannelResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const runConnectionFix = async () => {
    setIsFixing(true);
    setFixResult(null);
    
    try {
      const result = await fixFirebaseConnection();
      setFixResult(result);
    } catch (error) {
      console.error('Error running connection fix:', error);
      setFixResult({
        success: false,
        message: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error }
      });
    } finally {
      setIsFixing(false);
    }
  };

  const runForceReconnect = async () => {
    setIsReconnecting(true);
    setReconnectResult(null);
    
    try {
      const result = await forceReconnectFirebase();
      setReconnectResult(result);
    } catch (error) {
      console.error('Error forcing reconnection:', error);
      setReconnectResult({
        success: false,
        message: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setIsReconnecting(false);
    }
  };
  
  const runListenChannelFix = async () => {
    setIsFixingListenChannel(true);
    setListenChannelResult(null);
    
    try {
      const result = await fixFirestoreListenChannel();
      setListenChannelResult(result);
    } catch (error) {
      console.error('Error fixing Listen channel:', error);
      setListenChannelResult({
        success: false,
        message: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setIsFixingListenChannel(false);
    }
  };

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>Firebase Connection Fixer</CardTitle>
        <CardDescription>
          Fix issues with Firebase Realtime Database connections
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm">
            If you're experiencing issues with Firebase connections, such as messages not loading or errors with long polling URLs, 
            you can try the following fixes:
          </p>
          
          <ul className="list-disc list-inside text-sm space-y-1 ml-4">
            <li>Run the connection diagnostics to identify specific issues</li>
            <li>Use the "Fix Connection" button to attempt automatic repairs</li>
            <li>Try the "Force Reconnect" option if messages still aren't loading</li>
            <li>Use "Fix Listen Channel" if you see "Failed to fetch" errors with "/Listen/channel" in the URL</li>
            <li>Refresh the page after applying fixes</li>
          </ul>
        </div>
        
        {fixResult && (
          <Alert variant={fixResult.success ? "default" : "destructive"}>
            <AlertTitle>
              {fixResult.success ? "Connection Fix Successful" : "Connection Fix Failed"}
            </AlertTitle>
            <AlertDescription className="space-y-2">
              <p>{fixResult.message}</p>
              {fixResult.details && (
                <pre className="bg-muted p-2 rounded text-xs overflow-x-auto mt-2">
                  {JSON.stringify(fixResult.details, null, 2)}
                </pre>
              )}
            </AlertDescription>
          </Alert>
        )}
        
        {reconnectResult && (
          <Alert variant={reconnectResult.success ? "default" : "destructive"}>
            <AlertTitle>
              {reconnectResult.success ? "Reconnection Successful" : "Reconnection Failed"}
            </AlertTitle>
            <AlertDescription>
              {reconnectResult.message}
            </AlertDescription>
          </Alert>
        )}
        
        {listenChannelResult && (
          <Alert variant={listenChannelResult.success ? "default" : "destructive"}>
            <AlertTitle>
              {listenChannelResult.success ? "Listen Channel Fix Successful" : "Listen Channel Fix Failed"}
            </AlertTitle>
            <AlertDescription>
              {listenChannelResult.message}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2 justify-between">
        <Button 
          onClick={runConnectionFix} 
          disabled={isFixing || isReconnecting || isFixingListenChannel}
          className="flex items-center gap-2"
        >
          {isFixing && <Loader2 className="h-4 w-4 animate-spin" />}
          {isFixing ? 'Fixing Connection...' : 'Fix Connection'}
        </Button>
        <Button 
          onClick={runForceReconnect} 
          variant="outline"
          disabled={isFixing || isReconnecting || isFixingListenChannel}
          className="flex items-center gap-2"
        >
          {isReconnecting && <Loader2 className="h-4 w-4 animate-spin" />}
          {isReconnecting ? 'Reconnecting...' : 'Force Reconnect'}
        </Button>
        <Button 
          onClick={runListenChannelFix} 
          variant="secondary"
          disabled={isFixing || isReconnecting || isFixingListenChannel}
          className="flex items-center gap-2"
        >
          {isFixingListenChannel && <Loader2 className="h-4 w-4 animate-spin" />}
          {isFixingListenChannel ? 'Fixing Listen Channel...' : 'Fix Listen Channel'}
        </Button>
      </CardFooter>
    </Card>
  );
}