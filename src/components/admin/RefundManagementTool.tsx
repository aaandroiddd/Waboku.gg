import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { formatPrice } from '@/lib/price';
import { format } from 'date-fns';
import { Search, RefreshCw, AlertTriangle, CheckCircle, XCircle, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface RefundOrder {
  id: string;
  buyerId: string;
  sellerId: string;
  amount: number;
  status: string;
  refundStatus: string;
  refundReason?: string;
  refundAmount?: number;
  refundRequestedAt?: Date;
  refundProcessedAt?: Date;
  refundNotes?: string;
  listingSnapshot?: {
    title: string;
    imageUrl?: string;
  };
  createdAt: Date;
}

export function RefundManagementTool() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<RefundOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<RefundOrder | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [adminRefundAmount, setAdminRefundAmount] = useState('');
  const [processing, setProcessing] = useState(false);

  // Fetch orders with refund requests
  const fetchRefundOrders = async () => {
    try {
      setLoading(true);
      const token = await user?.getIdToken();
      
      const response = await fetch('/api/admin/refunds/get-orders', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch refund orders');
      }

      const data = await response.json();
      setOrders(data.orders || []);
    } catch (error) {
      console.error('Error fetching refund orders:', error);
      toast.error('Failed to fetch refund orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRefundOrders();
  }, [user]);

  // Filter orders based on search and status
  const filteredOrders = orders.filter(order => {
    const matchesSearch = !searchTerm || 
      order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.listingSnapshot?.title?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || order.refundStatus === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Handle admin refund action
  const handleAdminRefundAction = async (action: 'approve' | 'deny') => {
    if (!selectedOrder) return;

    try {
      setProcessing(true);
      const token = await user?.getIdToken();

      const response = await fetch('/api/orders/process-refund', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          orderId: selectedOrder.id,
          action,
          refundAmount: adminRefundAmount ? parseFloat(adminRefundAmount) : undefined,
          sellerNotes: adminNotes,
          adminOverride: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process refund');
      }

      toast.success(
        action === 'approve' 
          ? 'Refund approved and processed successfully!' 
          : 'Refund request denied'
      );

      // Refresh orders and clear selection
      await fetchRefundOrders();
      setSelectedOrder(null);
      setAdminNotes('');
      setAdminRefundAmount('');

    } catch (error) {
      console.error('Error processing refund:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to process refund');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'requested': return 'warning';
      case 'processing': return 'info';
      case 'completed': return 'success';
      case 'failed': return 'destructive';
      case 'cancelled': return 'destructive';
      default: return 'secondary';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'requested': return 'bg-orange-500 text-white';
      case 'processing': return 'bg-blue-500 text-white';
      case 'completed': return 'bg-green-500 text-white';
      case 'failed': return 'bg-red-500 text-white';
      case 'cancelled': return 'bg-gray-500 text-white';
      default: return '';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Refund Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search and Filter Controls */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Label htmlFor="search">Search Orders</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by order ID or item title..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-full md:w-48">
              <Label htmlFor="status-filter">Refund Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="requested">Requested</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={fetchRefundOrders} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>

          {/* Orders List */}
          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
                <p>Loading refund orders...</p>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No refund orders found
              </div>
            ) : (
              filteredOrders.map((order) => (
                <Card 
                  key={order.id} 
                  className={`cursor-pointer transition-colors ${
                    selectedOrder?.id === order.id ? 'ring-2 ring-primary' : 'hover:bg-muted/50'
                  }`}
                  onClick={() => setSelectedOrder(order)}
                >
                  <CardContent className="pt-4">
                    <div className="flex flex-col md:flex-row gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-mono text-sm font-semibold">
                            #{order.id.slice(-8).toUpperCase()}
                          </span>
                          <Badge 
                            variant={getStatusBadgeVariant(order.refundStatus)}
                            className={getStatusColor(order.refundStatus)}
                          >
                            {order.refundStatus.charAt(0).toUpperCase() + order.refundStatus.slice(1)}
                          </Badge>
                        </div>
                        <h4 className="font-semibold mb-1">
                          {order.listingSnapshot?.title || 'Unknown Item'}
                        </h4>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <p>Order Amount: {formatPrice(order.amount)}</p>
                          <p>Requested: {order.refundRequestedAt ? format(order.refundRequestedAt, 'PPp') : 'N/A'}</p>
                          {order.refundAmount && (
                            <p>Refund Amount: {formatPrice(order.refundAmount)}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">
                          Order Date: {format(order.createdAt, 'PP')}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Status: {order.status}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Selected Order Details */}
      {selectedOrder && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Admin Refund Processing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Order Details */}
            <div className="bg-muted/50 p-4 rounded-lg">
              <h4 className="font-semibold mb-3">Order Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-muted-foreground">Order ID:</span>
                  <p className="font-mono">{selectedOrder.id}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Item:</span>
                  <p>{selectedOrder.listingSnapshot?.title || 'Unknown Item'}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Order Amount:</span>
                  <p className="font-semibold">{formatPrice(selectedOrder.amount)}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Current Status:</span>
                  <Badge variant="outline">{selectedOrder.status}</Badge>
                </div>
              </div>
            </div>

            {/* Refund Request Details */}
            <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
              <h4 className="font-semibold mb-3">Refund Request</h4>
              <div className="space-y-2">
                <div>
                  <span className="text-sm text-muted-foreground">Requested:</span>
                  <p>{selectedOrder.refundRequestedAt ? format(selectedOrder.refundRequestedAt, 'PPp') : 'N/A'}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Status:</span>
                  <Badge 
                    variant={getStatusBadgeVariant(selectedOrder.refundStatus)}
                    className={getStatusColor(selectedOrder.refundStatus)}
                  >
                    {selectedOrder.refundStatus.charAt(0).toUpperCase() + selectedOrder.refundStatus.slice(1)}
                  </Badge>
                </div>
                {selectedOrder.refundReason && (
                  <div>
                    <span className="text-sm text-muted-foreground">Buyer's Reason:</span>
                    <p className="mt-1 p-2 bg-background rounded border text-sm">
                      {selectedOrder.refundReason}
                    </p>
                  </div>
                )}
                {selectedOrder.refundNotes && (
                  <div>
                    <span className="text-sm text-muted-foreground">Previous Notes:</span>
                    <p className="mt-1 p-2 bg-background rounded border text-sm">
                      {selectedOrder.refundNotes}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Admin Actions */}
            {selectedOrder.refundStatus === 'requested' && (
              <div className="space-y-4">
                <h4 className="font-semibold">Admin Override Actions</h4>
                
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    As an admin, you can override seller decisions and process refunds directly. 
                    This action will bypass normal seller approval and process the refund immediately.
                  </AlertDescription>
                </Alert>

                {/* Refund Amount */}
                <div className="space-y-3">
                  <Label>Refund Amount</Label>
                  <div className="flex items-center space-x-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={selectedOrder.amount}
                      value={adminRefundAmount}
                      onChange={(e) => setAdminRefundAmount(e.target.value)}
                      placeholder={selectedOrder.amount.toFixed(2)}
                      className="w-32"
                    />
                    <span className="text-sm text-muted-foreground">
                      (Max: {formatPrice(selectedOrder.amount)})
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAdminRefundAmount(selectedOrder.amount.toString())}
                    >
                      Full Amount
                    </Button>
                  </div>
                </div>

                {/* Admin Notes */}
                <div>
                  <Label htmlFor="admin-notes">Admin Notes</Label>
                  <Textarea
                    id="admin-notes"
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Add notes about this admin action..."
                    rows={3}
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <Button
                    onClick={() => handleAdminRefundAction('approve')}
                    disabled={processing}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    {processing ? 'Processing...' : 'Approve & Process Refund'}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => handleAdminRefundAction('deny')}
                    disabled={processing || !adminNotes.trim()}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    {processing ? 'Processing...' : 'Deny Refund Request'}
                  </Button>
                </div>
              </div>
            )}

            {selectedOrder.refundStatus !== 'requested' && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  This refund request has already been processed and cannot be modified.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}