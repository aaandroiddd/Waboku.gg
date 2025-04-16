import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { database } from '@/lib/firebase';
import { ref, onValue, off, serverTimestamp, set, get } from 'firebase/database';

const DatabaseConnectionMonitor = () => {
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'unknown'>('unknown');
  const [lastActivity, setLastActivity] = useState<Date | null>(null);
  const [activeConnections, setActiveConnections] = useState<number | null>(null);
  const [isFixing, setIsFixing] = useState(false);
  const [fixAttempted, setFixAttempted] = useState(false);
  const [connectionLatency, setConnectionLatency] = useState<number | null>(null);

  // Monitor connection status
  useEffect(() => {
    const connectedRef = ref(database, '.info/connected');
    
    const unsubscribe = onValue(connectedRef, (snapshot) => {
      const connected = snapshot.val();
      setConnectionStatus(connected ? 'connected' : 'disconnected');
      
      if (connected) {
        setLastActivity(new Date());
      }
    });
    
    // Measure latency
    measureLatency();
    
    // Cleanup
    return () => {
      off(connectedRef);
    };
  }, []);

  // Measure database connection latency
  const measureLatency = async () => {
    try {
      const testRef = ref(database, '.info/serverTimeOffset');
      
      const startTime = Date.now();
      await get(testRef);
      const endTime = Date.now();
      
      setConnectionLatency(endTime - startTime);
    } catch (error) {
      console.error('Error measuring latency:', error);
    }
  };

  // Fix connection issues
  const fixConnectionIssues = async () => {
    setIsFixing(true);
    
    try {
      // 1. Force disconnect and reconnect
      await set(ref(database, '.info/connected'), null);
      
      // 2. Clear any cached data
      localStorage.removeItem('firebase:previous_websocket_failure');
      
      // 3. Wait a moment and check connection again
      setTimeout(async () => {
        await measureLatency();
        setFixAttempted(true);
        setIsFixing(false);
      }, 3000);
    } catch (error) {
      console.error('Error fixing connection:', error);
      setIsFixing(false);
    }
  };

  // Get connection status badge
  const getStatusBadge = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Badge className="bg-green-500">Connected</Badge>;
      case 'disconnected':
        return <Badge variant="destructive">Disconnected</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  // Get latency status
  const getLatencyStatus = () => {
    if (connectionLatency === null) return 'Unknown';
    
    if (connectionLatency < 100) {
      return 'Excellent';
    } else if (connectionLatency < 300) {
      return 'Good';
    } else if (connectionLatency < 1000) {
      return 'Fair';
    } else {
      return 'Poor';
    }
  };

  // Get latency color
  const getLatencyColor = () => {
    if (connectionLatency === null) return 'bg-gray-300';
    
    if (connectionLatency < 100) {
      return 'bg-green-500';
    } else if (connectionLatency < 300) {
      return 'bg-green-300';
    } else if (connectionLatency < 1000) {
      return 'bg-yellow-500';
    } else {
      return 'bg-red-500';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Database Connection Monitor</CardTitle>
        <CardDescription>
          Monitor and fix Firebase Realtime Database connection issues
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="font-medium">Connection Status:</span>
            {getStatusBadge()}
          </div>
          
          {lastActivity && (
            <div className="flex justify-between items-center">
              <span className="font-medium">Last Activity:</span>
              <span>{lastActivity.toLocaleString()}</span>
            </div>
          )}
          
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-medium">Connection Latency:</span>
              <span>{connectionLatency !== null ? `${connectionLatency}ms (${getLatencyStatus()})` : 'Unknown'}</span>
            </div>
            
            {connectionLatency !== null && (
              <Progress value={Math.min(100, (connectionLatency / 10))} className={getLatencyColor()} />
            )}
          </div>
          
          {connectionStatus === 'disconnected' && (
            <Alert variant="destructive">
              <AlertTitle>Connection Issue Detected</AlertTitle>
              <AlertDescription>
                Your application is currently disconnected from the Firebase Realtime Database.
                This may cause data synchronization issues and increased usage when reconnecting.
              </AlertDescription>
            </Alert>
          )}
          
          {connectionLatency !== null && connectionLatency > 500 && (
            <Alert>
              <AlertTitle>High Latency Detected</AlertTitle>
              <AlertDescription>
                Your connection to the Firebase Realtime Database has high latency ({connectionLatency}ms).
                This may result in slower data synchronization and potential timeout issues.
              </AlertDescription>
            </Alert>
          )}
          
          {fixAttempted && connectionStatus === 'connected' && (
            <Alert className="bg-green-50 border-green-200">
              <AlertTitle>Connection Fixed</AlertTitle>
              <AlertDescription>
                The connection to the Firebase Realtime Database has been successfully restored.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
      
      <CardFooter className="flex justify-between">
        <Button 
          variant="outline" 
          onClick={measureLatency}
        >
          Test Connection
        </Button>
        
        <Button 
          onClick={fixConnectionIssues}
          disabled={isFixing || connectionStatus === 'connected'}
        >
          {isFixing ? 'Fixing...' : 'Fix Connection Issues'}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default DatabaseConnectionMonitor;