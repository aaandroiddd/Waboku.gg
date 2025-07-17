import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertTriangle, CheckCircle, User, Database } from 'lucide-react';

interface ListingSample {
  id: string;
  userId: string;
  username: string;
  looksLikeUserId: boolean;
  actualUsername?: string;
  title: string;
}

interface FixResults {
  checked: number;
  fixed: number;
  errors: string[];
}

export default function ProductionUsernameDebugger() {
  const [sample, setSample] = useState<ListingSample[]>([]);
  const [fixResults, setFixResults] = useState<FixResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const callProductionAPI = async (action: string, data: any = {}) => {
    const adminSecret = localStorage.getItem('adminSecret');
    if (!adminSecret) {
      throw new Error('Admin secret not found. Please log in again.');
    }

    const response = await fetch('/api/admin/fix-production-usernames', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminSecret}`
      },
      body: JSON.stringify({ action, ...data })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    return response.json();
  };

  const fetchSample = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await callProductionAPI('sample', { limit: 20 });
      setSample(result.sample || []);
    } catch (err: any) {
      setError(`Failed to fetch sample: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fixAllUsernames = async () => {
    setLoading(true);
    setError(null);
    setFixResults(null);
    try {
      const result = await callProductionAPI('check', { limit: 100 });
      setFixResults(result);
    } catch (err: any) {
      setError(`Failed to fix usernames: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fixSampleIssues = async () => {
    const problematicIds = sample
      .filter(item => item.looksLikeUserId)
      .map(item => item.id);

    if (problematicIds.length === 0) {
      setError('No problematic listings found in sample');
      return;
    }

    setLoading(true);
    setError(null);
    setFixResults(null);
    try {
      const result = await callProductionAPI('fix-specific', { listingIds: problematicIds });
      setFixResults(result);
      // Refresh sample to see changes
      await fetchSample();
    } catch (err: any) {
      setError(`Failed to fix sample issues: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const problematicCount = sample.filter(item => item.looksLikeUserId).length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Production Username Debugger
          </CardTitle>
          <CardDescription>
            Fix listings in production that show user IDs instead of usernames. This tool directly accesses the production database.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Button 
              onClick={fetchSample} 
              disabled={loading}
              variant="outline"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Get Sample (20 listings)
            </Button>
            
            <Button 
              onClick={fixAllUsernames} 
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Check & Fix All (100 listings)
            </Button>
            
            {problematicCount > 0 && (
              <Button 
                onClick={fixSampleIssues} 
                disabled={loading}
                variant="destructive"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Fix Sample Issues ({problematicCount})
              </Button>
            )}
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {fixResults && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="font-semibold">Fix Results</div>
                <div>Checked: {fixResults.checked} listings</div>
                <div>Fixed: {fixResults.fixed} listings</div>
                {fixResults.errors.length > 0 && (
                  <div className="mt-2">
                    <div className="font-semibold text-red-600">Errors:</div>
                    <ul className="list-disc list-inside text-sm">
                      {fixResults.errors.slice(0, 5).map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                      {fixResults.errors.length > 5 && (
                        <li>... and {fixResults.errors.length - 5} more errors</li>
                      )}
                    </ul>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {sample.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Sample Results</CardTitle>
            <CardDescription>
              {problematicCount > 0 ? (
                <span className="text-red-600">
                  Found {problematicCount} listings with user ID usernames out of {sample.length} checked
                </span>
              ) : (
                <span className="text-green-600">
                  All {sample.length} listings have proper usernames
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sample.map((item) => (
                <div 
                  key={item.id} 
                  className={`p-3 rounded-lg border ${
                    item.looksLikeUserId ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={item.looksLikeUserId ? 'destructive' : 'default'}>
                          {item.looksLikeUserId ? 'Needs Fix' : 'OK'}
                        </Badge>
                        <span className="text-sm text-gray-500">ID: {item.id}</span>
                      </div>
                      
                      <div className="text-sm font-medium mb-1">{item.title}</div>
                      
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-3 w-3" />
                        <span>Current: <code className="bg-gray-100 px-1 rounded">{item.username}</code></span>
                        {item.actualUsername && item.actualUsername !== item.username && (
                          <span>→ Should be: <code className="bg-blue-100 px-1 rounded">{item.actualUsername}</code></span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}