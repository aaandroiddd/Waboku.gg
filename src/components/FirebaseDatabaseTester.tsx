import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Loader2, CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { getFirebaseServices } from '@/lib/firebase';

export function FirebaseDatabaseTester() {
  const [isLoading, setIsLoading] = useState(false);
  const [testResults, setTestResults] = useState<Array<{
    name: string;
    status: 'success' | 'error' | 'warning';
    message: string;
  }>>([]);
  const [overallStatus, setOverallStatus] = useState<'success' | 'error' | 'warning' | 'unknown'>('unknown');

  const runTests = async () => {
    setIsLoading(true);
    setTestResults([]);
    
    const results: Array<{
      name: string;
      status: 'success' | 'error' | 'warning';
      message: string;
    }> = [];
    
    try {
      // Test 1: Check if database URL is configured
      const databaseURL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
      if (!databaseURL) {
        results.push({
          name: 'Database URL Configuration',
          status: 'error',
          message: 'Firebase Realtime Database URL is missing in environment variables'
        });
      } else {
        results.push({
          name: 'Database URL Configuration',
          status: 'success',
          message: `Database URL is configured: ${databaseURL.substring(0, 8)}...`
        });
        
        // Test 2: Validate database URL format
        try {
          const parsedUrl = new URL(databaseURL);
          
          if (parsedUrl.protocol !== 'https:') {
            results.push({
              name: 'Database URL Format',
              status: 'error',
              message: 'Database URL must use HTTPS protocol'
            });
          } else if (!parsedUrl.hostname.includes('firebaseio.com')) {
            results.push({
              name: 'Database URL Format',
              status: 'error',
              message: 'Database URL hostname should contain firebaseio.com'
            });
          } else {
            results.push({
              name: 'Database URL Format',
              status: 'success',
              message: 'Database URL format is valid'
            });
          }
        } catch (urlError) {
          results.push({
            name: 'Database URL Format',
            status: 'error',
            message: `Invalid URL format: ${urlError instanceof Error ? urlError.message : 'Unknown error'}`
          });
        }
      }
      
      // Test 3: Check if database service is initialized
      const { database } = getFirebaseServices();
      if (!database) {
        results.push({
          name: 'Database Initialization',
          status: 'error',
          message: 'Firebase Realtime Database service is not initialized'
        });
      } else {
        results.push({
          name: 'Database Initialization',
          status: 'success',
          message: 'Firebase Realtime Database service is initialized'
        });
        
        // Test 4: Test database connection with server time offset
        try {
          const { ref, get } = await import('firebase/database');
          const timeRef = ref(database, '.info/serverTimeOffset');
          
          const timeSnapshot = await Promise.race([
            get(timeRef),
            new Promise<null>((_, reject) => 
              setTimeout(() => reject(new Error('Connection timeout')), 5000)
            )
          ]);
          
          if (timeSnapshot && timeSnapshot.exists()) {
            const offset = timeSnapshot.val();
            results.push({
              name: 'Database Connection',
              status: 'success',
              message: `Connected to database. Server time offset: ${offset}ms`
            });
          } else {
            results.push({
              name: 'Database Connection',
              status: 'warning',
              message: 'Connected to database but received no data. This might be due to database rules.'
            });
          }
        } catch (connError) {
          results.push({
            name: 'Database Connection',
            status: 'error',
            message: `Failed to connect to database: ${connError instanceof Error ? connError.message : 'Unknown error'}`
          });
        }
        
        // Test 5: Test SSL certificate
        try {
          const hostname = new URL(databaseURL!).hostname;
          const response = await fetch(`https://${hostname}/.json?shallow=true`, {
            method: 'GET',
            headers: {
              'Accept': 'application/json'
            }
          });
          
          if (response.ok) {
            results.push({
              name: 'SSL Certificate',
              status: 'success',
              message: 'SSL certificate is valid and database endpoint is accessible'
            });
          } else if (response.status === 401 || response.status === 403) {
            results.push({
              name: 'SSL Certificate',
              status: 'success',
              message: 'SSL certificate is valid (authentication required for data access)'
            });
          } else {
            results.push({
              name: 'SSL Certificate',
              status: 'warning',
              message: `Certificate validation returned status: ${response.status} - ${response.statusText}`
            });
          }
        } catch (sslError) {
          results.push({
            name: 'SSL Certificate',
            status: 'error',
            message: `SSL certificate validation failed: ${sslError instanceof Error ? sslError.message : 'Unknown error'}`
          });
        }
      }
      
      // Determine overall status
      const hasErrors = results.some(result => result.status === 'error');
      const hasWarnings = results.some(result => result.status === 'warning');
      
      if (hasErrors) {
        setOverallStatus('error');
      } else if (hasWarnings) {
        setOverallStatus('warning');
      } else {
        setOverallStatus('success');
      }
      
      setTestResults(results);
    } catch (error) {
      console.error('Error running database tests:', error);
      
      setTestResults([{
        name: 'Test Execution',
        status: 'error',
        message: `Failed to run tests: ${error instanceof Error ? error.message : 'Unknown error'}`
      }]);
      
      setOverallStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: 'success' | 'error' | 'warning') => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-amber-500" />;
    }
  };

  const getOverallStatusBadge = () => {
    switch (overallStatus) {
      case 'success':
        return <Badge variant="default" className="ml-2">All Tests Passed</Badge>;
      case 'error':
        return <Badge variant="destructive" className="ml-2">Tests Failed</Badge>;
      case 'warning':
        return <Badge variant="secondary" className="ml-2">Tests Passed with Warnings</Badge>;
      default:
        return <Badge variant="outline" className="ml-2">Not Tested</Badge>;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Firebase Database Connection Tests
          {getOverallStatusBadge()}
        </CardTitle>
        <CardDescription>
          Run comprehensive tests on your Firebase Realtime Database connection
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {testResults.length > 0 ? (
          <div className="space-y-4">
            {testResults.map((result, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{result.name}</div>
                  <div className="flex items-center space-x-2">
                    <Badge 
                      variant={
                        result.status === 'success' ? 'default' : 
                        result.status === 'error' ? 'destructive' : 
                        'secondary'
                      }
                    >
                      {result.status.charAt(0).toUpperCase() + result.status.slice(1)}
                    </Badge>
                    {getStatusIcon(result.status)}
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">{result.message}</div>
                {index < testResults.length - 1 && <Separator className="my-2" />}
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            {isLoading ? (
              <div className="flex flex-col items-center space-y-2">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p>Running database connection tests...</p>
              </div>
            ) : (
              <p>Click the button below to run database connection tests</p>
            )}
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button 
          onClick={runTests} 
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Running Tests...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              Run Database Tests
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}