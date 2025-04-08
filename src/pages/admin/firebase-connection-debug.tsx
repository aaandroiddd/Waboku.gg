import React from 'react';
import { FirebaseConnectionDebugger } from '@/components/FirebaseConnectionDebugger';
import { FirebaseConnectionFixer } from '@/components/FirebaseConnectionFixer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { getDatabase, ref, set, onValue, get, DatabaseReference } from 'firebase/database';
import { getFirebaseServices } from '@/lib/firebase';

export default function FirebaseConnectionDebugPage() {
  const { toast } = useToast();
  
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
      
      // Get database URL
      const databaseRef = ref(database);
      const url = databaseRef.toString();
      
      if (!url) {
        toast({
          title: "Error",
          description: "Could not determine database URL",
          variant: "destructive"
        });
        return;
      }
      
      // Extract hostname
      const parsedUrl = new URL(url);
      const hostname = parsedUrl.hostname;
      
      toast({
        title: "Info",
        description: `Checking certificate for ${hostname}...`
      });
      
      // Use fetch to check certificate
      const response = await fetch(`https://${hostname}/.well-known/assetlinks.json`, {
        method: 'HEAD',
      }).catch(error => {
        throw new Error(`Certificate validation failed: ${error.message}`);
      });
      
      if (response.ok || response.status === 404) {
        // 404 is fine, we just want to check if the SSL handshake works
        toast({
          title: "Success",
          description: `SSL certificate for ${hostname} is valid`
        });
      } else {
        toast({
          title: "Error",
          description: `Certificate validation failed with status: ${response.status}`,
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
  
  return (
    <div className="container py-8 space-y-8">
      <h1 className="text-3xl font-bold">Firebase Connection Debugging</h1>
      
      <Tabs defaultValue="config">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="diagnostics">Automated Diagnostics</TabsTrigger>
          <TabsTrigger value="fixes">Connection Fixes</TabsTrigger>
          <TabsTrigger value="manual">Manual Tests</TabsTrigger>
        </TabsList>
        
        <TabsContent value="config" className="mt-4">
          <FirebaseConfigVerifier />
        </TabsContent>
        
        <TabsContent value="diagnostics" className="mt-4">
          <FirebaseConnectionDebugger />
        </TabsContent>
        
        <TabsContent value="fixes" className="mt-4">
          <FirebaseConnectionFixer />
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