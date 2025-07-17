import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface ListingSample {
  id: string;
  userId: string;
  username: string;
  looksLikeUserId: boolean;
  actualUsername?: string;
}

interface FixResults {
  checked?: number;
  fixed: number;
  errors: string[];
}

export function ListingUsernameDebugger() {
  const [isLoading, setIsLoading] = useState(false);
  const [sample, setSample] = useState<ListingSample[]>([]);
  const [fixResults, setFixResults] = useState<FixResults | null>(null);

  const getSample = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/fix-listing-usernames', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sample', limit: 20 })
      });

      const result = await response.json();
      if (result.success) {
        setSample(result.data);
        toast.success(result.message);
      } else {
        toast.error(result.error || 'Failed to get sample');
      }
    } catch (error) {
      console.error('Error getting sample:', error);
      toast.error('Failed to get sample');
    } finally {
      setIsLoading(false);
    }
  };

  const checkAndFix = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/fix-listing-usernames', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check', limit: 100 })
      });

      const result = await response.json();
      if (result.success) {
        setFixResults(result.data);
        toast.success(result.message);
        
        // Refresh the sample to see the changes
        setTimeout(() => getSample(), 1000);
      } else {
        toast.error(result.error || 'Failed to check and fix');
      }
    } catch (error) {
      console.error('Error checking and fixing:', error);
      toast.error('Failed to check and fix');
    } finally {
      setIsLoading(false);
    }
  };

  const fixSpecificListings = async (listingIds: string[]) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/fix-listing-usernames', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'fix-specific', listingIds })
      });

      const result = await response.json();
      if (result.success) {
        setFixResults(result.data);
        toast.success(result.message);
        
        // Refresh the sample to see the changes
        setTimeout(() => getSample(), 1000);
      } else {
        toast.error(result.error || 'Failed to fix specific listings');
      }
    } catch (error) {
      console.error('Error fixing specific listings:', error);
      toast.error('Failed to fix specific listings');
    } finally {
      setIsLoading(false);
    }
  };

  const problematicListings = sample.filter(item => item.looksLikeUserId);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Listing Username Debugger
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Button 
              onClick={getSample} 
              disabled={isLoading}
              variant="outline"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Get Sample
            </Button>
            
            <Button 
              onClick={checkAndFix} 
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              Check & Fix All (100 listings)
            </Button>
            
            {problematicListings.length > 0 && (
              <Button 
                onClick={() => fixSpecificListings(problematicListings.map(item => item.id))} 
                disabled={isLoading}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                Fix Sample Issues ({problematicListings.length})
              </Button>
            )}
          </div>

          {fixResults && (
            <Card className="bg-green-50 border-green-200">
              <CardContent className="pt-4">
                <h3 className="font-semibold text-green-800 mb-2">Fix Results</h3>
                <div className="space-y-1 text-sm">
                  {fixResults.checked && (
                    <p><strong>Checked:</strong> {fixResults.checked} listings</p>
                  )}
                  <p><strong>Fixed:</strong> {fixResults.fixed} listings</p>
                  {fixResults.errors.length > 0 && (
                    <div>
                      <p className="text-red-600"><strong>Errors:</strong></p>
                      <ul className="list-disc list-inside text-red-600 ml-2">
                        {fixResults.errors.slice(0, 5).map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                        {fixResults.errors.length > 5 && (
                          <li>... and {fixResults.errors.length - 5} more errors</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {sample.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Sample Listings ({sample.length})</CardTitle>
            <div className="flex gap-2">
              <Badge variant="outline">
                Good: {sample.filter(item => !item.looksLikeUserId).length}
              </Badge>
              <Badge variant="destructive">
                Issues: {problematicListings.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sample.map((item) => (
                <div 
                  key={item.id} 
                  className={`p-3 rounded-lg border ${
                    item.looksLikeUserId 
                      ? 'bg-red-50 border-red-200' 
                      : 'bg-green-50 border-green-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={item.looksLikeUserId ? 'destructive' : 'default'}>
                          {item.looksLikeUserId ? 'Issue' : 'Good'}
                        </Badge>
                        <code className="text-xs bg-gray-100 px-1 rounded">
                          {item.id}
                        </code>
                      </div>
                      
                      <div className="text-sm space-y-1">
                        <div>
                          <strong>Current Username:</strong> 
                          <code className="ml-1 bg-gray-100 px-1 rounded">
                            {item.username || '(empty)'}
                          </code>
                        </div>
                        
                        {item.actualUsername && (
                          <div>
                            <strong>Should Be:</strong> 
                            <code className="ml-1 bg-blue-100 px-1 rounded">
                              {item.actualUsername}
                            </code>
                          </div>
                        )}
                        
                        <div className="text-xs text-gray-500">
                          User ID: {item.userId}
                        </div>
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