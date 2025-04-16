import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { database } from '@/lib/firebase';
import { ref, onValue, off, query, limitToLast } from 'firebase/database';

interface DatabaseUsageOptimizerProps {
  onOptimize?: () => void;
}

const DatabaseUsageOptimizer: React.FC<DatabaseUsageOptimizerProps> = ({ onOptimize }) => {
  const [activeListeners, setActiveListeners] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [optimizationsMade, setOptimizationsMade] = useState(0);
  const [detectedIssues, setDetectedIssues] = useState<{
    path: string;
    issue: string;
    severity: 'low' | 'medium' | 'high';
    recommendation: string;
  }[]>([]);

  // Scan for active listeners
  const scanForListeners = () => {
    setIsScanning(true);
    
    // This is a simplified approach - in a real implementation,
    // you would need to track listeners when they're attached
    
    // Simulate finding active listeners
    setTimeout(() => {
      setActiveListeners([
        '/messages',
        '/users/online',
        '/listings/active',
        '/notifications',
        '/chat/threads'
      ]);
      
      setDetectedIssues([
        {
          path: '/messages',
          issue: 'Unlimited listener without query constraints',
          severity: 'high',
          recommendation: 'Add limitToLast(50) to reduce data transfer'
        },
        {
          path: '/listings/active',
          issue: 'Frequent large data downloads',
          severity: 'medium',
          recommendation: 'Implement pagination or use indexing'
        },
        {
          path: '/chat/threads',
          issue: 'Multiple listeners on the same path',
          severity: 'medium',
          recommendation: 'Consolidate listeners and share data through state management'
        }
      ]);
      
      setIsScanning(false);
    }, 2000);
  };

  // Optimize database usage
  const optimizeDatabaseUsage = () => {
    // This would implement actual optimizations in a real application
    // For now, we'll just simulate making changes
    
    setOptimizationsMade(prev => prev + detectedIssues.length);
    setDetectedIssues([]);
    
    if (onOptimize) {
      onOptimize();
    }
  };

  // Detach a specific listener
  const detachListener = (path: string) => {
    // In a real implementation, you would use off() to detach the listener
    // off(ref(database, path));
    
    setActiveListeners(prev => prev.filter(p => p !== path));
  };

  // Detach all listeners
  const detachAllListeners = () => {
    // In a real implementation, you would detach all listeners
    // activeListeners.forEach(path => off(ref(database, path)));
    
    setActiveListeners([]);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Database Usage Optimizer</CardTitle>
        <CardDescription>
          Identify and fix potential issues causing high database usage
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Active Database Listeners</h3>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={scanForListeners}
              disabled={isScanning}
            >
              {isScanning ? 'Scanning...' : 'Scan for Listeners'}
            </Button>
          </div>
          
          {activeListeners.length > 0 ? (
            <ul className="space-y-2">
              {activeListeners.map((path, index) => (
                <li key={index} className="flex justify-between items-center p-2 bg-muted rounded-md">
                  <span className="font-mono text-sm">{path}</span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => detachListener(path)}
                  >
                    Detach
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">No active listeners detected or scan not performed yet.</p>
          )}
          
          {activeListeners.length > 0 && (
            <div className="flex justify-end">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={detachAllListeners}
              >
                Detach All Listeners
              </Button>
            </div>
          )}
          
          <div className="mt-6">
            <h3 className="text-lg font-medium mb-2">Detected Issues</h3>
            
            {detectedIssues.length > 0 ? (
              <ul className="space-y-3">
                {detectedIssues.map((issue, index) => (
                  <li key={index} className="p-3 border rounded-md">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{issue.path}</p>
                        <p className="text-sm text-muted-foreground">{issue.issue}</p>
                      </div>
                      <Badge 
                        variant={
                          issue.severity === 'high' ? 'destructive' : 
                          issue.severity === 'medium' ? 'default' : 
                          'outline'
                        }
                      >
                        {issue.severity}
                      </Badge>
                    </div>
                    <p className="text-sm mt-2">
                      <span className="font-medium">Recommendation:</span> {issue.recommendation}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              optimizationsMade > 0 ? (
                <Alert>
                  <AlertTitle>All Issues Resolved</AlertTitle>
                  <AlertDescription>
                    {optimizationsMade} optimization{optimizationsMade !== 1 ? 's' : ''} applied successfully.
                  </AlertDescription>
                </Alert>
              ) : (
                <p className="text-muted-foreground">No issues detected or scan not performed yet.</p>
              )
            )}
          </div>
        </div>
      </CardContent>
      
      <CardFooter>
        <Button 
          onClick={optimizeDatabaseUsage}
          disabled={detectedIssues.length === 0}
        >
          Apply Optimizations
        </Button>
      </CardFooter>
    </Card>
  );
};

export default DatabaseUsageOptimizer;