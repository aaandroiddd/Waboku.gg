import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, Search, Code, CheckCircle, AlertTriangle } from 'lucide-react';

export function PickupCodeDebugger() {
  const [orderId, setOrderId] = useState('');
  const [pickupCode, setPickupCode] = useState('');
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [debugResult, setDebugResult] = useState<any>(null);
  const [generateResult, setGenerateResult] = useState<any>(null);
  const [verifyResult, setVerifyResult] = useState<any>(null);

  const handleDebugPickupCode = async () => {
    if (!pickupCode && !orderId) {
      toast.error('Please enter either a pickup code or order ID');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/debug/check-pickup-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pickupCode: pickupCode || undefined,
          orderId: orderId || undefined,
        }),
      });

      const data = await response.json();
      setDebugResult(data);

      if (data.success) {
        toast.success('Debug information retrieved');
      } else {
        toast.error(data.message || 'Failed to retrieve debug information');
      }
    } catch (error) {
      console.error('Error debugging pickup code:', error);
      toast.error('Failed to debug pickup code');
      setDebugResult({ error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateCode = async () => {
    if (!orderId || !userId) {
      toast.error('Please enter both order ID and user ID');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/orders/generate-pickup-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId,
          userId,
        }),
      });

      const data = await response.json();
      setGenerateResult(data);

      if (data.success) {
        toast.success('Pickup code generated successfully');
        if (data.pickupCode) {
          setPickupCode(data.pickupCode);
        }
      } else {
        toast.error(data.message || 'Failed to generate pickup code');
      }
    } catch (error) {
      console.error('Error generating pickup code:', error);
      toast.error('Failed to generate pickup code');
      setGenerateResult({ error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!pickupCode || !userId) {
      toast.error('Please enter both pickup code and user ID');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/orders/verify-pickup-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pickupCode,
          userId,
        }),
      });

      const data = await response.json();
      setVerifyResult(data);

      if (data.success) {
        toast.success('Pickup code verified successfully');
      } else {
        toast.error(data.message || 'Failed to verify pickup code');
      }
    } catch (error) {
      console.error('Error verifying pickup code:', error);
      toast.error('Failed to verify pickup code');
      setVerifyResult({ error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setLoading(false);
    }
  };

  const clearResults = () => {
    setDebugResult(null);
    setGenerateResult(null);
    setVerifyResult(null);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            Pickup Code Debugger
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Input Fields */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="orderId">Order ID</Label>
              <Input
                id="orderId"
                placeholder="Enter order ID"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pickupCode">Pickup Code (6 digits)</Label>
              <Input
                id="pickupCode"
                placeholder="123456"
                value={pickupCode}
                onChange={(e) => setPickupCode(e.target.value)}
                maxLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="userId">User ID</Label>
              <Input
                id="userId"
                placeholder="Enter user ID"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleDebugPickupCode}
              disabled={loading || (!pickupCode && !orderId)}
              variant="outline"
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
              Debug Pickup Code
            </Button>
            <Button
              onClick={handleGenerateCode}
              disabled={loading || !orderId || !userId}
              variant="default"
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Code className="mr-2 h-4 w-4" />}
              Generate Code
            </Button>
            <Button
              onClick={handleVerifyCode}
              disabled={loading || !pickupCode || !userId}
              variant="secondary"
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
              Verify Code
            </Button>
            <Button
              onClick={clearResults}
              variant="ghost"
            >
              Clear Results
            </Button>
          </div>

          {/* Results */}
          {debugResult && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  Debug Results
                  <Badge variant={debugResult.success ? 'success' : 'destructive'}>
                    {debugResult.success ? 'Success' : 'Error'}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={JSON.stringify(debugResult, null, 2)}
                  readOnly
                  className="font-mono text-xs"
                  rows={10}
                />
              </CardContent>
            </Card>
          )}

          {generateResult && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Code className="h-4 w-4" />
                  Generate Results
                  <Badge variant={generateResult.success ? 'success' : 'destructive'}>
                    {generateResult.success ? 'Success' : 'Error'}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={JSON.stringify(generateResult, null, 2)}
                  readOnly
                  className="font-mono text-xs"
                  rows={8}
                />
              </CardContent>
            </Card>
          )}

          {verifyResult && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Verify Results
                  <Badge variant={verifyResult.success ? 'success' : 'destructive'}>
                    {verifyResult.success ? 'Success' : 'Error'}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={JSON.stringify(verifyResult, null, 2)}
                  readOnly
                  className="font-mono text-xs"
                  rows={8}
                />
              </CardContent>
            </Card>
          )}

          {/* Instructions */}
          <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
            <CardContent className="pt-6">
              <div className="space-y-2">
                <h4 className="font-medium text-blue-900 dark:text-blue-100">How to use:</h4>
                <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                  <li>1. <strong>Debug:</strong> Enter either an Order ID or Pickup Code to see what's stored in the database</li>
                  <li>2. <strong>Generate:</strong> Enter Order ID and User ID (seller) to generate a new pickup code</li>
                  <li>3. <strong>Verify:</strong> Enter Pickup Code and User ID (buyer) to test verification</li>
                  <li>4. Check the console logs for detailed debugging information</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}