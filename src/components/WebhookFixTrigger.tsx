import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface WebhookFixTriggerProps {
  adminSecret: string;
}

export function WebhookFixTrigger({ adminSecret }: WebhookFixTriggerProps) {
  const [sessionId, setSessionId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTriggerWebhookFix = async () => {
    if (!sessionId) {
      setError('Session ID is required');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Call the admin endpoint that will trigger the webhook fix
      const response = await fetch('/api/admin/trigger-webhook-fix', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': adminSecret
        },
        body: JSON.stringify({ sessionId })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to trigger webhook fix');
      }
      
      setResult(data);
    } catch (err) {
      console.error('Error triggering webhook fix:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6 mb-8">
      <h2 className="text-xl font-semibold mb-4">Stripe Webhook Fix</h2>
      <Alert className="mb-4">
        <AlertDescription>
          This tool allows you to manually fix order creation issues for a specific Stripe Checkout Session.
          Enter the Session ID from Stripe Dashboard to create the missing order.
        </AlertDescription>
      </Alert>
      
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="sessionId">Stripe Checkout Session ID</Label>
          <Input
            id="sessionId"
            placeholder="cs_test_..."
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
          />
          <p className="text-xs text-muted-foreground mt-1">
            The session must be a completed checkout with listingId, buyerId, and sellerId in its metadata.
          </p>
        </div>
        
        <Button 
          onClick={handleTriggerWebhookFix}
          disabled={loading || !sessionId}
          className="w-full"
        >
          {loading ? 'Processing...' : 'Fix Order Creation'}
        </Button>
        
        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {result && (
          <div className="mt-4">
            <h3 className="font-medium mb-2">Result:</h3>
            <pre className="p-4 bg-muted rounded-lg overflow-x-auto text-sm">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </Card>
  );
}