import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { QrCode, Camera, CheckCircle, Loader2, RefreshCw, Copy, X, CameraOff, Hash, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { formatPrice } from '@/lib/price';
import { Order } from '@/types/order';
import jsQR from 'jsqr';

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
  const [pickupCode, setPickupCode] = useState<string | null>(null);
  const [codeExpiresAt, setCodeExpiresAt] = useState<Date | null>(null);
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [scannedOrderDetails, setScannedOrderDetails] = useState<any>(null);
  const [scanInput, setScanInput] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [showMobileConfirmPage, setShowMobileConfirmPage] = useState(false);
  const [pickupMethod, setPickupMethod] = useState<'qr' | 'code'>('qr');
  
  // Camera scanning state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanMode, setScanMode] = useState<'camera' | 'manual'>('camera');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check if mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load existing pickup code from order if available
  useEffect(() => {
    if (isSeller && order && order.pickupCode && order.pickupCodeExpiresAt) {
      const expiresAt = new Date(order.pickupCodeExpiresAt.seconds * 1000);
      const now = new Date();
      
      // Only set the code if it hasn't expired
      if (expiresAt > now) {
        setPickupCode(order.pickupCode);
        setCodeExpiresAt(expiresAt);
      }
    }
  }, [order, isSeller]);

  // Update countdown timer for existing codes
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (codeExpiresAt && pickupCode) {
      interval = setInterval(() => {
        const now = new Date();
        if (codeExpiresAt <= now) {
          // Code has expired, clear it
          setPickupCode(null);
          setCodeExpiresAt(null);
          clearInterval(interval);
        }
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [codeExpiresAt, pickupCode]);

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
      setPickupMethod('qr');
      setShowQRDialog(true);
      
      const message = order.sellerPickupInitiated 
        ? 'New QR code generated! Show this to the buyer to complete pickup.'
        : 'QR code generated! Show this to the buyer to complete pickup.';
      toast.success(message);

    } catch (error) {
      console.error('Error generating QR code:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate QR code');
    } finally {
      setIsGeneratingQR(false);
    }
  };

  // Generate 6-digit code for seller
  const handleGenerateCode = async () => {
    if (!user || !order.id) return;

    // If there's already an active code, just show it
    if (pickupCode && codeExpiresAt && codeExpiresAt > new Date()) {
      setPickupMethod('code');
      setShowQRDialog(true);
      return;
    }

    try {
      setIsGeneratingCode(true);
      console.log('Generating 6-digit code for pickup:', order.id);

      const response = await fetch('/api/orders/generate-pickup-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId: order.id,
          userId: user.uid,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to generate pickup code');
      }

      setPickupCode(data.pickupCode);
      setCodeExpiresAt(new Date(data.expiresAt));
      setPickupMethod('code');
      setShowQRDialog(true);
      
      const message = data.isExisting 
        ? 'Active pickup code retrieved! Share this code with the buyer.'
        : '6-digit pickup code generated! Share this code with the buyer.';
      toast.success(message);

    } catch (error) {
      console.error('Error generating pickup code:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate pickup code');
    } finally {
      setIsGeneratingCode(false);
    }
  };

  // Handle manual QR data input (for testing or manual entry)
  const handleManualScan = async () => {
    if (!scanInput.trim()) {
      toast.error('Please enter QR code data');
      return;
    }

    // Basic validation for QR code data format
    const input = scanInput.trim();
    if (!input.startsWith('{') || !input.endsWith('}')) {
      toast.error('Invalid QR code format. Please scan the QR code with your camera instead.');
      return;
    }

    try {
      setIsScanning(true);
      await processQRScan(input);
    } catch (error) {
      console.error('Error processing manual scan:', error);
      toast.error('Failed to process QR code data. Please try scanning with your camera instead.');
    } finally {
      setIsScanning(false);
    }
  };

  // Handle 6-digit code verification
  const handleCodeVerification = async () => {
    if (!codeInput.trim() || codeInput.length !== 6) {
      toast.error('Please enter a valid 6-digit code');
      return;
    }

    if (!user) return;

    try {
      setIsScanning(true);
      console.log('Verifying 6-digit code for user:', user.uid);

      const response = await fetch('/api/orders/verify-pickup-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pickupCode: codeInput.trim(),
          userId: user.uid,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle specific error cases with user-friendly messages
        let errorMessage = 'Failed to verify pickup code';
        
        switch (response.status) {
          case 400:
            if (data.message?.includes('Invalid pickup code format')) {
              errorMessage = 'Please enter a valid 6-digit code (numbers only)';
            } else if (data.message?.includes('expired')) {
              errorMessage = 'This pickup code has expired. Please ask the seller to generate a new one.';
            } else if (data.message?.includes('already been completed')) {
              errorMessage = 'This pickup has already been completed.';
            } else {
              errorMessage = data.message || 'Invalid pickup code';
            }
            break;
          case 403:
            errorMessage = 'This pickup code is not for your order. Please check with the seller.';
            break;
          case 404:
            errorMessage = 'Invalid pickup code. Please check the code and try again.';
            break;
          case 500:
            errorMessage = 'Server error. Please try again in a moment.';
            break;
          default:
            errorMessage = data.message || 'Failed to verify pickup code';
        }
        
        toast.error(errorMessage);
        return;
      }

      setScannedOrderDetails(data.orderDetails);
      setShowScanDialog(false);
      
      if (isMobile) {
        setShowMobileConfirmPage(true);
      } else {
        setShowConfirmDialog(true);
      }
      
      toast.success('Pickup code verified! Please confirm the pickup details.');

    } catch (error) {
      console.error('Error verifying pickup code:', error);
      
      // Handle network errors and other exceptions
      let errorMessage = 'Failed to verify pickup code';
      
      if (error instanceof Error) {
        if (error.message.includes('fetch')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        } else {
          errorMessage = error.message;
        }
      }
      
      toast.error(errorMessage);
    } finally {
      setIsScanning(false);
    }
  };

  // Copy pickup code to clipboard
  const handleCopyCode = () => {
    if (pickupCode) {
      navigator.clipboard.writeText(pickupCode).then(() => {
        toast.success('Pickup code copied to clipboard');
      }).catch(() => {
        toast.error('Failed to copy pickup code');
      });
    }
  };

  // Format time remaining for code expiration
  const getTimeRemaining = (expiresAt: Date) => {
    const now = new Date();
    const timeLeft = expiresAt.getTime() - now.getTime();
    
    if (timeLeft <= 0) return 'Expired';
    
    const minutes = Math.floor(timeLeft / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
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
        // Handle specific error cases with user-friendly messages
        let errorMessage = 'Failed to verify QR code';
        
        switch (response.status) {
          case 400:
            if (data.message?.includes('Invalid QR code format')) {
              errorMessage = 'This QR code is not valid. Please scan the correct pickup QR code from the seller.';
            } else if (data.message?.includes('not for pickup confirmation')) {
              errorMessage = 'This QR code is not for pickup confirmation. Please scan the pickup QR code from the seller.';
            } else if (data.message?.includes('missing required information')) {
              errorMessage = 'This QR code is incomplete or corrupted. Please ask the seller to generate a new one.';
            } else if (data.message?.includes('expired')) {
              errorMessage = 'This QR code has expired. Please ask the seller to generate a new one.';
            } else if (data.message?.includes('already been completed')) {
              errorMessage = 'This pickup has already been completed.';
            } else if (data.message?.includes('not a pickup order')) {
              errorMessage = 'This order is not set up for pickup. Please contact the seller.';
            } else {
              errorMessage = data.message || 'Invalid QR code';
            }
            break;
          case 403:
            errorMessage = 'This QR code is not for your order. Please check with the seller.';
            break;
          case 404:
            errorMessage = 'Order not found. This QR code may be invalid or the order may have been cancelled.';
            break;
          case 500:
            errorMessage = 'Server error. Please try again in a moment.';
            break;
          default:
            errorMessage = data.message || 'Failed to verify QR code';
        }
        
        toast.error(errorMessage);
        return;
      }

      setScannedOrderDetails(data.orderDetails);
      setShowScanDialog(false);
      
      if (isMobile) {
        setShowMobileConfirmPage(true);
      } else {
        setShowConfirmDialog(true);
      }
      
      toast.success('QR code verified! Please confirm the pickup details.');

    } catch (error) {
      console.error('Error scanning QR code:', error);
      
      // Handle network errors and other exceptions
      let errorMessage = 'Failed to verify QR code';
      
      if (error instanceof Error) {
        if (error.message.includes('fetch')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        } else {
          errorMessage = error.message;
        }
      }
      
      toast.error(errorMessage);
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
      setShowMobileConfirmPage(false);
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

  // Camera scanning functions
  const startCamera = async () => {
    try {
      setCameraError(null);
      setIsCameraActive(true);
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment', // Use back camera if available
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      });
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        
        // Start scanning for QR codes
        startQRScanning();
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      setCameraError('Unable to access camera. Please check permissions or try manual entry.');
      setIsCameraActive(false);
      setScanMode('manual');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    
    setIsCameraActive(false);
  };

  const startQRScanning = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
    }
    
    scanIntervalRef.current = setInterval(() => {
      if (videoRef.current && canvasRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        
        if (context) {
          canvas.width = videoRef.current.videoWidth;
          canvas.height = videoRef.current.videoHeight;
          
          context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          
          const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          
          if (code) {
            console.log('QR Code detected:', code.data);
            stopCamera();
            processQRScan(code.data);
          }
        }
      }
    }, 100); // Scan every 100ms
  };

  // Cleanup camera when component unmounts or dialog closes
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  useEffect(() => {
    if (!showScanDialog) {
      stopCamera();
      setScanMode('camera');
      setCameraError(null);
    }
  }, [showScanDialog]);

  // Generate QR code image using a simple QR code library or service
  const generateQRCodeImage = (data: string) => {
    // Using QR Server API for simplicity - in production, you might want to use a client-side library
    const encodedData = encodeURIComponent(data);
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodedData}`;
  };

  if (isSeller) {
    return (
      <>
        <div className="space-y-2">
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
                {order.sellerPickupInitiated ? 'Generate QR Code' : 'Start Pickup (QR Code)'}
              </>
            )}
          </Button>

          <Button 
            variant="outline" 
            className="w-full border-green-600 text-green-600 hover:bg-green-50"
            onClick={() => {
              if (pickupCode && codeExpiresAt && codeExpiresAt > new Date()) {
                // Show existing code
                setPickupMethod('code');
                setShowQRDialog(true);
              } else {
                // Generate new code
                handleGenerateCode();
              }
            }}
            disabled={isGeneratingCode || order.pickupCompleted}
          >
            {isGeneratingCode ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating Code...
              </>
            ) : pickupCode && codeExpiresAt && codeExpiresAt > new Date() ? (
              <>
                <Hash className="mr-2 h-4 w-4" />
                Show Active Code
              </>
            ) : (
              <>
                <Hash className="mr-2 h-4 w-4" />
                Generate 6-Digit Code
              </>
            )}
          </Button>
        </div>

        {/* Pickup Method Display Dialog */}
        <Dialog open={showQRDialog} onOpenChange={setShowQRDialog}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {pickupMethod === 'qr' ? (
                  <>
                    <QrCode className="h-5 w-5" />
                    Pickup QR Code
                  </>
                ) : (
                  <>
                    <Hash className="h-5 w-5" />
                    Pickup Code
                  </>
                )}
              </DialogTitle>
              <DialogDescription>
                {pickupMethod === 'qr' 
                  ? 'Show this QR code to the buyer to complete the pickup process. The code will expire in 24 hours.'
                  : 'Share this 6-digit code with the buyer to complete the pickup process. The code will expire in 30 minutes.'
                }
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

              {/* QR Code Display */}
              {pickupMethod === 'qr' && qrCodeData && (
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

              {/* 6-Digit Code Display */}
              {pickupMethod === 'code' && pickupCode && (
                <div className="flex flex-col items-center space-y-4">
                  <div className="p-6 bg-gradient-to-br from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-lg border-2 border-dashed border-green-300 dark:border-green-700">
                    <div className="text-center space-y-3">
                      <div className="text-3xl font-mono font-bold tracking-wider text-green-700 dark:text-green-300">
                        {pickupCode}
                      </div>
                      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        {codeExpiresAt && (
                          <span>Expires in: {getTimeRemaining(codeExpiresAt)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      <CheckCircle className="mr-1 h-3 w-3" />
                      Ready for Pickup
                    </Badge>
                  </div>

                  <div className="text-center space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Share this 6-digit code with the buyer. They can enter it in the app to confirm pickup.
                    </p>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleCopyCode}
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Copy Code
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
        Confirm Pickup
      </Button>

      {/* Pickup Confirmation Dialog */}
      <Dialog open={showScanDialog} onOpenChange={setShowScanDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Confirm Pickup
            </DialogTitle>
            <DialogDescription>
              Scan the QR code or enter the 6-digit code provided by the seller to confirm pickup of your order.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Method Toggle */}
            <div className="flex gap-2">
              <Button
                variant={scanMode === 'camera' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setScanMode('camera')}
                className="flex-1"
              >
                <Camera className="mr-2 h-4 w-4" />
                QR Code
              </Button>
              <Button
                variant={scanMode === 'manual' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setScanMode('manual')}
                className="flex-1"
              >
                <Hash className="mr-2 h-4 w-4" />
                6-Digit Code
              </Button>
            </div>

            {scanMode === 'camera' ? (
              <div className="space-y-4">
                {/* Camera View */}
                <div className="relative">
                  <div className="aspect-square max-w-sm mx-auto border-2 border-dashed border-muted-foreground/25 rounded-lg overflow-hidden bg-black">
                    {isCameraActive ? (
                      <>
                        <video
                          ref={videoRef}
                          className="w-full h-full object-cover"
                          playsInline
                          muted
                        />
                        <canvas
                          ref={canvasRef}
                          className="hidden"
                        />
                        {/* Scanning overlay */}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-48 h-48 border-2 border-blue-500 rounded-lg">
                            <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-blue-500 rounded-tl-lg"></div>
                            <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-blue-500 rounded-tr-lg"></div>
                            <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-blue-500 rounded-bl-lg"></div>
                            <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-blue-500 rounded-br-lg"></div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-white">
                        <Camera className="h-12 w-12 mb-4 opacity-50" />
                        <p className="text-sm opacity-75">Camera not active</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Camera Controls */}
                <div className="flex gap-2 justify-center">
                  {!isCameraActive ? (
                    <Button
                      onClick={startCamera}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Camera className="mr-2 h-4 w-4" />
                      Start Camera
                    </Button>
                  ) : (
                    <Button
                      onClick={stopCamera}
                      variant="outline"
                    >
                      <CameraOff className="mr-2 h-4 w-4" />
                      Stop Camera
                    </Button>
                  )}
                </div>

                {/* Camera Error */}
                {cameraError && (
                  <div className="p-3 rounded-md bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">
                    <p className="text-sm">{cameraError}</p>
                  </div>
                )}

                {/* Instructions */}
                <div className="text-center space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Position the QR code within the scanning area. The code will be detected automatically.
                  </p>
                  {isCameraActive && (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-xs text-green-600 dark:text-green-400">Scanning...</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* 6-Digit Code Input */
              <div className="space-y-4">
                <div className="text-center">
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <Hash className="h-8 w-8 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
                    <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-1">Enter 6-Digit Code</h3>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      Enter the 6-digit code provided by the seller
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-medium">Pickup Code:</label>
                  <Input
                    type="text"
                    placeholder="000000"
                    value={codeInput}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setCodeInput(value);
                    }}
                    className="text-center text-2xl font-mono tracking-widest"
                    maxLength={6}
                  />
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">
                      {codeInput.length}/6 digits entered
                    </p>
                  </div>
                </div>

                <Button 
                  onClick={handleCodeVerification}
                  disabled={isScanning || codeInput.length !== 6}
                  className="w-full"
                >
                  {isScanning ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Verify Code
                    </>
                  )}
                </Button>

                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    The code expires in 30 minutes after generation
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowScanDialog(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mobile: Full-screen confirmation page */}
      {showMobileConfirmPage && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col h-screen">
          {/* Header */}
          <header className="shrink-0 flex items-center justify-between p-4 border-b border-border bg-background">
            <h1 className="text-lg font-semibold">Confirm Pickup</h1>
            <button
              onClick={() => setShowMobileConfirmPage(false)}
              className="p-2 hover:bg-muted rounded-md transition-colors"
              type="button"
              aria-label="Close"
              disabled={isConfirming}
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          {/* Content */}
          <main className="flex-1 overflow-y-auto p-4 pb-24">
            <div className="max-w-md mx-auto space-y-6">
              <div className="text-center">
                <p className="text-muted-foreground">
                  Please verify the pickup details below and confirm that you have received the item.
                </p>
              </div>
              
              {scannedOrderDetails && (
                <div className="bg-muted/50 p-4 rounded-lg border">
                  <h2 className="font-medium mb-3 text-base">Order Details</h2>
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <span className="text-muted-foreground text-sm">Item:</span>
                      <span className="font-medium text-right flex-1 ml-2 text-sm">{scannedOrderDetails.listingTitle}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground text-sm">Seller:</span>
                      <span className="font-medium text-sm">{scannedOrderDetails.sellerName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground text-sm">Amount:</span>
                      <span className="font-medium text-sm">{formatPrice(scannedOrderDetails.amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground text-sm">Order ID:</span>
                      <span className="font-mono text-xs">{scannedOrderDetails.orderId.slice(0, 8)}...</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-primary/10 border border-primary/20 p-4 rounded-lg">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <h2 className="font-medium mb-2 text-base">What happens next?</h2>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <span className="text-primary mt-0.5">•</span>
                        <span>The order will be marked as completed</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary mt-0.5">•</span>
                        <span>You'll be able to leave a review for this transaction</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-primary mt-0.5">•</span>
                        <span>The seller will receive confirmation of the completed pickup</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </main>

          {/* Footer */}
          <footer className="shrink-0 p-4 border-t border-border bg-background">
            <div className="max-w-md mx-auto space-y-3">
              <button
                onClick={handleConfirmPickup}
                disabled={isConfirming}
                className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
                type="button"
              >
                {isConfirming && <Loader2 className="h-4 w-4 animate-spin" />}
                {isConfirming ? 'Confirming...' : 'Confirm Pickup'}
              </button>
              <button
                onClick={() => setShowMobileConfirmPage(false)}
                disabled={isConfirming}
                className="w-full bg-muted hover:bg-muted/80 disabled:opacity-50 text-muted-foreground font-medium py-3 px-4 rounded-lg transition-colors"
                type="button"
              >
                Cancel
              </button>
            </div>
          </footer>
        </div>
      )}

      {/* Desktop: AlertDialog */}
      {showConfirmDialog && (
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
      )}
    </>
  );
}