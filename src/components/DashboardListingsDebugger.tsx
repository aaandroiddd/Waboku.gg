import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { RefreshCw, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

interface DiagnosticResult {
  test: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: any;
}

interface DashboardListingsDebuggerProps {
  onRefreshListings?: () => void;
}

export default function DashboardListingsDebugger({ onRefreshListings }: DashboardListingsDebuggerProps) {
  const { user } = useAuth();
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [autoFixApplied, setAutoFixApplied] = useState(false);

  const runDiagnostics = async () => {
    if (!user) return;
    
    setIsRunning(true);
    const results: DiagnosticResult[] = [];

    try {
      // Test 1: Check authentication state
      results.push({
        test: 'Authentication State',
        status: user ? 'pass' : 'fail',
        message: user ? `User authenticated: ${user.email}` : 'User not authenticated',
        details: { uid: user?.uid, email: user?.email }
      });

      // Test 2: Check localStorage cache - use actual cache keys
      const actualCacheKeys = [
        `dashboard_data_${user.uid}`, // From useDashboardCache
        `listings_${user.uid}_all_none`, // From useOptimizedListings (all listings)
        `listings_${user.uid}_active_none`, // From useOptimizedListings (active only)
        'force_listings_refresh' // This one is correct
      ];
      
      // Also check for any other listing-related cache keys
      const allCacheKeys = Object.keys(localStorage).filter(key => 
        key.startsWith('listings_') || 
        key.startsWith('dashboard_') || 
        key.includes('force_listings_refresh') ||
        key.includes('dashboard_last_refresh') ||
        key.includes('listings_last_fetch')
      );
      
      const cacheStatus = actualCacheKeys.map(key => ({
        key,
        exists: localStorage.getItem(key) !== null,
        value: localStorage.getItem(key)
      }));

      results.push({
        test: 'Cache State',
        status: cacheStatus.some(c => c.exists) ? 'pass' : 'warning',
        message: `Found ${cacheStatus.filter(c => c.exists).length}/${actualCacheKeys.length} expected cache entries`,
        details: {
          expectedCaches: cacheStatus,
          allListingCaches: allCacheKeys.map(key => ({
            key,
            exists: true,
            value: localStorage.getItem(key)
          }))
        }
      });
=======

      // Test 3: Check Firebase connection
      try {
        const { db } = await import('@/lib/firebase');
        const { collection, query, where, limit, getDocs } = await import('firebase/firestore');
        
        const testQuery = query(
          collection(db, 'listings'),
          where('userId', '==', user.uid),
          where('status', '==', 'active'),
          limit(1)
        );
        
        const snapshot = await getDocs(testQuery);
        
        results.push({
          test: 'Firebase Connection',
          status: 'pass',
          message: `Firebase query successful. Found ${snapshot.size} test listing(s)`,
          details: { querySize: snapshot.size }
        });
      } catch (error) {
        results.push({
          test: 'Firebase Connection',
          status: 'fail',
          message: `Firebase query failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          details: { error: error instanceof Error ? error.message : error }
        });
      }

      // Test 4: Check for stale data indicators
      const staleIndicators = [
        localStorage.getItem('dashboard_last_refresh'),
        localStorage.getItem('listings_last_fetch'),
        sessionStorage.getItem('dashboard_initialized')
      ];

      const now = Date.now();
      const staleThreshold = 5 * 60 * 1000; // 5 minutes
      
      let staleCount = 0;
      staleIndicators.forEach((timestamp, index) => {
        if (timestamp && (now - parseInt(timestamp)) > staleThreshold) {
          staleCount++;
        }
      });

      results.push({
        test: 'Data Freshness',
        status: staleCount > 0 ? 'warning' : 'pass',
        message: `${staleCount} stale data indicators found`,
        details: { staleCount, staleIndicators }
      });

      // Test 5: Check for concurrent fetch flags
      const concurrentFlags = [
        'listings_fetching',
        'dashboard_loading',
        'cache_updating'
      ].map(flag => ({
        flag,
        active: sessionStorage.getItem(flag) === 'true'
      }));

      const activeFetches = concurrentFlags.filter(f => f.active).length;
      
      results.push({
        test: 'Concurrent Operations',
        status: activeFetches > 1 ? 'warning' : 'pass',
        message: `${activeFetches} concurrent operations detected`,
        details: concurrentFlags
      });

    } catch (error) {
      results.push({
        test: 'Diagnostic Error',
        status: 'fail',
        message: `Diagnostic failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error }
      });
    }

    setDiagnostics(results);
    setIsRunning(false);
  };

  const applyAutoFix = async () => {
    if (!user) return;

    try {
      // Clear all actual cache keys used by the system
      const actualCacheKeys = [
        `dashboard_data_${user.uid}`, // From useDashboardCache
        `listings_${user.uid}_all_none`, // From useOptimizedListings
        `listings_${user.uid}_active_none`, // From useOptimizedListings
        'dashboard_last_refresh',
        'listings_last_fetch'
      ];
      
      // Also clear any other listing-related cache keys
      const allCacheKeys = Object.keys(localStorage).filter(key => 
        key.startsWith('listings_') || 
        key.startsWith('dashboard_') || 
        key.includes('force_listings_refresh') ||
        key.includes('dashboard_last_refresh') ||
        key.includes('listings_last_fetch')
      );
      
      // Combine and deduplicate cache keys to clear
      const keysToRemove = [...new Set([...actualCacheKeys, ...allCacheKeys])];
      
      console.log('Auto-fix: Clearing cache keys:', keysToRemove);
      keysToRemove.forEach(key => localStorage.removeItem(key));

      // Clear session flags
      const sessionKeys = [
        'dashboard_initialized',
        'listings_fetching',
        'dashboard_loading',
        'cache_updating'
      ];
      
      sessionKeys.forEach(key => sessionStorage.removeItem(key));

      // Set refresh flag
      localStorage.setItem('force_listings_refresh', 'true');
      localStorage.setItem('dashboard_last_refresh', Date.now().toString());

      setAutoFixApplied(true);

      // Trigger refresh if callback provided
      if (onRefreshListings) {
        setTimeout(() => {
          onRefreshListings();
        }, 100);
      }

      // Re-run diagnostics after fix
      setTimeout(() => {
        runDiagnostics();
      }, 500);

    } catch (error) {
      console.error('Auto-fix failed:', error);
    }
  };
=======

  const getStatusIcon = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'fail':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'pass':
        return 'bg-green-100 text-green-800';
      case 'fail':
        return 'bg-red-100 text-red-800';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  useEffect(() => {
    // Auto-run diagnostics on mount if user is available
    if (user) {
      runDiagnostics();
    }
  }, [user]);

  if (!user) {
    return null;
  }

  const hasIssues = diagnostics.some(d => d.status === 'fail' || d.status === 'warning');

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Dashboard Listings Diagnostics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button 
            onClick={runDiagnostics} 
            disabled={isRunning}
            variant="outline"
            size="sm"
          >
            {isRunning ? 'Running...' : 'Run Diagnostics'}
          </Button>
          
          {hasIssues && (
            <Button 
              onClick={applyAutoFix}
              variant="default"
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
            >
              Apply Auto-Fix
            </Button>
          )}
        </div>

        {autoFixApplied && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-800">
              Auto-fix applied! Caches cleared and refresh triggered.
            </p>
          </div>
        )}

        {diagnostics.length > 0 && (
          <div className="space-y-3">
            <Separator />
            <h4 className="font-medium">Diagnostic Results</h4>
            
            {diagnostics.map((result, index) => (
              <div key={index} className="flex items-start gap-3 p-3 border rounded-md">
                {getStatusIcon(result.status)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{result.test}</span>
                    <Badge className={`text-xs ${getStatusColor(result.status)}`}>
                      {result.status.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600">{result.message}</p>
                  {result.details && (
                    <details className="mt-2">
                      <summary className="text-xs text-gray-500 cursor-pointer">
                        View Details
                      </summary>
                      <pre className="text-xs bg-gray-50 p-2 rounded mt-1 overflow-auto">
                        {JSON.stringify(result.details, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}