import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, AlertCircle, CheckCircle, RefreshCw, Database, FileText } from "lucide-react";

export function WantedPostsDebugger() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('check');

  const checkPaths = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    
    try {
      const response = await fetch('/api/wanted/fix-paths');
      if (!response.ok) {
        throw new Error(`API returned status ${response.status}`);
      }
      
      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const migrateData = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    
    try {
      const response = await fetch('/api/wanted/migrate-posts');
      if (!response.ok) {
        throw new Error(`API returned status ${response.status}`);
      }
      
      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const createTestPost = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    
    try {
      const response = await fetch('/api/wanted/create-simple', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: "Test Wanted Post",
          description: "This is a test wanted post created from the debugger",
          game: "pokemon",
          condition: "near_mint",
          isPriceNegotiable: true,
          priceRange: {
            min: 10,
            max: 50
          },
          location: "California, USA"
        }),
      });
      
      if (!response.ok) {
        throw new Error(`API returned status ${response.status}`);
      }
      
      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Wanted Posts Debugger
        </CardTitle>
        <CardDescription>
          Diagnose and fix issues with wanted posts database paths
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="check">Check Paths</TabsTrigger>
            <TabsTrigger value="migrate">Migrate Data</TabsTrigger>
            <TabsTrigger value="create">Create Test Post</TabsTrigger>
          </TabsList>
          
          <TabsContent value="check">
            <p className="mb-4 text-sm text-muted-foreground">
              Check all database paths for wanted posts and diagnose any issues.
            </p>
            <Button 
              onClick={checkPaths} 
              disabled={isLoading}
              className="mb-4"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Check Database Paths
                </>
              )}
            </Button>
          </TabsContent>
          
          <TabsContent value="migrate">
            <p className="mb-4 text-sm text-muted-foreground">
              Migrate wanted posts from old paths to the new standardized path structure.
            </p>
            <Button 
              onClick={migrateData} 
              disabled={isLoading}
              className="mb-4"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Migrating...
                </>
              ) : (
                <>
                  <Database className="mr-2 h-4 w-4" />
                  Migrate Posts
                </>
              )}
            </Button>
          </TabsContent>
          
          <TabsContent value="create">
            <p className="mb-4 text-sm text-muted-foreground">
              Create a test wanted post to verify the database is working correctly.
            </p>
            <Button 
              onClick={createTestPost} 
              disabled={isLoading}
              className="mb-4"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  Create Test Post
                </>
              )}
            </Button>
          </TabsContent>
        </Tabs>
        
        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {result && (
          <div className="mt-4">
            <Alert variant="default" className="bg-muted">
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>Result</AlertTitle>
              <AlertDescription>
                {result.message || 'Operation completed successfully'}
              </AlertDescription>
            </Alert>
            
            <div className="mt-4 space-y-4">
              {activeTab === 'check' && result.pathResults && (
                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Path Check Results:</h4>
                  
                  {Object.entries(result.pathResults).map(([path, data]: [string, any]) => (
                    <div key={path} className="rounded-md border p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-sm">{path}</span>
                        {data.exists ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            Exists
                          </Badge>
                        ) : data.error ? (
                          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                            Error
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                            Not Found
                          </Badge>
                        )}
                      </div>
                      
                      {data.count !== undefined && (
                        <p className="text-sm text-muted-foreground">
                          Found {data.count} posts
                        </p>
                      )}
                      
                      {data.error && (
                        <p className="text-sm text-red-600 mt-1">
                          {data.error}
                        </p>
                      )}
                    </div>
                  ))}
                  
                  {result.testPostCreated && (
                    <Alert className="bg-green-50 text-green-700 border-green-200">
                      <CheckCircle className="h-4 w-4" />
                      <AlertTitle>Test Post Created</AlertTitle>
                      <AlertDescription className="font-mono text-xs">
                        ID: {result.testPostCreated.postId}
                        <br />
                        Path: {result.testPostCreated.path}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
              
              {activeTab === 'migrate' && result.results && (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2 mb-4">
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                      Found: {result.results.postsFound || 0}
                    </Badge>
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      Migrated: {result.results.postsMigrated || 0}
                    </Badge>
                    {result.results.errors > 0 && (
                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                        Errors: {result.results.errors}
                      </Badge>
                    )}
                  </div>
                  
                  <h4 className="text-sm font-medium">Paths with Posts:</h4>
                  <div className="space-y-2">
                    {result.results.pathsWithPosts && result.results.pathsWithPosts.length > 0 ? (
                      result.results.pathsWithPosts.map((path: string) => (
                        <div key={path} className="rounded-md border p-3">
                          <span className="font-mono text-sm">{path}</span>
                          {result.results.details && result.results.details[path] && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {result.results.details[path].count} posts
                            </p>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No paths with posts found</p>
                    )}
                  </div>
                  
                  {result.results.testPostCreated && (
                    <Alert className="bg-green-50 text-green-700 border-green-200">
                      <CheckCircle className="h-4 w-4" />
                      <AlertTitle>Test Post Created</AlertTitle>
                      <AlertDescription className="font-mono text-xs">
                        ID: {result.results.testPostCreated.id}
                        <br />
                        Path: {result.results.testPostCreated.path}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
              
              {activeTab === 'create' && (
                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Test Post Created:</h4>
                  {result.postId ? (
                    <Alert className="bg-green-50 text-green-700 border-green-200">
                      <CheckCircle className="h-4 w-4" />
                      <AlertTitle>Success</AlertTitle>
                      <AlertDescription className="font-mono text-xs">
                        Post ID: {result.postId}
                        <br />
                        Path: wanted/posts/{result.postId}
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <p className="text-sm text-muted-foreground">No post ID returned</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between border-t pt-4">
        <p className="text-xs text-muted-foreground">
          Database URL: {process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ? '✓ Configured' : '✗ Missing'}
        </p>
        <Button variant="outline" size="sm" onClick={() => window.location.href = '/wanted/posts'}>
          View Wanted Posts
        </Button>
      </CardFooter>
    </Card>
  );
}