import { useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { FirebaseConnectionTester } from '@/components/FirebaseConnectionTester';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { MessagesPageInitializer } from '@/components/MessagesPageInitializer';
import { DatabaseConnectionStatus } from '@/components/DatabaseConnectionStatus';
import { UpdateDatabaseRules } from '@/components/UpdateDatabaseRules';
import { useRouter } from 'next/router';
import { ArrowLeft, MessageCircle, Database, RefreshCw, Shield } from 'lucide-react';

export default function FirebaseDiagnosticsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('connection-test');
  
  return (
    <DashboardLayout>
      {/* Initialize the messages page components to ensure proper Firebase setup */}
      <MessagesPageInitializer />
      
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
                        <Button 
                          onClick={() => {
                            // Clear Firebase-specific cache items
                            localStorage.removeItem('firebase:previous_websocket_failure');
                            localStorage.removeItem('firebase:host:waboku-gg-default-rtdb.firebaseio.com');
                            
                            // Clear session storage
                            sessionStorage.clear();
                            
                            // Add a flag to indicate we're coming back from a cache clear
                            localStorage.setItem('messages_cache_cleared', Date.now().toString());
                            
                            // Reload the page
                            window.location.reload();
                          }}
                          className="w-full sm:w-auto"
                        >
                          Clear Cache & Reload
                        </Button>
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