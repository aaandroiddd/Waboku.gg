import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { QrCode, Camera, CheckCircle, Loader2, RefreshCw, Copy, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { formatPrice } from '@/lib/price';
import { Order } from '@/types/order';

interface PickupQRCodeProps {
  order: Order;
  isSeller: boolean;
  onPickupCompleted: () => void;
}

export function PickupQRCode({ order, isSeller, onPickupCompleted }: PickupQRCodeProps) {
  const { user } = useAuth();
  const [showQRDialog, setShowQRDialog] = useState(false);
  const [showScanDialog, setShowScanDialog] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [pickupToken, setPickupToken] = useState<string | null>(null);
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [scannedOrderDetails, setScannedOrderDetails] = useState<any>(null);
  const [scanInput, setScanInput] = useState('');

  // Generate QR code for seller
  const handleGenerateQR = async () => {
    if (!user || !order.id) return;

    try {
      setIsGeneratingQR(true);
      console.log('Generating QR code for pickup:', order.id);

      const response = await fetch('/api/orders/complete-pickup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId: order.id,
          userId: user.uid,
          role: 'seller',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to generate QR code');
      }

      setQrCodeData(data.qrCode);
      setPickupToken(data.pickupToken);
      setShowQRDialog(true);
      toast.success('QR code generated! Show this to the buyer to complete pickup.');

    } catch (error) {
      console.error('Error generating QR code:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate QR code');
    } finally {
      setIsGeneratingQR(false);
    }
  };

  // Handle manual QR data input (for testing or manual entry)
  const handleManualScan = async () => {
    if (!scanInput.trim()) {
      toast.error('Please enter QR code data');
      return;
    }

    try {
      setIsScanning(true);
      await processQRScan(scanInput.trim());
    } catch (error) {
      console.error('Error processing manual scan:', error);
      toast.error('Failed to process QR code data');
    } finally {
      setIsScanning(false);
    }
  };

  // Process QR code scan
  const processQRScan = async (qrData: string) => {
    if (!user) return;

    try {
      console.log('Processing QR scan for user:', user.uid);

      const response = await fetch('/api/orders/scan-pickup-qr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          qrData,
          userId: user.uid,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to verify QR code');
      }

      setScannedOrderDetails(data.orderDetails);
      setShowScanDialog(false);
      setShowConfirmDialog(true);
      toast.success('QR code verified! Please confirm the pickup details.');

    } catch (error) {
      console.error('Error scanning QR code:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to scan QR code');
    }
  };

  // Confirm pickup after QR scan
  const handleConfirmPickup = async () => {
    if (!user || !scannedOrderDetails) return;

    // Extract pickup token from scanned order details
    const tokenToUse = scannedOrderDetails.pickupToken;
    if (!tokenToUse) {
      toast.error('Missing pickup token from QR code');
      return;
    }

    try {
      setIsConfirming(true);
      console.log('Confirming pickup for order:', scannedOrderDetails.orderId);

      const response = await fetch('/api/orders/complete-pickup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId: scannedOrderDetails.orderId,
          userId: user.uid,
          role: 'buyer',
          pickupToken: tokenToUse,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to confirm pickup');
      }

      toast.success(data.message);
      setShowConfirmDialog(false);
      onPickupCompleted();

    } catch (error) {
      console.error('Error confirming pickup:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to confirm pickup');
    } finally {
      setIsConfirming(false);
    }
  };

  // Copy QR data to clipboard
  const handleCopyQRData = () => {
    if (qrCodeData) {
      navigator.clipboard.writeText(qrCodeData).then(() => {
        toast.success('QR code data copied to clipboard');
      }).catch(() => {
        toast.error('Failed to copy QR code data');
      });
    }
  };

  // Generate QR code image using a simple QR code library or service
  const generateQRCodeImage = (data: string) => {
    // Using QR Server API for simplicity - in production, you might want to use a client-side library
    const encodedData = encodeURIComponent(data);
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodedData}`;
  };

  if (isSeller) {
    return (
      <>
        <Button 
          variant="default" 
          className="bg-green-600 hover:bg-green-700 text-white font-medium w-full"
          onClick={handleGenerateQR}
          disabled={isGeneratingQR || order.pickupCompleted}
        >
          {isGeneratingQR ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating QR Code...
            </>
          ) : (
            <>
              <QrCode className="mr-2 h-4 w-4" />
              Start Pickup Process
            </>
          )}
        </Button>

        {/* QR Code Display Dialog */}
        <Dialog open={showQRDialog} onOpenChange={setShowQRDialog}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                Pickup QR Code
              </DialogTitle>
              <DialogDescription>
                Show this QR code to the buyer to complete the pickup process. The code will expire in 24 hours.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Order Details */}
              <Card>
                <CardContent className="pt-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Item:</span>
                      <span className="font-medium">{order.listingSnapshot?.title || 'Unknown Item'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Amount:</span>
                      <span className="font-medium">{formatPrice(order.amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Order ID:</span>
                      <span className="font-mono text-sm">{order.id.slice(0, 8)}...</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* QR Code */}
              {qrCodeData && (
                <div className="flex flex-col items-center space-y-4">
                  <div className="p-4 bg-white rounded-lg border">
                    <img 
                      src={generateQRCodeImage(qrCodeData)} 
                      alt="Pickup QR Code"
                      className="w-64 h-64"
                    />
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      <CheckCircle className="mr-1 h-3 w-3" />
                      Ready for Pickup
                    </Badge>
                  </div>

                  <div className="text-center space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Ask the buyer to scan this QR code with their phone camera or the app to confirm pickup.
                    </p>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleCopyQRData}
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Copy QR Data
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowQRDialog(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Buyer interface
  return (
    <>
      <Button 
        variant="default" 
        className="bg-blue-600 hover:bg-blue-700 text-white font-medium w-full"
        onClick={() => setShowScanDialog(true)}
        disabled={order.pickupCompleted}
      >
        <Camera className="mr-2 h-4 w-4" />
        Scan Pickup QR Code
      </Button>

      {/* QR Scan Dialog */}
      <Dialog open={showScanDialog} onOpenChange={setShowScanDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Scan Pickup QR Code
            </DialogTitle>
            <DialogDescription>
              Scan the QR code provided by the seller to confirm pickup of your order.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="text-center p-8 border-2 border-dashed border-muted-foreground/25 rounded-lg">
              <Camera className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                Camera scanning will be available in a future update.
              </p>
              <p className="text-sm text-muted-foreground">
                For now, you can manually enter the QR code data below.
              </p>
            </div>

            {/* Manual QR Data Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Manual QR Code Data Entry:</label>
              <textarea
                className="w-full p-3 border rounded-md resize-none"
                rows={4}
                placeholder="Paste QR code data here..."
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
              />
              <Button 
                onClick={handleManualScan}
                disabled={isScanning || !scanInput.trim()}
                className="w-full"
              >
                {isScanning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Verify QR Code
                  </>
                )}
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowScanDialog(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pickup Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Pickup</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>Please verify the pickup details below and confirm that you have received the item:</p>
                
                {scannedOrderDetails && (
                  <Card>
                    <CardContent className="pt-4">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Item:</span>
                          <span className="font-medium">{scannedOrderDetails.listingTitle}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Seller:</span>
                          <span className="font-medium">{scannedOrderDetails.sellerName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Amount:</span>
                          <span className="font-medium">{formatPrice(scannedOrderDetails.amount)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Order ID:</span>
                          <span className="font-mono text-sm">{scannedOrderDetails.orderId.slice(0, 8)}...</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="flex items-start gap-2 p-3 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                  <CheckCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">What happens next?</p>
                    <ul className="list-disc list-inside mt-1 space-y-1 text-sm">
                      <li>The order will be marked as completed</li>
                      <li>You'll be able to leave a review for this transaction</li>
                      <li>The seller will receive confirmation of the completed pickup</li>
                    </ul>
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmPickup}
              disabled={isConfirming}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isConfirming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Pickup
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}