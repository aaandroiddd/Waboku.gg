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
  const [signature, setSignature] = useState('');
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
      // Create a mock Stripe event payload for checkout.session.completed
      const mockEvent = {
        id: `evt_${Math.random().toString(36).substring(2, 15)}`,
        object: 'event',
        api_version: '2023-10-16',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: sessionId,
            object: 'checkout.session',
            // Add other required fields that the webhook expects
            metadata: {
              // These would normally come from the actual session
              // The admin would need to provide these values
              listingId: '',
              buyerId: '',
              sellerId: ''
            }
          }
        }
      };

      // Call the admin endpoint that will trigger the webhook fix
      const response = await fetch('/api/admin/trigger-webhook-fix', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': adminSecret
        },
        body: JSON.stringify({
          sessionId,
          signature: signature || undefined
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to trigger webhook fix');
      }
      
      setResult(data);
    } catch (err) {
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
          This tool allows you to manually trigger the webhook-fix endpoint for a specific Stripe Checkout Session.
          Use this only when you need to fix issues with order creation.
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
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="signature">
            Stripe Signature (Optional)
          </Label>
          <Input
            id="signature"
            placeholder="t=...,v1=..."
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            If left empty, the admin endpoint will attempt to retrieve session details directly from Stripe.
          </p>
        </div>
        
        <Button 
          onClick={handleTriggerWebhookFix}
          disabled={loading || !sessionId}
          className="w-full"
        >
          {loading ? 'Processing...' : 'Trigger Webhook Fix'}
        </Button>
        
        {error && (
          <Alert variant="destructive">
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