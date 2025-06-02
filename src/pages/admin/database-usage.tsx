import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  getRecentOperations, 
  getHighUsagePaths, 
  getHighUsageSources, 
  setDetailedLogging,
  clearRecentOperations
} from '@/lib/database-usage-monitor';
import { ref, get, query, orderByChild, limitToLast } from 'firebase/database';
import { getFirebaseServices } from '@/lib/firebase';
import DatabaseUsageOptimizer from '@/components/DatabaseUsageOptimizer';
import DatabaseConnectionMonitor from '@/components/DatabaseConnectionMonitor';
import ComponentDatabaseUsageAnalyzer from '@/components/ComponentDatabaseUsageAnalyzer';
import { useRouter } from 'next/router';
import Footer from '@/components/Footer';

// Define types for our usage data
interface PathUsage {
  path: string;
  reads: number;
  writes: number;
  listens: number;
  totalSize: number;
  totalOperations: number;
}

interface SourceUsage {
  source: string;
  reads: number;
  writes: number;
  listens: number;
  totalSize: number;
  totalOperations: number;
}

interface RecentOperation {
  path: string;
  operation: 'read' | 'write' | 'listen';
  timestamp: number;
  source: string;
  size?: number;
}

const DatabaseUsagePage = () => {
  const router = useRouter();
  const [pathUsage, setPathUsage] = useState<PathUsage[]>([]);
  const [sourceUsage, setSourceUsage] = useState<SourceUsage[]>([]);
  const [recentOperations, setRecentOperations] = useState<RecentOperation[]>([]);
  const [isLoggingEnabled, setIsLoggingEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('paths');
  const [refreshInterval, setRefreshInterval] = useState<number | null>(null);
  const [realtimeStats, setRealtimeStats] = useState<any>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [firebaseInitialized, setFirebaseInitialized] = useState(false);

  // Check admin authorization
  const checkAdminAuth = async () => {
    try {
      const adminSecret = localStorage.getItem('admin_secret');
      if (!adminSecret) {
        router.push('/admin');
        return;
      }

      const response = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ secret: adminSecret }),
      });

      if (response.ok) {
        setIsAuthorized(true);
      } else {
        router.push('/admin');
      }
    } catch (error) {
      console.error('Error verifying admin auth:', error);
      router.push('/admin');
    } finally {
      setIsCheckingAuth(false);
    }
  };

  // Initialize Firebase services
  const initializeFirebaseServices = async () => {
    try {
      const services = await getFirebaseServices();
      if (services.database) {
        setFirebaseInitialized(true);
        console.log('Firebase Realtime Database initialized successfully');
      } else {
        console.error('Firebase Realtime Database not available');
      }
    } catch (error) {
      console.error('Error initializing Firebase services:', error);
    }
  };

  // Fetch Firebase Realtime Database usage statistics
  const fetchRealtimeStats = async () => {
    try {
      // This is a placeholder - in a real implementation, you would need to use
      // Firebase Admin SDK or a custom API endpoint to fetch usage statistics
      // from the Firebase console or Google Cloud Platform
      console.log('Fetching realtime database stats...');
      
      // For now, we'll just simulate some data
      setRealtimeStats({
        dailyUsage: {
          reads: 4300000000, // 4.3GB
          writes: 50000000,  // 50MB
          deletes: 1000000,  // 1MB
          total: 4351000000  // 4.351GB
        },
        quotaLimit: 360000000, // 360MB
        quotaExceeded: true
      });
    } catch (error) {
      console.error('Error fetching realtime database stats:', error);
    }
  };

  // Update usage data
  const updateUsageData = () => {
    setPathUsage(getHighUsagePaths());
    setSourceUsage(getHighUsageSources());
    setRecentOperations(getRecentOperations().slice(-100).reverse());
    setIsLoading(false);
  };

  // Toggle detailed logging
  const toggleLogging = () => {
    const newState = !isLoggingEnabled;
    setIsLoggingEnabled(newState);
    setDetailedLogging(newState);
    
    // If enabling logging, start auto-refresh
    if (newState && !refreshInterval) {
      const interval = window.setInterval(updateUsageData, 5000);
      setRefreshInterval(interval as unknown as number);
    } else if (!newState && refreshInterval) {
      // If disabling logging, stop auto-refresh
      window.clearInterval(refreshInterval);
      setRefreshInterval(null);
    }
  };

  // Clear collected data
  const handleClearData = () => {
    clearRecentOperations();
    updateUsageData();
  };

  // Initialize and cleanup
  useEffect(() => {
    checkAdminAuth();
  }, []);

  useEffect(() => {
    if (isAuthorized) {
      initializeFirebaseServices();
      fetchRealtimeStats();
      updateUsageData();
    }
    
    return () => {
      if (refreshInterval) {
        window.clearInterval(refreshInterval);
      }
    };
  }, [isAuthorized]);

  // Format bytes to human-readable format
  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  // Format timestamp to readable date/time
  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  // Show loading state while checking auth
  if (isCheckingAuth) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <p>Checking authorization...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show unauthorized state
  if (!isAuthorized) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Unauthorized Access</h1>
            <p className="text-muted-foreground mb-4">You need admin privileges to access this page.</p>
            <Button onClick={() => router.push('/admin')}>Go to Admin Login</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        <div className="mb-6">
          <Button 
            variant="outline" 
            onClick={() => router.push('/admin')}
            className="mb-4"
          >
            ← Back to Admin Dashboard
          </Button>
          <h1 className="text-3xl font-bold">Firebase Realtime Database Usage Monitor</h1>
        </div>
      
      {realtimeStats && (
        <Card className="p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Current Usage Statistics</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <h3 className="text-lg font-medium mb-2">Daily Usage (Last 24h)</h3>
              <p>Downloads: {formatBytes(realtimeStats.dailyUsage.reads)}</p>
              <p>Uploads: {formatBytes(realtimeStats.dailyUsage.writes)}</p>
              <p>Deletes: {formatBytes(realtimeStats.dailyUsage.deletes)}</p>
              <p className="font-semibold mt-2">Total: {formatBytes(realtimeStats.dailyUsage.total)}</p>
            </div>
            
            <div>
              <h3 className="text-lg font-medium mb-2">Quota Information</h3>
              <p>Daily Quota: {formatBytes(realtimeStats.quotaLimit)}</p>
              <p className={`font-semibold ${realtimeStats.quotaExceeded ? 'text-red-500' : 'text-green-500'}`}>
                Status: {realtimeStats.quotaExceeded ? 'Quota Exceeded' : 'Within Quota'}
              </p>
              
              {realtimeStats.quotaExceeded && (
                <Alert variant="destructive" className="mt-4">
                  <AlertTitle>Quota Exceeded</AlertTitle>
                  <AlertDescription>
                    Your Firebase Realtime Database usage has exceeded the free tier limit.
                    You are currently being charged for additional usage.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>
        </Card>
      )}
      
      <div className="flex items-center space-x-4 mb-6">
        <Switch 
          id="logging-switch" 
          checked={isLoggingEnabled} 
          onCheckedChange={toggleLogging} 
        />
        <Label htmlFor="logging-switch">
          {isLoggingEnabled ? 'Disable' : 'Enable'} Detailed Logging
        </Label>
        
        <Button 
          variant="outline" 
          onClick={updateUsageData}
          disabled={isLoading}
        >
          Refresh Data
        </Button>
        
        <Button 
          variant="outline" 
          onClick={handleClearData}
        >
          Clear Collected Data
        </Button>
      </div>
      
      {!isLoggingEnabled && (
        <Alert className="mb-6">
          <AlertTitle>Logging Disabled</AlertTitle>
          <AlertDescription>
            Enable detailed logging to track database operations and identify high usage patterns.
            Note that enabling logging will slightly increase overhead.
          </AlertDescription>
        </Alert>
      )}
      
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="paths">Paths Usage</TabsTrigger>
          <TabsTrigger value="sources">Component Sources</TabsTrigger>
          <TabsTrigger value="recent">Recent Operations</TabsTrigger>
        </TabsList>
        
        <TabsContent value="paths">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Database Paths with Highest Usage</h2>
            
            {pathUsage.length === 0 ? (
              <p className="text-muted-foreground">No data collected yet. Enable logging and interact with the application.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Path</TableHead>
                    <TableHead>Reads</TableHead>
                    <TableHead>Writes</TableHead>
                    <TableHead>Listeners</TableHead>
                    <TableHead>Total Size</TableHead>
                    <TableHead>Total Operations</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pathUsage.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-mono text-sm">{item.path}</TableCell>
                      <TableCell>{item.reads}</TableCell>
                      <TableCell>{item.writes}</TableCell>
                      <TableCell>{item.listens}</TableCell>
                      <TableCell>{formatBytes(item.totalSize)}</TableCell>
                      <TableCell>{item.totalOperations}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>
        
        <TabsContent value="sources">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Components/Sources with Highest Usage</h2>
            
            {sourceUsage.length === 0 ? (
              <p className="text-muted-foreground">No data collected yet. Enable logging and interact with the application.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Component/Source</TableHead>
                    <TableHead>Reads</TableHead>
                    <TableHead>Writes</TableHead>
                    <TableHead>Listeners</TableHead>
                    <TableHead>Total Size</TableHead>
                    <TableHead>Total Operations</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sourceUsage.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>{item.source}</TableCell>
                      <TableCell>{item.reads}</TableCell>
                      <TableCell>{item.writes}</TableCell>
                      <TableCell>{item.listens}</TableCell>
                      <TableCell>{formatBytes(item.totalSize)}</TableCell>
                      <TableCell>{item.totalOperations}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>
        
        <TabsContent value="recent">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Recent Database Operations</h2>
            
            {recentOperations.length === 0 ? (
              <p className="text-muted-foreground">No operations recorded yet. Enable logging and interact with the application.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Operation</TableHead>
                    <TableHead>Path</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Size</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentOperations.map((op, index) => (
                    <TableRow key={index}>
                      <TableCell>{formatTimestamp(op.timestamp)}</TableCell>
                      <TableCell className="uppercase">{op.operation}</TableCell>
                      <TableCell className="font-mono text-sm">{op.path}</TableCell>
                      <TableCell>{op.source}</TableCell>
                      <TableCell>{op.size ? formatBytes(op.size) : 'N/A'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>
      </Tabs>
      
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h2 className="text-xl font-semibold mb-4">Database Connection Monitor</h2>
          <DatabaseConnectionMonitor />
        </div>
        
        <div>
          <h2 className="text-xl font-semibold mb-4">Database Usage Optimizer</h2>
          <DatabaseUsageOptimizer onOptimize={updateUsageData} />
        </div>
      </div>
      
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Component Database Usage Analysis</h2>
        <ComponentDatabaseUsageAnalyzer />
      </div>
      
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Recommendations to Reduce Database Usage</h2>
        
        <ul className="list-disc pl-6 space-y-2">
          <li>Use <code className="bg-muted px-1 rounded">limitToFirst()</code> and <code className="bg-muted px-1 rounded">limitToLast()</code> to limit the amount of data downloaded</li>
          <li>Implement pagination for large data sets</li>
          <li>Structure your data to avoid downloading unnecessary information</li>
          <li>Use <code className="bg-muted px-1 rounded">once()</code> instead of <code className="bg-muted px-1 rounded">on()</code> for data that doesn't need real-time updates</li>
          <li>Detach listeners when components unmount using <code className="bg-muted px-1 rounded">off()</code></li>
          <li>Consider caching frequently accessed data client-side</li>
          <li>Use shallow queries with <code className="bg-muted px-1 rounded">orderByKey()</code> and <code className="bg-muted px-1 rounded">orderByChild()</code></li>
        </ul>
      </div>
      </div>
      
      <Footer />
    </div>
  );
};

export default DatabaseUsagePage;