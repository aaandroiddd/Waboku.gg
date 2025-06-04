import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Footer } from '@/components/Footer';
import { AlertTriangle, Database, Activity, Users, Clock, ArrowLeft, CheckCircle, XCircle } from 'lucide-react';
import { auditFirebaseConnections, fixFirebaseConnections, emergencyCleanup } from '@/lib/firebase-connection-audit';

interface AuditResult {
  activeListeners: number;
  persistentConnections: string[];
  recommendations: string[];
  potentialIssues: string[];
}

export default function DatabaseUsageAuditPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [adminSecret, setAdminSecret] = useState('');
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [lastAudit, setLastAudit] = useState<Date | null>(null);

  useEffect(() => {
    const secret = localStorage.getItem('admin_secret');
    if (secret) {
      setAdminSecret(secret);
      verifyAdmin(secret);
    }
  }, []);

  const verifyAdmin = async (secret: string) => {
    try {
      const response = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${secret}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setIsAuthorized(true);
        localStorage.setItem('admin_secret', secret);
      } else {
        setIsAuthorized(false);
        localStorage.removeItem('admin_secret');
        router.push('/admin');
      }
    } catch (error) {
      console.error('Error verifying admin:', error);
      setIsAuthorized(false);
      router.push('/admin');
    }
  };

  const runAudit = async () => {
    setLoading(true);
    try {
      const result = await auditFirebaseConnections();
      setAuditResult(result);
      setLastAudit(new Date());
    } catch (error) {
      console.error('Error running audit:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFixes = async () => {
    setFixing(true);
    try {
      await fixFirebaseConnections();
      // Re-run audit after fixes
      await runAudit();
    } catch (error) {
      console.error('Error applying fixes:', error);
    } finally {
      setFixing(false);
    }
  };

  const performEmergencyCleanup = async () => {
    setFixing(true);
    try {
      await emergencyCleanup();
      // Re-run audit after cleanup
      await runAudit();
    } catch (error) {
      console.error('Error performing emergency cleanup:', error);
    } finally {
      setFixing(false);
    }
  };

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="container mx-auto p-8 flex-grow">
          <Card className="p-6">
            <h1 className="text-2xl font-bold mb-4">Admin Authentication Required</h1>
            <div className="space-y-4">
              <input
                type="password"
                placeholder="Enter admin secret"
                className="w-full p-2 border rounded"
                onChange={(e) => setAdminSecret(e.target.value)}
              />
              <Button 
                onClick={() => verifyAdmin(adminSecret)}
                disabled={!adminSecret}
              >
                Verify Admin Access
              </Button>
            </div>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="container mx-auto p-8 flex-grow">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Button 
                onClick={() => router.push('/admin')} 
                variant="outline" 
                size="sm"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Admin
              </Button>
              <div>
                <h1 className="text-3xl font-bold">Database Usage Audit</h1>
                <p className="text-muted-foreground">
                  Identify and fix sources of excessive Realtime Database usage
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={runAudit} disabled={loading} variant="outline">
                {loading ? 'Running Audit...' : 'Run Audit'}
              </Button>
              {auditResult && (
                <>
                  <Button onClick={applyFixes} disabled={fixing} variant="default">
                    {fixing ? 'Applying Fixes...' : 'Apply Fixes'}
                  </Button>
                  <Button onClick={performEmergencyCleanup} disabled={fixing} variant="destructive">
                    Emergency Cleanup
                  </Button>
                </>
              )}
            </div>
          </div>

          {lastAudit && (
            <Alert className="mb-6">
              <Clock className="h-4 w-4" />
              <AlertTitle>Last Audit</AlertTitle>
              <AlertDescription>
                Audit completed at {lastAudit.toLocaleString()}
              </AlertDescription>
            </Alert>
          )}

          {auditResult && (
            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="issues">Issues Found</TabsTrigger>
                <TabsTrigger value="connections">Active Connections</TabsTrigger>
                <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Active Listeners</CardTitle>
                      <Database className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{auditResult.activeListeners}</div>
                      <p className="text-xs text-muted-foreground">
                        Currently active database listeners
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Persistent Connections</CardTitle>
                      <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{auditResult.persistentConnections.length}</div>
                      <p className="text-xs text-muted-foreground">
                        Always-on database connections
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Issues Found</CardTitle>
                      <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{auditResult.potentialIssues.length}</div>
                      <p className="text-xs text-muted-foreground">
                        Potential cost-causing issues
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Health Status</CardTitle>
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {auditResult.potentialIssues.length === 0 ? (
                          <Badge className="bg-green-500">Healthy</Badge>
                        ) : auditResult.potentialIssues.length < 3 ? (
                          <Badge className="bg-yellow-500">Warning</Badge>
                        ) : (
                          <Badge variant="destructive">Critical</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Overall database health
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {auditResult.potentialIssues.length > 0 && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>High Database Usage Detected</AlertTitle>
                    <AlertDescription>
                      Found {auditResult.potentialIssues.length} potential issues that may be causing 
                      excessive Realtime Database downloads and costs. Review the Issues tab for details.
                    </AlertDescription>
                  </Alert>
                )}
              </TabsContent>

              <TabsContent value="issues" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Potential Issues</CardTitle>
                    <CardDescription>
                      Issues that may be causing excessive database usage
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {auditResult.potentialIssues.length > 0 ? (
                      <div className="space-y-3">
                        {auditResult.potentialIssues.map((issue, index) => (
                          <div key={index} className="flex items-start gap-3 p-3 border rounded">
                            <XCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="font-medium text-red-700">{issue}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 p-3 border rounded bg-green-50">
                        <CheckCircle className="h-5 w-5 text-green-500" />
                        <p className="text-green-700">No issues detected! Your database usage appears optimized.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="connections" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Persistent Database Connections</CardTitle>
                    <CardDescription>
                      Always-on connections that may cause continuous downloads
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {auditResult.persistentConnections.length > 0 ? (
                      <div className="space-y-2">
                        {auditResult.persistentConnections.map((connection, index) => (
                          <div key={index} className="flex items-center justify-between p-2 border rounded">
                            <span className="font-mono text-sm">{connection}</span>
                            <Badge variant="outline">Persistent</Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">No persistent connections detected</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="recommendations" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Optimization Recommendations</CardTitle>
                    <CardDescription>
                      Steps to reduce Firebase Realtime Database costs
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {auditResult.recommendations.map((recommendation, index) => (
                        <div key={index} className="flex items-start gap-3 p-3 border rounded">
                          <CheckCircle className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                          <p>{recommendation}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}

          {!auditResult && !loading && (
            <Card>
              <CardHeader>
                <CardTitle>Database Usage Audit</CardTitle>
                <CardDescription>
                  Run an audit to identify sources of excessive Realtime Database usage
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  This audit will analyze your Firebase configuration and identify potential sources 
                  of high database usage that could be causing increased costs.
                </p>
                <Button onClick={runAudit}>
                  Start Audit
                </Button>
              </CardContent>
            </Card>
          )}
        </Card>
      </div>
      <Footer />
    </div>
  );
}