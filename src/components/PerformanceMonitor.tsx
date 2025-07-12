import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  Activity, 
  Clock, 
  Zap, 
  MemoryStick, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw
} from 'lucide-react';
import { 
  performanceOptimizer, 
  getCurrentMetrics, 
  getComponentMetrics, 
  getPerformanceRecommendations 
} from '@/lib/performance-optimizer';

interface PerformanceMonitorProps {
  showInProduction?: boolean;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  minimized?: boolean;
}

export function PerformanceMonitor({ 
  showInProduction = false, 
  position = 'bottom-right',
  minimized = true 
}: PerformanceMonitorProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isMinimized, setIsMinimized] = useState(minimized);
  const [metrics, setMetrics] = useState<any>(null);
  const [componentMetrics, setComponentMetrics] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  // Show only in development unless explicitly allowed in production
  const shouldShow = process.env.NODE_ENV === 'development' || showInProduction;

  // Position classes
  const positionClasses = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4'
  };

  // Refresh metrics
  const refreshMetrics = useCallback(() => {
    const currentMetrics = getCurrentMetrics();
    const components = getComponentMetrics();
    const recs = getPerformanceRecommendations();
    
    setMetrics(currentMetrics);
    setComponentMetrics(components);
    setRecommendations(recs);
  }, []);

  // Toggle visibility
  const toggleVisibility = useCallback(() => {
    setIsVisible(!isVisible);
    if (!isVisible) {
      refreshMetrics();
    }
  }, [isVisible, refreshMetrics]);

  // Toggle minimized state
  const toggleMinimized = useCallback(() => {
    setIsMinimized(!isMinimized);
    if (isMinimized) {
      refreshMetrics();
    }
  }, [isMinimized, refreshMetrics]);

  // Auto-refresh metrics when visible
  useEffect(() => {
    if (isVisible && !isMinimized) {
      refreshMetrics();
      const interval = setInterval(refreshMetrics, 5000); // Refresh every 5 seconds
      setRefreshInterval(interval);
      
      return () => {
        if (interval) clearInterval(interval);
      };
    } else {
      if (refreshInterval) {
        clearInterval(refreshInterval);
        setRefreshInterval(null);
      }
    }
  }, [isVisible, isMinimized, refreshMetrics, refreshInterval]);

  // Format memory size
  const formatMemorySize = (bytes: number) => {
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  };

  // Get performance score
  const getPerformanceScore = () => {
    if (!metrics) return 0;
    
    let score = 100;
    
    // Deduct points for slow load times
    if (metrics.loadComplete > 3000) score -= 20;
    else if (metrics.loadComplete > 2000) score -= 10;
    
    if (metrics.domContentLoaded > 1500) score -= 15;
    else if (metrics.domContentLoaded > 1000) score -= 8;
    
    // Deduct points for high memory usage
    if (metrics.memoryUsage) {
      const usage = (metrics.memoryUsage.usedJSHeapSize / metrics.memoryUsage.jsHeapSizeLimit) * 100;
      if (usage > 80) score -= 20;
      else if (usage > 60) score -= 10;
    }
    
    // Deduct points for slow components
    const slowComponents = componentMetrics.filter(c => c.averageRenderTime > 16);
    score -= slowComponents.length * 5;
    
    return Math.max(0, score);
  };

  if (!shouldShow) return null;

  return (
    <>
      {/* Toggle Button */}
      <Button
        onClick={toggleVisibility}
        className={`fixed z-50 ${positionClasses[position]} ${
          isVisible ? 'opacity-50' : 'opacity-80'
        } hover:opacity-100 transition-opacity`}
        size="sm"
        variant="outline"
      >
        <Activity className="h-4 w-4" />
      </Button>

      {/* Performance Monitor Panel */}
      {isVisible && (
        <Card className={`fixed z-40 ${positionClasses[position]} ${
          isMinimized ? 'w-80' : 'w-96'
        } max-h-[80vh] overflow-hidden shadow-lg border-2`}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Performance Monitor
              </CardTitle>
              <div className="flex gap-1">
                <Button
                  onClick={refreshMetrics}
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
                <Button
                  onClick={toggleMinimized}
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                >
                  {isMinimized ? <TrendingUp className="h-3 w-3" /> : <Activity className="h-3 w-3" />}
                </Button>
                <Button
                  onClick={() => setIsVisible(false)}
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                >
                  <XCircle className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-3">
            {isMinimized ? (
              // Minimized view - just show key metrics
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Performance Score</span>
                  <Badge variant={getPerformanceScore() > 80 ? 'default' : getPerformanceScore() > 60 ? 'secondary' : 'destructive'}>
                    {getPerformanceScore()}%
                  </Badge>
                </div>
                
                {metrics && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Load Time</span>
                      <span className="text-xs">{metrics.loadComplete.toFixed(0)}ms</span>
                    </div>
                    
                    {metrics.memoryUsage && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Memory</span>
                        <span className="text-xs">
                          {formatMemorySize(metrics.memoryUsage.usedJSHeapSize)}
                        </span>
                      </div>
                    )}
                  </>
                )}
                
                {recommendations.length > 0 && (
                  <div className="flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 text-yellow-500" />
                    <span className="text-xs text-yellow-600">
                      {recommendations.length} recommendations
                    </span>
                  </div>
                )}
              </div>
            ) : (
              // Full view
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-3 text-xs">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="components">Components</TabsTrigger>
                  <TabsTrigger value="recommendations">Tips</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-3 mt-3">
                  {/* Performance Score */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Performance Score</span>
                      <Badge variant={getPerformanceScore() > 80 ? 'default' : getPerformanceScore() > 60 ? 'secondary' : 'destructive'}>
                        {getPerformanceScore()}%
                      </Badge>
                    </div>
                    <Progress value={getPerformanceScore()} className="h-2" />
                  </div>

                  {metrics && (
                    <>
                      {/* Load Times */}
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Load Times
                        </h4>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-muted-foreground">DOM Ready:</span>
                            <span className="ml-1 font-mono">{metrics.domContentLoaded.toFixed(0)}ms</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Load Complete:</span>
                            <span className="ml-1 font-mono">{metrics.loadComplete.toFixed(0)}ms</span>
                          </div>
                          {metrics.firstContentfulPaint && (
                            <div>
                              <span className="text-muted-foreground">FCP:</span>
                              <span className="ml-1 font-mono">{metrics.firstContentfulPaint.toFixed(0)}ms</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Memory Usage */}
                      {metrics.memoryUsage && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium flex items-center gap-1">
                            <MemoryStick className="h-3 w-3" />
                            Memory Usage
                          </h4>
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span>Used: {formatMemorySize(metrics.memoryUsage.usedJSHeapSize)}</span>
                              <span>Limit: {formatMemorySize(metrics.memoryUsage.jsHeapSizeLimit)}</span>
                            </div>
                            <Progress 
                              value={(metrics.memoryUsage.usedJSHeapSize / metrics.memoryUsage.jsHeapSizeLimit) * 100} 
                              className="h-2" 
                            />
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </TabsContent>

                <TabsContent value="components" className="space-y-3 mt-3">
                  <h4 className="text-sm font-medium flex items-center gap-1">
                    <Zap className="h-3 w-3" />
                    Component Performance
                  </h4>
                  
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {componentMetrics.length > 0 ? (
                      componentMetrics
                        .sort((a, b) => b.averageRenderTime - a.averageRenderTime)
                        .slice(0, 10)
                        .map((component, index) => (
                          <div key={component.componentName} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1">
                              {component.averageRenderTime > 16 ? (
                                <AlertTriangle className="h-3 w-3 text-yellow-500" />
                              ) : (
                                <CheckCircle className="h-3 w-3 text-green-500" />
                              )}
                              <span className="truncate max-w-32">{component.componentName}</span>
                            </div>
                            <div className="text-right">
                              <div>{component.averageRenderTime.toFixed(1)}ms</div>
                              <div className="text-muted-foreground">({component.renderCount} renders)</div>
                            </div>
                          </div>
                        ))
                    ) : (
                      <p className="text-xs text-muted-foreground">No component metrics available</p>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="recommendations" className="space-y-3 mt-3">
                  <h4 className="text-sm font-medium flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    Recommendations
                  </h4>
                  
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {recommendations.length > 0 ? (
                      recommendations.map((recommendation, index) => (
                        <div key={index} className="flex items-start gap-2 text-xs">
                          <AlertTriangle className="h-3 w-3 text-yellow-500 mt-0.5 flex-shrink-0" />
                          <span>{recommendation}</span>
                        </div>
                      ))
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-green-600">
                        <CheckCircle className="h-3 w-3" />
                        <span>No performance issues detected!</span>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}