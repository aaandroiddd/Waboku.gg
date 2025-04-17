import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

interface ApiTestResponse {
  success?: boolean;
  message?: string;
  details?: any;
  error?: string;
}

interface ApiTestPanelProps {
  adminSecret: string;
}

export function ApiTestPanel({ adminSecret }: ApiTestPanelProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, ApiTestResponse | null>>({
    firebaseAdmin: null,
    reviewCreation: null
  });

  const runTest = async (testType: string, endpoint: string) => {
    setLoading(testType);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': adminSecret
        }
      });
      
      const data = await response.json();
      setTestResults(prev => ({
        ...prev,
        [testType]: data
      }));
    } catch (error) {
      setTestResults(prev => ({
        ...prev,
        [testType]: {
          success: false,
          message: 'Failed to execute API test',
          error: error instanceof Error ? error.message : String(error)
        }
      }));
    }
    setLoading(null);
  };

  return (
    <Card className="p-6 mb-8">
      <h2 className="text-xl font-semibold mb-4">API Diagnostics</h2>
      <Alert className="mb-4">
        <AlertDescription>
          These tests help diagnose issues with Firebase Admin SDK and review creation functionality.
        </AlertDescription>
      </Alert>
      
      <Tabs defaultValue="firebase-admin" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="firebase-admin">Firebase Admin Test</TabsTrigger>
          <TabsTrigger value="review-creation">Review Creation Test</TabsTrigger>
        </TabsList>
        
        <TabsContent value="firebase-admin" className="space-y-4 mt-4">
          <p className="text-sm text-muted-foreground">
            Tests Firebase Admin SDK initialization and database operations.
          </p>
          <Button 
            onClick={() => runTest('firebaseAdmin', '/api/debug/test-firebase-admin-enhanced')}
            disabled={loading !== null}
            className="w-full"
          >
            {loading === 'firebaseAdmin' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing...
              </>
            ) : 'Run Firebase Admin Test'}
          </Button>
          
          {testResults.firebaseAdmin && (
            <div className="mt-4">
              <div className={`p-3 rounded-md mb-2 ${testResults.firebaseAdmin.success ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                <p className="font-medium">
                  {testResults.firebaseAdmin.success ? '✅ Test Passed' : '❌ Test Failed'}
                </p>
                <p className="text-sm">{testResults.firebaseAdmin.message}</p>
              </div>
              
              <ScrollArea className="h-[300px] w-full rounded-md border p-4">
                <pre className="text-xs">
                  {JSON.stringify(testResults.firebaseAdmin.details || {}, null, 2)}
                </pre>
              </ScrollArea>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="review-creation" className="space-y-4 mt-4">
          <p className="text-sm text-muted-foreground">
            Tests the complete review creation process including database operations.
          </p>
          <Button 
            onClick={() => runTest('reviewCreation', '/api/debug/test-review-creation')}
            disabled={loading !== null}
            className="w-full"
          >
            {loading === 'reviewCreation' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing...
              </>
            ) : 'Run Review Creation Test'}
          </Button>
          
          {testResults.reviewCreation && (
            <div className="mt-4">
              <div className={`p-3 rounded-md mb-2 ${testResults.reviewCreation.success ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                <p className="font-medium">
                  {testResults.reviewCreation.success ? '✅ Test Passed' : '❌ Test Failed'}
                </p>
                <p className="text-sm">{testResults.reviewCreation.message}</p>
              </div>
              
              <ScrollArea className="h-[300px] w-full rounded-md border p-4">
                <pre className="text-xs">
                  {JSON.stringify(testResults.reviewCreation.details || {}, null, 2)}
                </pre>
              </ScrollArea>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </Card>
  );
}