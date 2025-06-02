import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { databaseOptimizer } from '@/lib/database-usage-optimizer';
import { databaseCleanupManager } from '@/lib/database-cleanup';
import { AlertTriangle, Database, Activity, Users, MessageSquare, Clock } from 'lucide-react';

export default function DatabaseMonitorPage() {
  const [stats, setStats] = useState<any>(null);
  const [cleanupStats, setCleanupStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const refreshStats = () => {
    try {
      const optimizerStats = databaseOptimizer.getStats();
      const cleanupManagerStats = databaseCleanupManager.getStats();
      
      setStats(optimizerStats);
      setCleanupStats(cleanupManagerStats);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error fetching database stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshStats();
    
    // Auto-refresh every 5 seconds
    const interval = setInterval(refreshStats, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const handleForceCleanup = () => {
    databaseCleanupManager.cleanup();
    refreshStats();
  };

  const handleRemoveAllListeners = () => {
    databaseOptimizer.removeAllListeners();
    refreshStats();
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="container mx-auto p-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p>Loading database monitor...</p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const connectionStatus = stats?.activeConnections || 0;
  const maxConnections = stats?.maxConnections || 10;
  const connectionPercentage = (connectionStatus / maxConnections) * 100;

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Database Monitor</h1>
            <p className="text-muted-foreground">
              Monitor Firebase Realtime Database connections and usage
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={refreshStats} variant="outline">
              Refresh
            </Button>
            <Button onClick={handleForceCleanup} variant="destructive">
              Force Cleanup
            </Button>
          </div>
        </div>

        {/* Connection Status Alert */}
        {connectionPercentage > 80 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              High database connection usage detected ({connectionStatus}/{maxConnections}). 
              Consider optimizing listeners or increasing connection limits.
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="connections">Active Connections</TabsTrigger>
            <TabsTrigger value="cleanup">Cleanup Manager</TabsTrigger>
            <TabsTrigger value="optimization">Optimization Tips</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Connections</CardTitle>
                  <Database className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {connectionStatus}/{maxConnections}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 bg-muted rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all ${
                          connectionPercentage > 80 ? 'bg-destructive' : 
                          connectionPercentage > 60 ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(connectionPercentage, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {connectionPercentage.toFixed(0)}%
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Cleanup Callbacks</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {cleanupStats?.registeredCallbacks || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Registered cleanup functions
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Cleanup Status</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    <Badge variant={cleanupStats?.isCleaningUp ? "destructive" : "secondary"}>
                      {cleanupStats?.isCleaningUp ? "Running" : "Idle"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Cleanup manager status
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Last Update</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-sm font-bold">
                    {lastUpdate.toLocaleTimeString()}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Auto-refresh every 5s
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="connections" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Active Database Listeners</CardTitle>
                <CardDescription>
                  Currently active Firebase Realtime Database listeners
                </CardDescription>
              </CardHeader>
              <CardContent>
                {stats?.activeListeners?.length > 0 ? (
                  <div className="space-y-2">
                    {stats.activeListeners.map((listenerId: string, index: number) => (
                      <div key={index} className="flex items-center justify-between p-2 border rounded">
                        <span className="font-mono text-sm">{listenerId}</span>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            databaseOptimizer.removeListener(listenerId);
                            refreshStats();
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                    <div className="pt-4">
                      <Button onClick={handleRemoveAllListeners} variant="destructive">
                        Remove All Listeners
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">No active listeners</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cleanup" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Cleanup Manager</CardTitle>
                <CardDescription>
                  Manage database connection cleanup and memory management
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium">Registered Callbacks</h4>
                    <p className="text-2xl font-bold">{cleanupStats?.registeredCallbacks || 0}</p>
                  </div>
                  <div>
                    <h4 className="font-medium">Status</h4>
                    <Badge variant={cleanupStats?.isCleaningUp ? "destructive" : "secondary"}>
                      {cleanupStats?.isCleaningUp ? "Cleaning Up" : "Ready"}
                    </Badge>
                  </div>
                </div>
                
                <div className="pt-4">
                  <Button onClick={handleForceCleanup} variant="destructive">
                    Force Cleanup All Connections
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">
                    This will immediately clean up all database connections and registered callbacks.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="optimization" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Database Usage Optimization Tips</CardTitle>
                <CardDescription>
                  Recommendations to reduce Firebase Realtime Database costs
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="border-l-4 border-blue-500 pl-4">
                    <h4 className="font-medium">Listener Management</h4>
                    <ul className="text-sm text-muted-foreground space-y-1 mt-2">
                      <li>• Use limitToLast() queries to reduce data transfer</li>
                      <li>• Clean up listeners when components unmount</li>
                      <li>• Avoid listening to large data sets unnecessarily</li>
                      <li>• Use one-time reads (get()) instead of listeners when possible</li>
                    </ul>
                  </div>

                  <div className="border-l-4 border-green-500 pl-4">
                    <h4 className="font-medium">Data Structure Optimization</h4>
                    <ul className="text-sm text-muted-foreground space-y-1 mt-2">
                      <li>• Denormalize data to reduce the number of queries</li>
                      <li>• Use user-specific paths instead of global listeners</li>
                      <li>• Implement pagination for large data sets</li>
                      <li>• Cache frequently accessed data locally</li>
                    </ul>
                  </div>

                  <div className="border-l-4 border-yellow-500 pl-4">
                    <h4 className="font-medium">Connection Limits</h4>
                    <ul className="text-sm text-muted-foreground space-y-1 mt-2">
                      <li>• Current limit: {maxConnections} concurrent connections</li>
                      <li>• Monitor connection usage regularly</li>
                      <li>• Implement connection pooling for high-traffic scenarios</li>
                      <li>• Use debouncing for rapid updates</li>
                    </ul>
                  </div>

                  <div className="border-l-4 border-red-500 pl-4">
                    <h4 className="font-medium">Cost Reduction Strategies</h4>
                    <ul className="text-sm text-muted-foreground space-y-1 mt-2">
                      <li>• Reduce real-time listeners for non-critical data</li>
                      <li>• Implement smart caching with expiration</li>
                      <li>• Use Firebase Functions for server-side processing</li>
                      <li>• Monitor usage patterns and optimize accordingly</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}