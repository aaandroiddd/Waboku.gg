import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Database, 
  RefreshCw,
  TrendingUp,
  Users,
  Archive,
  Zap
} from "lucide-react";

interface DiagnosticResult {
  success: boolean;
  diagnostic?: {
    timestamp: string;
    summary: {
      totalListings: number;
      statusDistribution: Record<string, number>;
      tierDistribution: Record<string, number>;
      ttlStatistics: Record<string, number>;
      issuesFound: Record<string, number>;
    };
    issues: {
      expiration: Array<any>;
      ttl: Array<any>;
      visibility: Array<any>;
    };
    systemStatus: {
      cronJobs: Record<string, string>;
      ttlPolicy: Record<string, string>;
      performance: Record<string, string>;
    };
    recommendations: Array<{
      priority: string;
      issue: string;
      action: string;
      endpoint: string;
    }>;
  };
  error?: string;
}

export function ListingProcessDiagnostic() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiagnosticResult | null>(null);

  const runDiagnostic = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/listing-process-diagnostic', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_ADMIN_SECRET}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Error running diagnostic:', error);
      setResult({
        success: false,
        error: 'Failed to run diagnostic'
      });
    } finally {
      setLoading(false);
    }
  };

  const executeRecommendation = async (endpoint: string) => {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_ADMIN_SECRET}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      console.log('Recommendation executed:', data);
      
      // Re-run diagnostic after executing recommendation
      setTimeout(() => runDiagnostic(), 2000);
    } catch (error) {
      console.error('Error executing recommendation:', error);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH': return 'destructive';
      case 'MEDIUM': return 'default';
      case 'LOW': return 'secondary';
      default: return 'outline';
    }
  };

  const getStatusIcon = (count: number) => {
    if (count === 0) return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (count < 5) return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    return <AlertTriangle className="h-4 w-4 text-red-500" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Listing Process Diagnostic</h3>
          <p className="text-sm text-muted-foreground">
            Comprehensive analysis of the listing lifecycle, expiration, and cleanup processes
          </p>
        </div>
        <Button 
          onClick={runDiagnostic} 
          disabled={loading}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Running...' : 'Run Diagnostic'}
        </Button>
      </div>

      {result && (
        <div className="space-y-6">
          {!result.success ? (
            <Alert className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-red-800 dark:text-red-200">
                {result.error}
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Listings</CardTitle>
                    <Database className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{result.diagnostic?.summary.totalListings}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active Listings</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      {result.diagnostic?.summary.statusDistribution.active || 0}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Archived Listings</CardTitle>
                    <Archive className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-orange-600">
                      {result.diagnostic?.summary.statusDistribution.archived || 0}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Premium Users</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-purple-600">
                      {result.diagnostic?.summary.tierDistribution.premium || 0}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Issues Overview */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Issues Found
                  </CardTitle>
                  <CardDescription>
                    Critical issues that need attention in the listing process
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="text-sm font-medium">Expiration Issues</p>
                        <p className="text-xs text-muted-foreground">Active listings that should be expired</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(result.diagnostic?.summary.issuesFound.expiration || 0)}
                        <span className="font-bold">{result.diagnostic?.summary.issuesFound.expiration || 0}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="text-sm font-medium">TTL Issues</p>
                        <p className="text-xs text-muted-foreground">Problems with automatic deletion</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(result.diagnostic?.summary.issuesFound.ttl || 0)}
                        <span className="font-bold">{result.diagnostic?.summary.issuesFound.ttl || 0}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="text-sm font-medium">Visibility Issues</p>
                        <p className="text-xs text-muted-foreground">Archived listings showing publicly</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(result.diagnostic?.summary.issuesFound.visibility || 0)}
                        <span className="font-bold">{result.diagnostic?.summary.issuesFound.visibility || 0}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Recommendations */}
              {result.diagnostic?.recommendations && result.diagnostic.recommendations.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="h-5 w-5" />
                      Recommended Actions
                    </CardTitle>
                    <CardDescription>
                      Automated fixes for identified issues
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {result.diagnostic.recommendations.map((rec, index) => (
                        <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant={getPriorityColor(rec.priority) as any}>
                                {rec.priority}
                              </Badge>
                              <span className="font-medium">{rec.issue}</span>
                            </div>
                            <p className="text-sm text-muted-foreground">{rec.action}</p>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => executeRecommendation(rec.endpoint)}
                            className="ml-4"
                          >
                            Fix Now
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* TTL Statistics */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    TTL Statistics
                  </CardTitle>
                  <CardDescription>
                    Automatic deletion system status
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {result.diagnostic?.summary.ttlStatistics.withTTL || 0}
                      </div>
                      <p className="text-xs text-muted-foreground">With TTL</p>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">
                        {result.diagnostic?.summary.ttlStatistics.withoutTTL || 0}
                      </div>
                      <p className="text-xs text-muted-foreground">Without TTL</p>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">
                        {result.diagnostic?.summary.ttlStatistics.expiredTTL || 0}
                      </div>
                      <p className="text-xs text-muted-foreground">Expired TTL</p>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {result.diagnostic?.summary.ttlStatistics.validTTL || 0}
                      </div>
                      <p className="text-xs text-muted-foreground">Valid TTL</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Detailed Issues */}
              {(result.diagnostic?.issues.expiration.length > 0 || 
                result.diagnostic?.issues.ttl.length > 0 || 
                result.diagnostic?.issues.visibility.length > 0) && (
                <Card>
                  <CardHeader>
                    <CardTitle>Detailed Issues</CardTitle>
                    <CardDescription>
                      Specific listings with problems (showing first 10 of each type)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-4">
                        {result.diagnostic.issues.expiration.length > 0 && (
                          <div>
                            <h4 className="font-medium text-red-600 mb-2">Expiration Issues</h4>
                            <div className="space-y-2">
                              {result.diagnostic.issues.expiration.map((issue, index) => (
                                <div key={index} className="p-2 bg-red-50 dark:bg-red-950 rounded text-sm">
                                  <p><strong>ID:</strong> {issue.id}</p>
                                  <p><strong>Issue:</strong> {issue.issue}</p>
                                  {issue.hoursOverdue && <p><strong>Hours Overdue:</strong> {issue.hoursOverdue}</p>}
                                  <p><strong>Account Tier:</strong> {issue.accountTier}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {result.diagnostic.issues.ttl.length > 0 && (
                          <div>
                            <h4 className="font-medium text-orange-600 mb-2">TTL Issues</h4>
                            <div className="space-y-2">
                              {result.diagnostic.issues.ttl.map((issue, index) => (
                                <div key={index} className="p-2 bg-orange-50 dark:bg-orange-950 rounded text-sm">
                                  <p><strong>ID:</strong> {issue.id}</p>
                                  <p><strong>Issue:</strong> {issue.issue}</p>
                                  <p><strong>Status:</strong> {issue.status}</p>
                                  <p><strong>Account Tier:</strong> {issue.accountTier}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {result.diagnostic.issues.visibility.length > 0 && (
                          <div>
                            <h4 className="font-medium text-yellow-600 mb-2">Visibility Issues</h4>
                            <div className="space-y-2">
                              {result.diagnostic.issues.visibility.map((issue, index) => (
                                <div key={index} className="p-2 bg-yellow-50 dark:bg-yellow-950 rounded text-sm">
                                  <p><strong>ID:</strong> {issue.id}</p>
                                  <p><strong>Issue:</strong> {issue.issue}</p>
                                  <p><strong>Account Tier:</strong> {issue.accountTier}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}

              {/* System Status */}
              <Card>
                <CardHeader>
                  <CardTitle>System Status</CardTitle>
                  <CardDescription>
                    Current status of automated systems
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">Cron Jobs</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                        <div className="p-2 border rounded">
                          <p className="font-medium">Archive Expired</p>
                          <p className="text-muted-foreground">Hourly (0 * * * *)</p>
                        </div>
                        <div className="p-2 border rounded">
                          <p className="font-medium">TTL Cleanup</p>
                          <p className="text-muted-foreground">Every 2 hours (15 */2 * * *)</p>
                        </div>
                        <div className="p-2 border rounded">
                          <p className="font-medium">Related Data Cleanup</p>
                          <p className="text-muted-foreground">Every 4 hours (30 */4 * * *)</p>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <h4 className="font-medium mb-2">TTL Policy</h4>
                      <div className="p-2 border rounded text-sm">
                        <p><strong>Field:</strong> {result.diagnostic?.systemStatus.ttlPolicy.field}</p>
                        <p className="text-muted-foreground">
                          TTL policies are configured in Firestore console and handle automatic deletion
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="text-xs text-muted-foreground">
                Last diagnostic run: {new Date(result.diagnostic?.timestamp || '').toLocaleString()}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}