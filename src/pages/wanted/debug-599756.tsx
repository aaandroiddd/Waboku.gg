import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { useRouter } from 'next/router';

export default function Debug599756Page() {
  const [isCreating, setIsCreating] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [createResult, setCreateResult] = useState<any>(null);
  const [resolveResult, setResolveResult] = useState<any>(null);
  const { toast } = useToast();
  const router = useRouter();

  const createTestPost = async () => {
    setIsCreating(true);
    try {
      const response = await fetch('/api/wanted/create-test-599756', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      setCreateResult(data);

      if (data.success) {
        toast({
          title: "Test post created!",
          description: `Created post with ID ${data.postId} and short ID ${data.shortId}`,
        });
      } else {
        toast({
          title: "Error creating test post",
          description: data.error || "Unknown error",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error creating test post:', error);
      toast({
        title: "Error",
        description: "Failed to create test post",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const testResolve = async () => {
    setIsResolving(true);
    try {
      const response = await fetch('/api/wanted/test-resolve?shortId=599756');
      const data = await response.json();
      setResolveResult(data);

      toast({
        title: "Resolve test completed",
        description: "Check the results below",
      });
    } catch (error) {
      console.error('Error testing resolve:', error);
      toast({
        title: "Error",
        description: "Failed to test resolve",
        variant: "destructive",
      });
    } finally {
      setIsResolving(false);
    }
  };

  const testDirectURL = () => {
    router.push('/wanted/pokemon/need-absol-cards-599756');
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Debug 599756 Wanted Post Issue</h1>
      
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Step 1: Create Test Post</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4">
              Create a test wanted post with short ID 599756 that matches the failing URL.
            </p>
            <Button 
              onClick={createTestPost} 
              disabled={isCreating}
              className="mb-4"
            >
              {isCreating ? 'Creating...' : 'Create Test Post'}
            </Button>
            
            {createResult && (
              <div className="bg-gray-100 p-4 rounded">
                <h4 className="font-semibold mb-2">Create Result:</h4>
                <pre className="text-sm overflow-auto">
                  {JSON.stringify(createResult, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Step 2: Test Resolve API</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4">
              Test the resolve API to see if it can find the post with short ID 599756.
            </p>
            <Button 
              onClick={testResolve} 
              disabled={isResolving}
              className="mb-4"
            >
              {isResolving ? 'Testing...' : 'Test Resolve API'}
            </Button>
            
            {resolveResult && (
              <div className="bg-gray-100 p-4 rounded">
                <h4 className="font-semibold mb-2">Resolve Result:</h4>
                <pre className="text-sm overflow-auto">
                  {JSON.stringify(resolveResult, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Step 3: Test Direct URL</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4">
              Navigate directly to the failing URL to test the full flow.
            </p>
            <Button 
              onClick={testDirectURL}
              className="mb-4"
            >
              Go to /wanted/pokemon/need-absol-cards-599756
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Debug Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <p><strong>Target URL:</strong> /wanted/pokemon/need-absol-cards-599756</p>
              <p><strong>Expected Short ID:</strong> 599756</p>
              <p><strong>Expected Game:</strong> pokemon</p>
              <p><strong>Expected Title Slug:</strong> need-absol-cards</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}