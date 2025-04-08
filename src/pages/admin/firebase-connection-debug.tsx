import React from 'react';
import { FirebaseConfigVerifier } from '@/components/FirebaseConfigVerifier';
import { FirebaseConnectionDebugger } from '@/components/FirebaseConnectionDebugger';
import { FirebaseConnectionFixer } from '@/components/FirebaseConnectionFixer';
import { FirebaseDatabaseTester } from '@/components/FirebaseDatabaseTester';
import { UpdateDatabaseRules } from '@/components/UpdateDatabaseRules';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { getDatabase, ref, set, onValue, get, DatabaseReference } from 'firebase/database';
import { getFirebaseServices } from '@/lib/firebase';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';

export default function FirebaseConnectionDebugPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  
  useEffect(() => {
    const verifyAdmin = async () => {
      try {
        setIsLoading(true);
        const adminSecret = localStorage.getItem('adminSecret') || '';
        
        const response = await fetch('/api/admin/verify', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${adminSecret}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (!response.ok) {
          throw new Error('Admin access required');
        }
        
        setIsAdmin(true);
      } catch (error) {
        console.error('Admin verification error:', error);
        setError('You do not have permission to access this page. Admin access required.');
        setTimeout(() => {
          router.push('/admin/login');
        }, 3000);
      } finally {
        setIsLoading(false);
      }
    };
    
    verifyAdmin();
  }, [router]);
  
  const testDatabaseWrite = async () => {
    try {
      const { database } = getFirebaseServices();
      
      if (!database) {
        toast({
          title: "Error",
          description: "Firebase database is not initialized",
          variant: "destructive"
        });
        return;
      }
      
      const testRef = ref(database, 'connection_tests/manual_test_' + Date.now());
      await set(testRef, {
        timestamp: Date.now(),
        message: 'Manual connection test'
      });
      
      toast({
        title: "Success",
        description: "Successfully wrote to database"
      });
    } catch (error) {
      console.error('Database write error:', error);
      toast({
        title: "Error",
        description: `Failed to write to database: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
      });
    }
  };
  
  const testDatabaseRead = async () => {
    try {
      const { database } = getFirebaseServices();
      
      if (!database) {
        toast({
          title: "Error",
          description: "Firebase database is not initialized",
          variant: "destructive"
        });
        return;
      }
      
      const infoRef = ref(database, '.info/serverTimeOffset');
      const snapshot = await get(infoRef);
      const offset = snapshot.val();
      
      toast({
        title: "Success",
        description: `Successfully read from database. Server time offset: ${offset}ms`
      });
    } catch (error) {
      console.error('Database read error:', error);
      toast({
        title: "Error",
        description: `Failed to read from database: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
      });
    }
  };
  
  const testLongPolling = () => {
    try {
      const { database } = getFirebaseServices();
      
      if (!database) {
        toast({
          title: "Error",
          description: "Firebase database is not initialized",
          variant: "destructive"
        });
        return;
      }
      
      toast({
        title: "Info",
        description: "Starting long polling test. Check console for results."
      });
      
      const connectedRef = ref(database, '.info/connected');
      const unsubscribe = onValue(connectedRef, (snapshot) => {
        const connected = snapshot.val();
        console.log('Long polling test - connected:', connected);
        
        toast({
          title: connected ? "Success" : "Warning",
          description: connected 
            ? "Long polling connection established successfully" 
            : "Long polling connection status is false. This might be normal during initial connection.",
          variant: connected ? "default" : "destructive"
        });
        
        // Unsubscribe after 10 seconds
        setTimeout(() => {
          unsubscribe();
          console.log('Long polling test - unsubscribed');
          
          toast({
            title: "Info",
            description: "Long polling test completed and listener removed"
          });
        }, 10000);
      }, (error) => {
        console.error('Long polling test error:', error);
        
        toast({
          title: "Error",
          description: `Long polling test failed: ${error.message}`,
          variant: "destructive"
        });
        
        unsubscribe();
      });
    } catch (error) {
      console.error('Long polling test setup error:', error);
      
      toast({
        title: "Error",
        description: `Failed to set up long polling test: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
      });
    }
  };
  
  const checkCertificate = async () => {
    try {
      const { database } = getFirebaseServices();
      
      if (!database) {
        toast({
          title: "Error",
          description: "Firebase database is not initialized",
          variant: "destructive"
        });
        return;
      }
      
      // Get database URL from environment variable instead of ref
      const databaseURL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
      
      if (!databaseURL) {
        toast({
          title: "Error",
          description: "Database URL is not configured in environment variables",
          variant: "destructive"
        });
        return;
      }
      
      // Extract hostname
      const parsedUrl = new URL(databaseURL);
      const hostname = parsedUrl.hostname;
      
      toast({
        title: "Info",
        description: `Checking certificate for ${hostname}...`
      });
      
      // Use fetch to check certificate with a proper endpoint
      // Instead of using assetlinks.json which is for App Links and not relevant for database
      const response = await fetch(`https://${hostname}/.json?shallow=true`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      }).catch(error => {
        throw new Error(`Certificate validation failed: ${error.message}`);
      });
      
      if (response.ok) {
        toast({
          title: "Success",
          description: `SSL certificate for ${hostname} is valid and database connection is working`
        });
      } else if (response.status === 401 || response.status === 403) {
        // Authentication error is expected if database rules require auth
        toast({
          title: "Success",
          description: `SSL certificate for ${hostname} is valid (authentication required for data access)`
        });
      } else {
        toast({
          title: "Error",
          description: `Certificate validation failed with status: ${response.status} - ${response.statusText}`,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Certificate validation error:', error);
      
      toast({
        title: "Error",
        description: `Certificate validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive"
      });
    }
  };
  
  if (isLoading) {
    return (
      <div className="container py-8 flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin mb-4" />
        <p>Verifying admin access...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="container py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }
  
  if (!isAdmin) {
    return null;
  }
  
  return (
    <div className="container py-8 space-y-8">
      <h1 className="text-3xl font-bold">Firebase Connection Debugging</h1>
      
      <Tabs defaultValue="config">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="database">Database Tests</TabsTrigger>
          <TabsTrigger value="diagnostics">Automated Diagnostics</TabsTrigger>
          <TabsTrigger value="fixes">Connection Fixes</TabsTrigger>
          <TabsTrigger value="manual">Manual Tests</TabsTrigger>
        </TabsList>
        
        <TabsContent value="config" className="mt-4">
          <FirebaseConfigVerifier />
        </TabsContent>
        
        <TabsContent value="database" className="mt-4">
          <FirebaseDatabaseTester />
        </TabsContent>
        
        <TabsContent value="diagnostics" className="mt-4">
          <FirebaseConnectionDebugger />
        </TabsContent>
        
        <TabsContent value="fixes" className="mt-4">
          <div className="space-y-6">
            <FirebaseConnectionFixer />
            <Card>
              <CardHeader>
                <CardTitle>Database Rules Update</CardTitle>
                <CardDescription>
                  Update Firebase Realtime Database rules to fix read/write access issues
                </CardDescription>
              </CardHeader>
              <CardContent>
                <UpdateDatabaseRules />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="manual" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Manual Firebase Tests</CardTitle>
              <CardDescription>
                Run individual tests to diagnose specific Firebase connection issues
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Database Write Test</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm mb-4">
                      Tests if the application can write data to Firebase Realtime Database.
                    </p>
                    <Button onClick={testDatabaseWrite}>Run Write Test</Button>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Database Read Test</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm mb-4">
                      Tests if the application can read data from Firebase Realtime Database.
                    </p>
                    <Button onClick={testDatabaseRead}>Run Read Test</Button>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Long Polling Test</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm mb-4">
                      Tests if the application can establish a long polling connection to Firebase.
                    </p>
                    <Button onClick={testLongPolling}>Test Long Polling</Button>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Certificate Validation</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm mb-4">
                      Tests if the SSL certificate for the Firebase database is valid.
                    </p>
                    <Button onClick={checkCertificate}>Check Certificate</Button>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}