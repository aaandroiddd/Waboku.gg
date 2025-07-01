import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MobileSelect } from '@/components/ui/mobile-select';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Package } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface ShippingCarrierInputProps {
  onSubmit: (carrier: string, trackingNumber: string) => void;
  isLoading?: boolean;
  error?: string | null;
}

const CARRIERS = [
  { id: 'auto-detect', name: 'Auto-detect from tracking number' },
  { id: 'usps', name: 'USPS' },
  { id: 'fedex', name: 'FedEx' },
  { id: 'ups', name: 'UPS' },
  { id: 'dhl', name: 'DHL' },
  { id: 'ontrac', name: 'OnTrac' },
  { id: 'lasership', name: 'LaserShip' },
  { id: 'amazon', name: 'Amazon Logistics' },
  { id: 'other', name: 'Other' }
];

export function ShippingCarrierInput({ onSubmit, isLoading = false, error = null }: ShippingCarrierInputProps) {
  const [carrier, setCarrier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate inputs
    if (!carrier) {
      setValidationError('Please select a shipping carrier');
      return;
    }
    
    if (!trackingNumber.trim()) {
      setValidationError('Please enter a tracking number');
      return;
    }
    
    // Clear any validation errors
    setValidationError(null);
    
    // Submit the data
    onSubmit(carrier, trackingNumber.trim());
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Shipping Information</CardTitle>
        <CardDescription>
          Enter the carrier and tracking number to enable automatic tracking updates
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {(error || validationError) && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                {error || validationError}
              </AlertDescription>
            </Alert>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="carrier">Shipping Carrier</Label>
            <MobileSelect
              value={carrier}
              onValueChange={setCarrier}
              placeholder="Select carrier"
              options={CARRIERS.map(c => ({
                value: c.id,
                label: c.name
              }))}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="tracking-number">Tracking Number</Label>
            <Input
              id="tracking-number"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="Enter tracking number"
            />
          </div>
          
          <Button 
            type="submit" 
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="animate-spin mr-2">⟳</span>
                Updating...
              </>
            ) : (
              <>
                <Package className="h-4 w-4 mr-2" />
                Update Tracking
              </>
            )}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground">
        Tracking updates are provided by the carrier and may take time to reflect the latest status.
      </CardFooter>
    </Card>
  );
}