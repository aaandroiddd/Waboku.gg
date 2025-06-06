import { useState } from "react";
import { useRouter } from "next/router";
import { PageTransition } from "@/components/PageTransition";
import Header from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle, ArrowLeft } from "lucide-react";

export default function TestCreateWantedPostPage() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  const testCreatePost = async () => {
    setIsSubmitting(true);
    setError("");
    setResult(null);
    
    try {
      console.log("Testing wanted post creation...");
      
      // Create test post data
      const testPostData = {
        title: "Test Wanted Post " + Date.now(),
        description: "This is a test wanted post created for debugging purposes",
        game: "pokemon",
        condition: "near_mint",
        isPriceNegotiable: true,
        location: "California, USA"
      };
      
      console.log("Test post data:", testPostData);
      
      // Get auth token if user is logged in
      const token = user ? await user.getIdToken() : null;
      console.log("Auth token available:", !!token);
      
      // Call the debug API endpoint
      const response = await fetch('/api/wanted/debug-create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        body: JSON.stringify(testPostData)
      });
      
      const result = await response.json();
      console.log("API response:", result);
      
      setResult({
        status: response.status,
        success: result.success,
        data: result
      });
      
      if (!result.success) {
        setError(result.error || result.message || "Unknown error");
      }
    } catch (err) {
      console.error("Test error:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const testDatabaseConnection = async () => {
    setIsSubmitting(true);
    setError("");
    setResult(null);
    
    try {
      console.log("Testing database connection...");
      
      const response = await fetch('/api/debug/test-database-write', {
        method: 'GET'
      });
      
      const result = await response.json();
      console.log("Database test result:", result);
      
      setResult({
        status: response.status,
        success: result.success,
        data: result
      });
      
      if (!result.success) {
        setError(result.error || result.message || "Database test failed");
      }
    } catch (err) {
      console.error("Database test error:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const testFixPaths = async () => {
    setIsSubmitting(true);
    setError("");
    setResult(null);
    
    try {
      console.log("Testing fix-paths API...");
      
      const response = await fetch('/api/wanted/fix-paths', {
        method: 'GET'
      });
      
      const result = await response.json();
      console.log("Fix-paths result:", result);
      
      setResult({
        status: response.status,
        success: !result.error,
        data: result
      });
      
      if (result.error) {
        setError(result.error || "Fix-paths test failed");
      }
    } catch (err) {
      console.error("Fix-paths test error:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageTransition>
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Button
            variant="ghost"
            className="mb-6 pl-0"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          
          <h1 className="text-3xl font-bold mb-2">Wanted Posts Debug Test</h1>
          <p className="text-muted-foreground mb-8">
            Test the wanted posts creation system to identify any issues
          </p>
          
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {result && (
            <Alert variant={result.success ? "default" : "destructive"} className="mb-6">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <div><strong>Status:</strong> {result.status}</div>
                  <div><strong>Success:</strong> {result.success ? "Yes" : "No"}</div>
                  <details className="mt-2">
                    <summary className="cursor-pointer font-medium">View Full Response</summary>
                    <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                      {JSON.stringify(result.data, null, 2)}
                    </pre>
                  </details>
                </div>
              </AlertDescription>
            </Alert>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Database Connection</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Test if the Firebase database connection is working
                </p>
                <Button 
                  onClick={testDatabaseConnection}
                  disabled={isSubmitting}
                  className="w-full"
                >
                  {isSubmitting ? "Testing..." : "Test Database"}
                </Button>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Fix Paths</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Test the fix-paths API that ensures database structure
                </p>
                <Button 
                  onClick={testFixPaths}
                  disabled={isSubmitting}
                  className="w-full"
                >
                  {isSubmitting ? "Testing..." : "Test Fix Paths"}
                </Button>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Create Wanted Post</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Test creating a wanted post with debug information
                </p>
                <Button 
                  onClick={testCreatePost}
                  disabled={isSubmitting}
                  className="w-full"
                >
                  {isSubmitting ? "Creating..." : "Test Create Post"}
                </Button>
              </CardContent>
            </Card>
          </div>
          
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>User Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div><strong>Authenticated:</strong> {user ? "Yes" : "No"}</div>
                {user && (
                  <>
                    <div><strong>User ID:</strong> {user.uid}</div>
                    <div><strong>Display Name:</strong> {user.displayName || "Not set"}</div>
                    <div><strong>Email:</strong> {user.email || "Not set"}</div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </PageTransition>
  );
}