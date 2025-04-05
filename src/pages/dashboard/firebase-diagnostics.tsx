import { useState, useEffect, useRef } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { FirebaseConnectionTester } from '@/components/FirebaseConnectionTester';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { MessagesPageInitializer } from '@/components/MessagesPageInitializer';
import { DatabaseConnectionStatus } from '@/components/DatabaseConnectionStatus';
import { UpdateDatabaseRules } from '@/components/UpdateDatabaseRules';
import { FirestoreDisabler } from '@/components/FirestoreDisabler';
import { ClearFirestoreCache } from '@/components/ClearFirestoreCache';
import { useRouter } from 'next/router';
import { ArrowLeft, MessageCircle, Database, RefreshCw, Shield } from 'lucide-react';
import { getDatabase, ref, onValue } from 'firebase/database';

export default function FirebaseDiagnosticsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('connection-test');
  const unsubscribeRef = useRef<(() => void) | null>(null);
  
  // Clean up any Firebase listeners when component unmounts
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);
  
  // Example of properly setting up a Firebase listener with unsubscribe
  const setupTestListener = () => {
    try {
      const database = getDatabase();
      if (!database) return;
      
      const testRef = ref(database, 'connection_tests/status');
      
      // Store the unsubscribe function in the ref
      const unsubscribe = onValue(testRef, (snapshot) => {
        console.log('Connection test status:', snapshot.val());
      }, (error) => {
        console.error('Error in connection test listener:', error);
      });
      
      // Save the unsubscribe function to the ref
      unsubscribeRef.current = unsubscribe;
    } catch (error) {
      console.error('Error setting up test listener:', error);
    }
  };
  
  return (
    <DashboardLayout>
      {/* Initialize the messages page components to ensure proper Firebase setup */}
      <MessagesPageInitializer />
      {/* Disable Firestore to prevent 400 Bad Request errors */}
      <FirestoreDisabler />
      
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => router.push('/dashboard/messages')}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Messages
            </Button>
          </div>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => window.location.reload()}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh Page
          </Button>
        </div>
        
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Firebase Connection Diagnostics</CardTitle>
              <CardDescription>
                Troubleshoot issues with the Firebase Realtime Database connection
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="connection-test" className="flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Connection Test
                  </TabsTrigger>
                  <TabsTrigger value="messages-status" className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4" />
                    Messages Status
                  </TabsTrigger>
                  <TabsTrigger value="database-rules" className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Database Rules
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="connection-test" className="pt-4">
                  <FirebaseConnectionTester />
                </TabsContent>
                
                <TabsContent value="messages-status" className="pt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Messages Connection Status</CardTitle>
                      <CardDescription>
                        Current status of your connection to the messaging service
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <DatabaseConnectionStatus />
                      
                      <Separator />
                      
                      <div className="space-y-4">
                        <h3 className="text-lg font-medium">Common Issues</h3>
                        
                        <div className="space-y-2">
                          <h4 className="font-medium">Messages not loading</h4>
                          <p className="text-sm text-muted-foreground">
                            If your messages aren't loading, it's usually due to one of these issues:
                          </p>
                          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-4">
                            <li>Connection to Firebase Realtime Database is blocked by a firewall or VPN</li>
                            <li>Browser cache contains outdated or corrupted Firebase connection data</li>
                            <li>Network connectivity issues or unstable internet connection</li>
                            <li>Browser extensions interfering with Firebase connections</li>
                          </ul>
                        </div>
                        
                        <div className="space-y-2">
                          <h4 className="font-medium">Troubleshooting Steps</h4>
                          <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1 ml-4">
                            <li>Clear your browser cache using the "Clear Cache & Reload" button</li>
                            <li>Disable any VPN or firewall temporarily</li>
                            <li>Try using a different browser</li>
                            <li>Check if you can access other websites that use Firebase</li>
                            <li>Ensure your browser is up to date</li>
                          </ol>
                        </div>
                      </div>
                      
                      <div className="flex justify-center pt-4">
                        <ClearFirestoreCache className="w-full sm:w-auto" />
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="database-rules" className="pt-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Database Rules Management</CardTitle>
                      <CardDescription>
                        Update Firebase Realtime Database security rules to fix permission issues
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="bg-amber-500/10 border border-amber-500 rounded-md p-4 mb-4">
                        <h3 className="text-amber-500 font-medium flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          Permission Issues Detected
                        </h3>
                        <p className="text-sm mt-2">
                          The connection test is showing permission denied errors for database operations. 
                          This is likely due to restrictive security rules in your Firebase Realtime Database.
                        </p>
                        <p className="text-sm mt-2">
                          Click the button below to update the database rules to allow the connection tests to work properly.
                          This will add permissions for the test path while maintaining security for your actual data.
                        </p>
                      </div>
                      
                      <UpdateDatabaseRules />
                      
                      <Separator className="my-4" />
                      
                      <div className="space-y-2">
                        <h4 className="font-medium">After Updating Rules</h4>
                        <p className="text-sm text-muted-foreground">
                          After updating the database rules:
                        </p>
                        <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1 ml-4">
                          <li>Wait about 30 seconds for the rules to propagate</li>
                          <li>Go back to the "Connection Test" tab</li>
                          <li>Click "Run Tests Again" to verify the permission issues are resolved</li>
                          <li>If issues persist, try clearing your browser cache and reloading</li>
                        </ol>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}