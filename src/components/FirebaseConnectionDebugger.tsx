import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Badge } from './ui/badge';
import { getDatabase, ref, set, onValue, DatabaseReference } from 'firebase/database';
import { getFirebaseServices } from '@/lib/firebase';

export function FirebaseConnectionDebugger() {
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [databaseUrl, setDatabaseUrl] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Array<{name: string, status: 'success' | 'error' | 'pending', message: string}>>([]);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [certificateStatus, setCertificateStatus] = useState<'unknown' | 'valid' | 'invalid'>('unknown');
  const [longPollingStatus, setLongPollingStatus] = useState<'unknown' | 'working' | 'failing'>('unknown');

  // Check initial connection status
  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    setConnectionStatus('checking');
    setErrorDetails(null);
    
    try {
      // Get Firebase services
      const { database } = getFirebaseServices();
      
      if (!database) {
        setConnectionStatus('disconnected');
        setErrorDetails('Firebase Realtime Database is not initialized');
        return;
      }
      
      // Get database URL
      const databaseRef = ref(database);
      const url = databaseRef.toString();
      setDatabaseUrl(url);
      
      // Check connection status
      const connectedRef = ref(database, '.info/connected');
      
      const unsubscribe = onValue(connectedRef, (snapshot) => {
        const connected = snapshot.val();
        setConnectionStatus(connected ? 'connected' : 'disconnected');
        if (!connected) {
          setErrorDetails('Not connected to Firebase Realtime Database');
        }
      }, (error) => {
        console.error('Error checking connection:', error);
        setConnectionStatus('disconnected');
        setErrorDetails(`Connection error: ${error.message}`);
      });
      
      // Cleanup
      return () => {
        unsubscribe();
      };
    } catch (error) {
      console.error('Error in connection check:', error);
      setConnectionStatus('disconnected');
      setErrorDetails(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const runConnectionTests = async () => {
    setIsRunningTests(true);
    setTestResults([]);
    
    // Reset test results
    setTestResults([
      { name: 'Database Initialization', status: 'pending', message: 'Checking database initialization...' },
      { name: 'Write Test', status: 'pending', message: 'Will test writing to database...' },
      { name: 'Read Test', status: 'pending', message: 'Will test reading from database...' },
      { name: 'Long Polling', status: 'pending', message: 'Will test long polling connection...' },
      { name: 'Certificate Validation', status: 'pending', message: 'Will check SSL certificate...' }
    ]);
    
    try {
      // Test 1: Database Initialization
      const { database } = getFirebaseServices();
      
      if (!database) {
        updateTestResult(0, 'error', 'Database initialization failed');
        setIsRunningTests(false);
        return;
      }
      
      updateTestResult(0, 'success', 'Database initialized successfully');
      
      // Test 2: Write Test
      try {
        const testRef = ref(database, 'connection_tests/test_' + Date.now());
        await set(testRef, {
          timestamp: Date.now(),
          message: 'Connection test'
        });
        updateTestResult(1, 'success', 'Successfully wrote to database');
      } catch (error) {
        console.error('Write test error:', error);
        updateTestResult(1, 'error', `Write test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
      // Test 3: Read Test
      try {
        const infoRef = ref(database, '.info/serverTimeOffset');
        const unsubscribe = onValue(infoRef, (snapshot) => {
          const offset = snapshot.val();
          updateTestResult(2, 'success', `Successfully read from database. Server time offset: ${offset}ms`);
          unsubscribe();
        }, (error) => {
          console.error('Read test error:', error);
          updateTestResult(2, 'error', `Read test failed: ${error.message}`);
        });
      } catch (error) {
        console.error('Read test setup error:', error);
        updateTestResult(2, 'error', `Read test setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
      // Test 4: Long Polling
      try {
        // Create a reference that will trigger a long polling connection
        const longPollRef = ref(database, '.info/connected');
        let longPollTimeout: NodeJS.Timeout;
        
        const unsubscribe = onValue(longPollRef, (snapshot) => {
          const connected = snapshot.val();
          if (connected) {
            updateTestResult(3, 'success', 'Long polling connection established successfully');
            setLongPollingStatus('working');
          } else {
            // Wait a bit before declaring failure, as initial connection might be false
            longPollTimeout = setTimeout(() => {
              if (connectionStatus !== 'connected') {
                updateTestResult(3, 'error', 'Long polling connection failed to establish');
                setLongPollingStatus('failing');
              }
            }, 5000);
          }
          
          // Cleanup after a short time
          setTimeout(() => {
            unsubscribe();
          }, 10000);
        }, (error) => {
          console.error('Long polling test error:', error);
          updateTestResult(3, 'error', `Long polling test failed: ${error.message}`);
          setLongPollingStatus('failing');
        });
        
        // Cleanup
        return () => {
          unsubscribe();
          if (longPollTimeout) clearTimeout(longPollTimeout);
        };
      } catch (error) {
        console.error('Long polling test setup error:', error);
        updateTestResult(3, 'error', `Long polling test setup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setLongPollingStatus('failing');
      }
      
      // Test 5: Certificate Validation
      try {
        // Extract hostname from database URL
        if (databaseUrl) {
          const url = new URL(databaseUrl);
          const hostname = url.hostname;
          
          // Use fetch to check certificate
          const response = await fetch(`https://${hostname}/.well-known/assetlinks.json`, {
            method: 'HEAD',
          }).catch(error => {
            throw new Error(`Certificate validation failed: ${error.message}`);
          });
          
          if (response.ok || response.status === 404) {
            // 404 is fine, we just want to check if the SSL handshake works
            updateTestResult(4, 'success', 'SSL certificate is valid');
            setCertificateStatus('valid');
          } else {
            updateTestResult(4, 'error', `Certificate validation failed with status: ${response.status}`);
            setCertificateStatus('invalid');
          }
        } else {
          updateTestResult(4, 'error', 'Cannot validate certificate: Database URL is unknown');
          setCertificateStatus('unknown');
        }
      } catch (error) {
        console.error('Certificate validation error:', error);
        updateTestResult(4, 'error', `Certificate validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setCertificateStatus('invalid');
      }
      
    } catch (error) {
      console.error('Error running tests:', error);
    } finally {
      setIsRunningTests(false);
    }
  };

  const updateTestResult = (index: number, status: 'success' | 'error' | 'pending', message: string) => {
    setTestResults(prev => {
      const newResults = [...prev];
      if (newResults[index]) {
        newResults[index] = { ...newResults[index], status, message };
      }
      return newResults;
    });
  };

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Firebase Connection Diagnostics
          <Badge
            variant={connectionStatus === 'connected' ? 'default' : connectionStatus === 'checking' ? 'outline' : 'destructive'}
          >
            {connectionStatus === 'connected' ? 'Connected' : connectionStatus === 'checking' ? 'Checking...' : 'Disconnected'}
          </Badge>
        </CardTitle>
        <CardDescription>
          Diagnose issues with Firebase Realtime Database connections
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {errorDetails && (
          <Alert variant="destructive">
            <AlertTitle>Connection Error</AlertTitle>
            <AlertDescription>{errorDetails}</AlertDescription>
          </Alert>
        )}
        
        {databaseUrl && (
          <div className="text-sm">
            <p className="font-medium">Database URL:</p>
            <code className="bg-muted p-2 rounded block mt-1 overflow-x-auto">{databaseUrl}</code>
          </div>
        )}
        
        {testResults.length > 0 && (
          <div className="space-y-3 mt-4">
            <h3 className="text-lg font-medium">Test Results</h3>
            {testResults.map((test, index) => (
              <div key={index} className="border rounded-md p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{test.name}</span>
                  <Badge
                    variant={test.status === 'success' ? 'default' : test.status === 'pending' ? 'outline' : 'destructive'}
                  >
                    {test.status === 'success' ? 'Success' : test.status === 'pending' ? 'Pending' : 'Failed'}
                  </Badge>
                </div>
                <p className="text-sm mt-1">{test.message}</p>
              </div>
            ))}
          </div>
        )}
        
        {certificateStatus !== 'unknown' && (
          <Alert variant={certificateStatus === 'valid' ? 'default' : 'destructive'}>
            <AlertTitle>SSL Certificate Status</AlertTitle>
            <AlertDescription>
              {certificateStatus === 'valid' 
                ? 'The SSL certificate for the Firebase database is valid.' 
                : 'There appears to be an issue with the SSL certificate for the Firebase database.'}
            </AlertDescription>
          </Alert>
        )}
        
        {longPollingStatus !== 'unknown' && (
          <Alert variant={longPollingStatus === 'working' ? 'default' : 'destructive'}>
            <AlertTitle>Long Polling Status</AlertTitle>
            <AlertDescription>
              {longPollingStatus === 'working' 
                ? 'Long polling connections are working correctly.' 
                : 'There appears to be an issue with long polling connections to Firebase.'}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button onClick={checkConnection} variant="outline" disabled={isRunningTests}>
          Check Connection
        </Button>
        <Button onClick={runConnectionTests} disabled={isRunningTests}>
          {isRunningTests ? 'Running Tests...' : 'Run Diagnostic Tests'}
        </Button>
      </CardFooter>
    </Card>
  );
}