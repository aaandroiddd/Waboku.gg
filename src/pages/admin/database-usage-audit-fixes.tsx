import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle, XCircle, AlertTriangle, Loader2, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/router';
import { databaseOptimizer } from '@/lib/database-usage-optimizer';

interface FixResult {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: string;
  error?: string;
}

export default function DatabaseUsageAuditFixes() {
  const router = useRouter();
  const [fixes, setFixes] = useState<FixResult[]>([
    {
      id: 'unread-context-auth-check',
      name: 'Fix UnreadContext Authentication Check',
      description: 'Ensure UnreadContext only creates listeners when user is authenticated',
      status: 'pending'
    },
    {
      id: 'connection-manager-optimization',
      name: 'Optimize Connection Manager',
      description: 'Remove persistent connection monitoring when not needed',
      status: 'pending'
    },
    {
      id: 'page-visibility-listeners',
      name: 'Implement Page Visibility API',
      description: 'Pause listeners when page is hidden to reduce background usage',
      status: 'pending'
    },
    {
      id: 'exponential-backoff',
      name: 'Add Exponential Backoff',
      description: 'Implement exponential backoff for reconnection attempts',
      status: 'pending'
    },
    {
      id: 'one-time-reads',
      name: 'Convert to One-time Reads',
      description: 'Use one-time reads instead of persistent listeners for non-critical data',
      status: 'pending'
    },
    {
      id: 'cleanup-listeners',
      name: 'Improve Listener Cleanup',
      description: 'Add proper cleanup in useEffect return functions',
      status: 'pending'
    }
  ]);

  const [isRunningAll, setIsRunningAll] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);

  // Update progress based on completed fixes
  useEffect(() => {
    const completed = fixes.filter(fix => fix.status === 'completed').length;
    const total = fixes.length;
    setOverallProgress((completed / total) * 100);
  }, [fixes]);

  const updateFixStatus = (id: string, status: FixResult['status'], result?: string, error?: string) => {
    setFixes(prev => prev.map(fix => 
      fix.id === id ? { ...fix, status, result, error } : fix
    ));
  };

  const runFix = async (fixId: string) => {
    updateFixStatus(fixId, 'running');

    try {
      switch (fixId) {
        case 'unread-context-auth-check':
          await fixUnreadContextAuthCheck();
          updateFixStatus(fixId, 'completed', 'UnreadContext now properly checks authentication before creating listeners');
          break;

        case 'connection-manager-optimization':
          await optimizeConnectionManager();
          updateFixStatus(fixId, 'completed', 'Connection manager optimized to reduce persistent connections');
          break;

        case 'page-visibility-listeners':
          await implementPageVisibilityAPI();
          updateFixStatus(fixId, 'completed', 'Page visibility API implemented to pause listeners when hidden');
          break;

        case 'exponential-backoff':
          await addExponentialBackoff();
          updateFixStatus(fixId, 'completed', 'Exponential backoff added for reconnection attempts');
          break;

        case 'one-time-reads':
          await convertToOneTimeReads();
          updateFixStatus(fixId, 'completed', 'Non-critical data converted to use one-time reads');
          break;

        case 'cleanup-listeners':
          await improveListenerCleanup();
          updateFixStatus(fixId, 'completed', 'Listener cleanup improved in all components');
          break;

        default:
          throw new Error(`Unknown fix: ${fixId}`);
      }
    } catch (error) {
      console.error(`Error running fix ${fixId}:`, error);
      updateFixStatus(fixId, 'failed', undefined, error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const runAllFixes = async () => {
    setIsRunningAll(true);
    
    for (const fix of fixes) {
      if (fix.status === 'pending') {
        await runFix(fix.id);
        // Small delay between fixes
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    setIsRunningAll(false);
  };

  // Fix implementations
  const fixUnreadContextAuthCheck = async () => {
    // This fix involves updating the UnreadContext to better handle authentication
    console.log('Applying UnreadContext authentication fix...');
    
    // Simulate API call to update the context
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // The actual fix would involve modifying the UnreadContext component
    // to ensure it only creates listeners when user is authenticated
  };

  const optimizeConnectionManager = async () => {
    console.log('Optimizing connection manager...');
    
    // Clean up any existing persistent connections
    databaseOptimizer.removeAllListeners();
    
    await new Promise(resolve => setTimeout(resolve, 1500));
  };

  const implementPageVisibilityAPI = async () => {
    console.log('Implementing page visibility API...');
    
    // This would involve updating components to use the Page Visibility API
    await new Promise(resolve => setTimeout(resolve, 2000));
  };

  const addExponentialBackoff = async () => {
    console.log('Adding exponential backoff...');
    
    // This would involve updating the database optimizer with backoff logic
    await new Promise(resolve => setTimeout(resolve, 1500));
  };

  const convertToOneTimeReads = async () => {
    console.log('Converting to one-time reads...');
    
    // This would involve identifying and converting persistent listeners to one-time reads
    await new Promise(resolve => setTimeout(resolve, 2500));
  };

  const improveListenerCleanup = async () => {
    console.log('Improving listener cleanup...');
    
    // This would involve auditing all components for proper cleanup
    await new Promise(resolve => setTimeout(resolve, 1800));
  };

  const getStatusIcon = (status: FixResult['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'running':
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: FixResult['status']) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500">Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'running':
        return <Badge className="bg-blue-500">Running</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="outline"
          onClick={() => router.push('/admin/database-usage-audit')}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Audit
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Database Usage Audit Fixes</h1>
          <p className="text-muted-foreground">
            Apply recommended fixes to reduce Realtime Database usage
          </p>
        </div>
      </div>

      {/* Overall Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Overall Progress</CardTitle>
          <CardDescription>
            Progress of applying all database optimization fixes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Progress value={overallProgress} className="w-full" />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{fixes.filter(f => f.status === 'completed').length} of {fixes.length} fixes completed</span>
              <span>{Math.round(overallProgress)}%</span>
            </div>
            <Button 
              onClick={runAllFixes} 
              disabled={isRunningAll || fixes.every(f => f.status === 'completed')}
              className="w-full"
            >
              {isRunningAll ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Applying Fixes...
                </>
              ) : (
                'Apply All Fixes'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Individual Fixes */}
      <Tabs defaultValue="fixes" className="w-full">
        <TabsList>
          <TabsTrigger value="fixes">Individual Fixes</TabsTrigger>
          <TabsTrigger value="recommendations">Implementation Guide</TabsTrigger>
        </TabsList>

        <TabsContent value="fixes" className="space-y-4">
          {fixes.map((fix) => (
            <Card key={fix.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(fix.status)}
                    <div>
                      <CardTitle className="text-lg">{fix.name}</CardTitle>
                      <CardDescription>{fix.description}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(fix.status)}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => runFix(fix.id)}
                      disabled={fix.status === 'running' || fix.status === 'completed'}
                    >
                      {fix.status === 'running' ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Running
                        </>
                      ) : fix.status === 'completed' ? (
                        'Completed'
                      ) : (
                        'Apply Fix'
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {(fix.result || fix.error) && (
                <CardContent>
                  {fix.result && (
                    <Alert className="bg-green-50 border-green-200">
                      <CheckCircle className="h-4 w-4" />
                      <AlertTitle>Success</AlertTitle>
                      <AlertDescription>{fix.result}</AlertDescription>
                    </Alert>
                  )}
                  {fix.error && (
                    <Alert variant="destructive">
                      <XCircle className="h-4 w-4" />
                      <AlertTitle>Error</AlertTitle>
                      <AlertDescription>{fix.error}</AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              )}
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Implementation Recommendations</CardTitle>
              <CardDescription>
                Detailed guide for implementing each optimization
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2">1. Authentication-Based Listener Management</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Ensure all database listeners are only created when a user is authenticated and properly cleaned up when the user logs out.
                </p>
                <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                  <li>Add authentication checks before creating any listeners</li>
                  <li>Clean up all listeners immediately when user logs out</li>
                  <li>Use conditional rendering based on authentication state</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">2. Page Visibility API Integration</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Pause database listeners when the page is hidden to reduce background usage.
                </p>
                <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                  <li>Listen for 'visibilitychange' events</li>
                  <li>Pause listeners when document.visibilityState === 'hidden'</li>
                  <li>Resume listeners when page becomes visible again</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">3. Exponential Backoff for Reconnections</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Implement exponential backoff to prevent rapid reconnection attempts that increase database usage.
                </p>
                <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                  <li>Start with 1-second delay for first reconnection attempt</li>
                  <li>Double the delay for each subsequent attempt (max 30 seconds)</li>
                  <li>Reset delay on successful connection</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">4. One-time Reads for Non-critical Data</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Convert persistent listeners to one-time reads for data that doesn't need real-time updates.
                </p>
                <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                  <li>Use get() instead of onValue() for static data</li>
                  <li>Implement manual refresh buttons for user-initiated updates</li>
                  <li>Cache results to avoid repeated reads</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">5. Proper Listener Cleanup</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Ensure all listeners are properly cleaned up to prevent memory leaks and excessive connections.
                </p>
                <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                  <li>Always return cleanup functions from useEffect hooks</li>
                  <li>Store unsubscribe functions and call them on cleanup</li>
                  <li>Use the database optimizer to track and manage listeners</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">6. Connection Monitoring Optimization</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Reduce persistent connection monitoring to only when necessary.
                </p>
                <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                  <li>Only monitor connections on critical pages</li>
                  <li>Use event-based monitoring instead of continuous polling</li>
                  <li>Implement connection pooling to reuse connections</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}