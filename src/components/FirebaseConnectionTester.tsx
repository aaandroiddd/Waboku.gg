import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Separator } from '@/components/ui/separator';
import { Loader2, CheckCircle2, XCircle, AlertCircle, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { FirebaseConnectionTester } from '@/lib/firebase-connection-tester';

export function FirebaseConnectionTester() {
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  const runTests = async () => {
    setIsRunningTests(true);
    setError(null);
    
    try {
      const tester = new FirebaseConnectionTester();
      const results = await tester.runAllTests();
      setTestResults(results);
    } catch (err) {
      console.error('Error running connection tests:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsRunningTests(false);
    }
  };
  
  // Run tests on component mount
  useEffect(() => {
    runTests();
  }, []);
  
  const clearCacheAndReload = () => {
    if (typeof window !== 'undefined') {
      // Clear Firebase-specific cache items
      localStorage.removeItem('firebase:previous_websocket_failure');
      localStorage.removeItem('firebase:host:waboku-gg-default-rtdb.firebaseio.com');
      
      // Clear session storage
      sessionStorage.clear();
      
      // Add a flag to indicate we're coming back from a cache clear
      localStorage.setItem('messages_cache_cleared', Date.now().toString());
      
      // Reload the page
      window.location.reload();
    }
  };
  
  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>Firebase Connection Diagnostics</span>
          {testResults?.overallSuccess && <CheckCircle2 className="h-5 w-5 text-green-500" />}
          {testResults && !testResults.overallSuccess && <XCircle className="h-5 w-5 text-red-500" />}
        </CardTitle>
        <CardDescription>
          Comprehensive diagnostics for Firebase Realtime Database connection
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {isRunningTests && (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Running connection tests...</p>
          </div>
        )}
        
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {testResults && !isRunningTests && (
          <>
            {/* Overall Status */}
            <Alert variant={testResults.overallSuccess ? "default" : "destructive"} className={testResults.overallSuccess ? "bg-green-500/10 border-green-500" : ""}>
              {testResults.overallSuccess ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertTitle className={testResults.overallSuccess ? "text-green-500" : ""}>
                {testResults.overallSuccess ? "Connection Successful" : "Connection Issues Detected"}
              </AlertTitle>
              <AlertDescription>
                {testResults.overallSuccess 
                  ? "Firebase Realtime Database connection is working properly." 
                  : "There are issues with your Firebase Realtime Database connection."}
              </AlertDescription>
            </Alert>
            
            {/* Environment Info */}
            <div className="rounded-lg border p-4">
              <h3 className="text-sm font-medium mb-2">Environment Information</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-muted-foreground">Network Status:</div>
                <div className="flex items-center gap-1">
                  {testResults.environmentInfo.isOnline ? (
                    <>
                      <Wifi className="h-4 w-4 text-green-500" />
                      <span>Online</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="h-4 w-4 text-red-500" />
                      <span>Offline</span>
                    </>
                  )}
                </div>
                
                {testResults.environmentInfo.networkType && (
                  <>
                    <div className="text-muted-foreground">Network Type:</div>
                    <div>{testResults.environmentInfo.networkType}</div>
                  </>
                )}
                
                <div className="text-muted-foreground">Database URL:</div>
                <div className="truncate">
                  {testResults.configInfo.databaseUrl ? (
                    <span className="text-green-500">{testResults.configInfo.databaseUrl}</span>
                  ) : (
                    <span className="text-red-500">Missing</span>
                  )}
                </div>
                
                <div className="text-muted-foreground">API Key:</div>
                <div>
                  {testResults.configInfo.apiKeyPresent ? (
                    <span className="text-green-500">Present</span>
                  ) : (
                    <span className="text-red-500">Missing</span>
                  )}
                </div>
                
                <div className="text-muted-foreground">Project ID:</div>
                <div>
                  {testResults.configInfo.projectIdPresent ? (
                    <span className="text-green-500">Present</span>
                  ) : (
                    <span className="text-red-500">Missing</span>
                  )}
                </div>
              </div>
            </div>
            
            {/* Test Results */}
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="test-results">
                <AccordionTrigger>
                  <div className="flex items-center gap-2">
                    <span>Detailed Test Results</span>
                    <Badge variant={testResults.overallSuccess ? "success" : "destructive"}>
                      {testResults.tests.filter(t => t.success).length}/{testResults.tests.length} Passed
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 pt-2">
                    {testResults.tests.map((test, index) => (
                      <div key={index} className="rounded-md border p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium flex items-center gap-2">
                            {test.success ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-500" />
                            )}
                            <span>{test.stage}</span>
                          </div>
                          <Badge variant={test.success ? "outline" : "destructive"}>
                            {test.success ? "Passed" : "Failed"}
                          </Badge>
                        </div>
                        
                        {test.error && (
                          <div className="text-sm text-red-500 mt-1 bg-red-50 dark:bg-red-950/20 p-2 rounded">
                            {test.error}
                          </div>
                        )}
                        
                        {test.details && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {Object.entries(test.details).map(([key, value]) => (
                              <div key={key} className="flex gap-2">
                                <span className="font-medium">{key}:</span>
                                <span>{String(value)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
            
            {/* Troubleshooting */}
            {!testResults.overallSuccess && (
              <Alert className="bg-amber-500/10 border-amber-500">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                <AlertTitle className="text-amber-500">Troubleshooting Steps</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc list-inside space-y-1 text-sm mt-2">
                    <li>Check your internet connection and make sure you're online</li>
                    <li>Try clearing your browser cache using the button below</li>
                    <li>If you're using a VPN or firewall, try disabling it temporarily</li>
                    <li>Make sure your browser is up to date</li>
                    <li>Try using a different browser or device</li>
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </>
        )}
      </CardContent>
      
      <CardFooter className="flex justify-between">
        <Button 
          variant="outline" 
          onClick={runTests}
          disabled={isRunningTests}
        >
          {isRunningTests ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Running Tests...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Run Tests Again
            </>
          )}
        </Button>
        
        <Button 
          variant="default"
          onClick={clearCacheAndReload}
          disabled={isRunningTests}
        >
          Clear Cache & Reload
        </Button>
      </CardFooter>
    </Card>
  );
}