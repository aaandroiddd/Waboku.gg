import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MobileSelect } from '@/components/ui/mobile-select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertCircle, CheckCircle, Info } from 'lucide-react';

interface TTLValidationResult {
  success: boolean;
  message: string;
  summary: {
    collection: string;
    totalChecked: number;
    totalIssues: number;
    totalFixed: number;
    dryRun: boolean;
    timestamp: string;
  };
  issues: Array<{
    documentId: string;
    collection: string;
    issues: string[];
    status: string;
    hasDeleteAt: boolean;
    hasArchivedAt: boolean;
    hasExpiredAt: boolean;
    fixed: boolean;
    error?: string;
  }>;
  hasMoreIssues: boolean;
}

export function TTLFieldValidator() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<TTLValidationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [collection, setCollection] = useState('listings');
  const [dryRun, setDryRun] = useState(true);

  const validateTTLFields = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    
    try {
      const adminSecret = localStorage.getItem('admin_secret');
      if (!adminSecret) {
        throw new Error('Admin secret not found');
      }

      const response = await fetch('/api/admin/validate-ttl-fields', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminSecret}`
        },
        body: JSON.stringify({
          collection,
          dryRun
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || data.details || 'Failed to validate TTL fields');
      }
      
      setResult(data);
    } catch (err: any) {
      console.error('Error validating TTL fields:', err);
      setError(err.message || 'An error occurred while validating TTL fields');
    } finally {
      setIsLoading(false);
    }
  };

  const getIssueIcon = (issue: string) => {
    if (issue.includes('null')) {
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
    if (issue.includes('missing')) {
      return <Info className="h-4 w-4 text-yellow-500" />;
    }
    return <AlertCircle className="h-4 w-4 text-orange-500" />;
  };

  const getStatusBadge = (status: string) => {
    const statusColors = {
      active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      archived: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
      expired: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      pending: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      declined: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      accepted: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
    };

    return (
      <Badge className={statusColors[status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800'}>
        {status}
      </Badge>
    );
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>TTL Field Validator</CardTitle>
        <CardDescription>
          Validate and fix TTL field management across Firestore collections. 
          This tool identifies fields set to null instead of using FieldValue.delete() 
          and can automatically fix them.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="collection">Collection</Label>
            <MobileSelect
              value={collection}
              onValueChange={setCollection}
              placeholder="Select collection"
              options={[
                { value: "listings", label: "Listings" },
                { value: "offers", label: "Offers" },
                { value: "orders", label: "Orders" },
                { value: "users", label: "Users" }
              ]}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dryRun">Mode</Label>
            <MobileSelect
              value={dryRun ? 'true' : 'false'}
              onValueChange={(value) => setDryRun(value === 'true')}
              placeholder="Select mode"
              options={[
                { value: "true", label: "Dry Run (Analysis Only)" },
                { value: "false", label: "Fix Issues (Apply Changes)" }
              ]}
            />
          </div>
        </div>

        {dryRun ? (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Dry Run Mode</AlertTitle>
            <AlertDescription>
              This will analyze TTL fields without making any changes. 
              Switch to "Fix Issues" mode to apply corrections.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Fix Mode - Caution</AlertTitle>
            <AlertDescription>
              This will modify documents in the {collection} collection. 
              TTL fields set to null will be properly deleted using FieldValue.delete().
            </AlertDescription>
          </Alert>
        )}

        {result && (
          <div className="space-y-4">
            <Alert variant={result.success ? "default" : "destructive"}>
              {result.success ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertTitle>
                {result.success ? "Validation Complete" : "Validation Failed"}
              </AlertTitle>
              <AlertDescription>{result.message}</AlertDescription>
            </Alert>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="p-3">
                <div className="text-2xl font-bold text-blue-600">{result.summary.totalChecked}</div>
                <div className="text-sm text-muted-foreground">Documents Checked</div>
              </Card>
              <Card className="p-3">
                <div className="text-2xl font-bold text-orange-600">{result.summary.totalIssues}</div>
                <div className="text-sm text-muted-foreground">Issues Found</div>
              </Card>
              <Card className="p-3">
                <div className="text-2xl font-bold text-green-600">{result.summary.totalFixed}</div>
                <div className="text-sm text-muted-foreground">Issues Fixed</div>
              </Card>
              <Card className="p-3">
                <div className="text-2xl font-bold text-purple-600">
                  {result.summary.totalIssues > 0 
                    ? Math.round((result.summary.totalFixed / result.summary.totalIssues) * 100)
                    : 100}%
                </div>
                <div className="text-sm text-muted-foreground">Success Rate</div>
              </Card>
            </div>

            {result.issues.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Issues Found</h3>
                  {result.hasMoreIssues && (
                    <Badge variant="outline">
                      Showing first 50 issues
                    </Badge>
                  )}
                </div>
                
                <ScrollArea className="max-h-[400px]">
                  <div className="space-y-3">
                    {result.issues.map((issue, index) => (
                      <Card key={index} className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <code className="text-sm bg-muted px-2 py-1 rounded">
                              {issue.documentId}
                            </code>
                            {getStatusBadge(issue.status)}
                            {issue.fixed && (
                              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                Fixed
                              </Badge>
                            )}
                          </div>
                          <div className="flex gap-1">
                            {issue.hasDeleteAt && <Badge variant="outline" className="text-xs">deleteAt</Badge>}
                            {issue.hasArchivedAt && <Badge variant="outline" className="text-xs">archivedAt</Badge>}
                            {issue.hasExpiredAt && <Badge variant="outline" className="text-xs">expiredAt</Badge>}
                          </div>
                        </div>
                        
                        <div className="space-y-1">
                          {issue.issues.map((issueText, issueIndex) => (
                            <div key={issueIndex} className="flex items-center gap-2 text-sm">
                              {getIssueIcon(issueText)}
                              <span>{issueText}</span>
                            </div>
                          ))}
                        </div>

                        {issue.error && (
                          <div className="mt-2 text-sm text-red-600 dark:text-red-400">
                            Error: {issue.error}
                          </div>
                        )}
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button 
          onClick={validateTTLFields} 
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {dryRun ? 'Analyzing...' : 'Fixing...'}
            </>
          ) : (
            dryRun ? 'Analyze TTL Fields' : 'Fix TTL Fields'
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}