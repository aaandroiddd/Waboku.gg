import dynamic from 'next/dynamic';
import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUnread } from '@/contexts/UnreadContext';
import { getFirebaseServices } from '@/lib/firebase';
import { collection, query, where, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { Order } from '@/types/order';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Filter, Search, ArrowUpDown, Download, Check, X } from 'lucide-react';
import { useRouter } from 'next/router';
import { toast } from 'sonner';
import { OrderCard } from '@/components/OrderCard';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem
} from '@/components/ui/dropdown-menu';
import { format, subDays } from 'date-fns';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';

type OrderStatus = 'all' | 'pending' | 'paid' | 'awaiting_shipping' | 'shipped' | 'completed' | 'cancelled';
type SortField = 'date' | 'amount' | 'status';
type SortDirection = 'asc' | 'desc';

const OrdersComponent = () => {
  const { user } = useAuth();
  const router = useRouter();
  const { clearUnreadCount, resetUnreadCount } = useUnread();
  const [purchases, setPurchases] = useState<Order[]>([]);
  const [sales, setSales] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingOrder, setProcessingOrder] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Filtering and sorting state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus>('all');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [dateFilter, setDateFilter] = useState<number | null>(90); // Last 90 days by default
  const [activeTab, setActiveTab] = useState<'purchases' | 'sales'>(
    router.query.tab === 'sales' ? 'sales' : 'purchases'
  );
  
  // Clear unread count when component mounts
  useEffect(() => {
    clearUnreadCount('orders');
    
    // Reset when component unmounts
    return () => {
      resetUnreadCount('orders');
    };
  }, [clearUnreadCount, resetUnreadCount]);

  // Check for successful checkout and ensure order is created
  useEffect(() => {
    const checkAndEnsureOrder = async () => {
      const { success, session_id, ensure_order } = router.query;
      
      if (success === 'true' && session_id && ensure_order === 'true' && !processingOrder) {
        setProcessingOrder(true);
        
        try {
          console.log('[Orders Page] Ensuring order is created for session:', session_id);
          
          // Show a loading toast
          const toastId = toast.loading('Processing your order...');
          
          // Call our API to ensure the order is created
          const response = await fetch('/api/stripe/ensure-order-created', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              sessionId: session_id,
            }),
          });
          
          const data = await response.json();
          
          if (response.ok) {
            // Order was created or already existed
            toast.success('Order processed successfully!', { id: toastId });
            console.log('[Orders Page] Order ensured successfully:', data);
            
            // Remove the query parameters to prevent duplicate processing
            router.replace('/dashboard/orders', undefined, { shallow: true });
            
            // Refresh the orders list by triggering a re-render
            fetchOrders();
          } else {
            // There was an error
            toast.error('Failed to process order. Please contact support.', { id: toastId });
            console.error('[Orders Page] Error ensuring order:', data);
          }
        } catch (error) {
          console.error('[Orders Page] Error in ensure order process:', error);
          toast.error('An unexpected error occurred. Please contact support.');
        } finally {
          setProcessingOrder(false);
        }
      }
    };
    
    if (user) {
      checkAndEnsureOrder();
    }
  }, [router.query, user, processingOrder]);

  const fetchOrders = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const { db } = getFirebaseServices();
      console.log('[Orders Page] Fetching orders for user:', user.uid);
      console.log('[Orders Page] Will specifically check for orders with paymentStatus: "awaiting_payment"');
      
      // Log the query paths we're going to check
      console.log('[Orders Page] Will check the following paths:');
      console.log(`- users/${user.uid}/orders (user-specific subcollection)`);
      console.log(`- orders (main collection, filtered by buyerId/sellerId)`);
      
      // Method 1: Try to fetch from user-specific subcollections first
      const userOrdersQuery = query(
        collection(db, 'users', user.uid, 'orders'),
        orderBy('createdAt', 'desc')
      );
      
      console.log('Querying user-specific orders subcollection');
      const userOrdersSnapshot = await getDocs(userOrdersQuery);
      
      // If we have user-specific orders, fetch the full order details
      if (!userOrdersSnapshot.empty) {
        console.log(`Found ${userOrdersSnapshot.docs.length} user-specific orders`);
        
        const userPurchases: Order[] = [];
        const userSales: Order[] = [];
        
        // For each order reference, get the full order details
        const orderPromises = userOrdersSnapshot.docs.map(async (orderDoc) => {
          try {
            const orderData = orderDoc.data();
            const orderId = orderData.orderId;
            const role = orderData.role; // 'buyer' or 'seller'
            
            console.log(`Fetching full order details for order: ${orderId}, role: ${role}`);
            
            // Get the full order details from the main orders collection
            const fullOrderDoc = await getDoc(doc(db, 'orders', orderId));
            
            if (fullOrderDoc.exists()) {
              const fullOrderData = fullOrderDoc.data() as Order;
              
              // Safely convert timestamps to dates
              const createdAt = fullOrderData.createdAt?.toDate?.() || new Date();
              const updatedAt = fullOrderData.updatedAt?.toDate?.() || new Date();
              
              const order = {
                id: fullOrderDoc.id,
                ...fullOrderData,
                createdAt,
                updatedAt,
              };
              
              console.log(`Successfully fetched order: ${orderId}`);
              
              // Add to the appropriate array based on role
              if (role === 'buyer') {
                userPurchases.push(order);
              } else if (role === 'seller') {
                userSales.push(order);
              }
            } else {
              console.warn(`Order ${orderId} referenced in user subcollection not found in main orders collection`);
            }
          } catch (err) {
            console.error(`Error processing order reference:`, err);
          }
        });
        
        await Promise.all(orderPromises);
        
        console.log(`Processed ${userPurchases.length} purchases and ${userSales.length} sales`);
        setPurchases(userPurchases);
        setSales(userSales);
      } else {
        // Method 2: Fallback to querying the main orders collection directly
        console.log('No user-specific orders found, falling back to main collection query');
        
        try {
          // Fetch purchases
          const purchasesQuery = query(
            collection(db, 'orders'),
            where('buyerId', '==', user.uid),
            orderBy('createdAt', 'desc')
          );
          
          // Fetch sales - include both regular sales and orders from offers
          const salesQuery = query(
            collection(db, 'orders'),
            where('sellerId', '==', user.uid),
            orderBy('createdAt', 'desc')
          );

          console.log('Querying main orders collection');
          const [purchasesSnapshot, salesSnapshot] = await Promise.all([
            getDocs(purchasesQuery),
            getDocs(salesQuery)
          ]);

          console.log(`Found ${purchasesSnapshot.size} purchases and ${salesSnapshot.size} sales in main collection`);
          
          // Log if any orders have offerPrice field (indicating they came from offers)
          const offersBasedOrders = salesSnapshot.docs.filter(doc => doc.data().offerPrice !== undefined);
          if (offersBasedOrders.length > 0) {
            console.log(`Found ${offersBasedOrders.length} sales that originated from offers:`);
            offersBasedOrders.forEach(doc => {
              const data = doc.data();
              console.log(`- Order ID: ${doc.id}, Amount: ${data.amount}, OfferPrice: ${data.offerPrice}, Status: ${data.status}`);
            });
          }

          const purchasesData = purchasesSnapshot.docs.map(doc => {
            try {
              const data = doc.data();
              // Safely convert timestamps to dates
              const createdAt = data.createdAt?.toDate?.() || new Date();
              const updatedAt = data.updatedAt?.toDate?.() || new Date();
              
              return {
                id: doc.id,
                ...data,
                createdAt,
                updatedAt,
              };
            } catch (err) {
              console.error(`Error processing purchase document ${doc.id}:`, err);
              return null;
            }
          }).filter(Boolean) as Order[];

          const salesData = salesSnapshot.docs.map(doc => {
            try {
              const data = doc.data();
              // Safely convert timestamps to dates
              const createdAt = data.createdAt?.toDate?.() || new Date();
              const updatedAt = data.updatedAt?.toDate?.() || new Date();
              
              return {
                id: doc.id,
                ...data,
                createdAt,
                updatedAt,
              };
            } catch (err) {
              console.error(`Error processing sale document ${doc.id}:`, err);
              return null;
            }
          }).filter(Boolean) as Order[];

          // Log any orders with paymentStatus: "awaiting_payment" for debugging
          const awaitingPaymentPurchases = purchasesData.filter(order => order.paymentStatus === 'awaiting_payment');
          const awaitingPaymentSales = salesData.filter(order => order.paymentStatus === 'awaiting_payment');
          
          if (awaitingPaymentPurchases.length > 0) {
            console.log(`[Orders Page] Found ${awaitingPaymentPurchases.length} purchases with paymentStatus: "awaiting_payment":`);
            awaitingPaymentPurchases.forEach(order => {
              console.log(`- Order ID: ${order.id}, Status: ${order.status}, PaymentStatus: ${order.paymentStatus}`);
            });
          } else {
            console.log('[Orders Page] No purchases with paymentStatus: "awaiting_payment" found');
          }
          
          if (awaitingPaymentSales.length > 0) {
            console.log(`[Orders Page] Found ${awaitingPaymentSales.length} sales with paymentStatus: "awaiting_payment":`);
            awaitingPaymentSales.forEach(order => {
              console.log(`- Order ID: ${order.id}, Status: ${order.status}, PaymentStatus: ${order.paymentStatus}`);
            });
          } else {
            console.log('[Orders Page] No sales with paymentStatus: "awaiting_payment" found');
          }
          
          setPurchases(purchasesData);
          setSales(salesData);
        } catch (err) {
          console.error('Error querying main orders collection:', err);
        }
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error('Failed to load orders. Please try again.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  // Fetch orders when component mounts
  useEffect(() => {
    fetchOrders();
  }, [user]);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    
    try {
      setIsRefreshing(true);
      await fetchOrders();
      toast.success('Orders refreshed successfully');
    } catch (error) {
      console.error('Error refreshing orders:', error);
      toast.error('Failed to refresh orders. Please try again.');
    }
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value as 'purchases' | 'sales');
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setDateFilter(90);
    setSortField('date');
    setSortDirection('desc');
  };

  const handleExportOrders = () => {
    const ordersToExport = activeTab === 'purchases' ? filteredOrders : filteredSales;
    
    if (ordersToExport.length === 0) {
      toast.error('No orders to export');
      return;
    }
    
    // Create CSV content
    const headers = ['Order #', 'Date', 'Buyer/Seller', 'Product', 'Amount', 'Status'];
    const csvContent = [
      headers.join(','),
      ...ordersToExport.map(order => {
        const date = format(order.createdAt, 'MM/dd/yyyy');
        const name = activeTab === 'purchases' ? 'Seller' : 'Buyer';
        const product = order.listingSnapshot?.title || 'Unknown Product';
        const amount = order.amount.toFixed(2);
        const status = order.status.charAt(0).toUpperCase() + order.status.slice(1).replace('_', ' ');
        
        return [
          order.id,
          date,
          name,
          `"${product.replace(/"/g, '""')}"`, // Escape quotes in CSV
          amount,
          status
        ].join(',');
      })
    ].join('\n');
    
    // Create and download the file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${activeTab}-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success(`${ordersToExport.length} orders exported successfully`);
  };

  // Helper function to determine the effective status of an order
  const getEffectiveStatus = (order: Order): string => {
    // If the order has paymentStatus 'awaiting_payment', treat it as pending
    if (order.paymentStatus === 'awaiting_payment') {
      return 'pending';
    }
    // Otherwise use the order's status or default to pending
    return order.status || 'pending';
  };

  // Filter and sort orders
  const filteredOrders = useMemo(() => {
    let result = [...purchases];
    
    // Apply date filter
    if (dateFilter !== null) {
      const cutoffDate = subDays(new Date(), dateFilter);
      result = result.filter(order => order.createdAt >= cutoffDate);
    }
    
    // Apply status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'pending') {
        // For pending filter, include:
        // 1. Orders with 'pending' status
        // 2. Orders without a status
        // 3. Orders with paymentStatus 'awaiting_payment'
        result = result.filter(order => 
          order.status === 'pending' || 
          !order.status || 
          order.status === '' ||
          order.paymentStatus === 'awaiting_payment'
        );
      } else {
        result = result.filter(order => order.status === statusFilter);
      }
    }
    
    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      result = result.filter(order => 
        order.id.toLowerCase().includes(searchLower) ||
        (order.listingSnapshot?.title || '').toLowerCase().includes(searchLower)
      );
    }
    
    // Apply sorting
    result.sort((a, b) => {
      if (sortField === 'date') {
        return sortDirection === 'asc' 
          ? a.createdAt.getTime() - b.createdAt.getTime()
          : b.createdAt.getTime() - a.createdAt.getTime();
      } else if (sortField === 'amount') {
        return sortDirection === 'asc'
          ? a.amount - b.amount
          : b.amount - a.amount;
      } else if (sortField === 'status') {
        // Use the effective status for sorting
        const statusA = getEffectiveStatus(a);
        const statusB = getEffectiveStatus(b);
        return sortDirection === 'asc'
          ? statusA.localeCompare(statusB)
          : statusB.localeCompare(statusA);
      }
      return 0;
    });
    
    return result;
  }, [purchases, statusFilter, searchTerm, sortField, sortDirection, dateFilter]);

  // Filter and sort sales
  const filteredSales = useMemo(() => {
    let result = [...sales];
    
    // Apply date filter
    if (dateFilter !== null) {
      const cutoffDate = subDays(new Date(), dateFilter);
      result = result.filter(order => order.createdAt >= cutoffDate);
    }
    
    // Apply status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'pending') {
        // For pending filter, include:
        // 1. Orders with 'pending' status
        // 2. Orders without a status
        // 3. Orders with paymentStatus 'awaiting_payment'
        result = result.filter(order => 
          order.status === 'pending' || 
          !order.status || 
          order.status === '' ||
          order.paymentStatus === 'awaiting_payment'
        );
      } else {
        result = result.filter(order => order.status === statusFilter);
      }
    }
    
    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      result = result.filter(order => 
        order.id.toLowerCase().includes(searchLower) ||
        (order.listingSnapshot?.title || '').toLowerCase().includes(searchLower)
      );
    }
    
    // Apply sorting
    result.sort((a, b) => {
      if (sortField === 'date') {
        return sortDirection === 'asc' 
          ? a.createdAt.getTime() - b.createdAt.getTime()
          : b.createdAt.getTime() - a.createdAt.getTime();
      } else if (sortField === 'amount') {
        return sortDirection === 'asc'
          ? a.amount - b.amount
          : b.amount - a.amount;
      } else if (sortField === 'status') {
        // Use the effective status for sorting
        const statusA = getEffectiveStatus(a);
        const statusB = getEffectiveStatus(b);
        return sortDirection === 'asc'
          ? statusA.localeCompare(statusB)
          : statusB.localeCompare(statusA);
      }
      return 0;
    });
    
    return result;
  }, [sales, statusFilter, searchTerm, sortField, sortDirection, dateFilter]);

  // Get active orders count for each status
  const getStatusCounts = (orders: Order[]) => {
    const counts = {
      all: orders.length,
      pending: 0,
      paid: 0,
      awaiting_shipping: 0,
      shipped: 0,
      completed: 0,
      cancelled: 0
    };
    
    orders.forEach(order => {
      // First check if this is an awaiting payment order
      if (order.paymentStatus === 'awaiting_payment') {
        counts.pending++;
      }
      // Then check for missing status (count as pending)
      else if (!order.status || order.status === '') {
        counts.pending++;
      }
      // Count other orders by their status
      else if (counts[order.status as keyof typeof counts] !== undefined) {
        counts[order.status as keyof typeof counts]++;
      }
    });
    
    return counts;
  };
  
  const purchaseStatusCounts = getStatusCounts(purchases);
  const salesStatusCounts = getStatusCounts(sales);
  
  // Get the active status counts based on the current tab
  const activeStatusCounts = activeTab === 'purchases' ? purchaseStatusCounts : salesStatusCounts;

  if (loading && !isRefreshing) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mb-8 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Orders Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Manage your purchases and sales
            </p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Refreshing...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </>
            )}
          </Button>
        </div>
      </div>

      <Tabs 
        defaultValue={router.query.tab === 'sales' ? 'sales' : 'purchases'} 
        className="space-y-4"
        onValueChange={handleTabChange}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <TabsList>
            <TabsTrigger value="purchases">Purchases ({purchases.length})</TabsTrigger>
            <TabsTrigger value="sales">Sales ({sales.length})</TabsTrigger>
          </TabsList>
          
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  className={statusFilter === 'all' ? 'bg-primary text-primary-foreground' : ''}
                  onClick={() => setStatusFilter('all')}
                >
                  All
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  className={statusFilter === 'paid' || statusFilter === 'awaiting_shipping' ? 'bg-primary text-primary-foreground' : ''}
                  onClick={() => setStatusFilter('awaiting_shipping')}
                >
                  Ready to Ship
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  className={statusFilter === 'pending' ? 'bg-primary text-primary-foreground' : ''}
                  onClick={() => setStatusFilter('pending')}
                >
                  Open Orders
                </Button>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search name, email, order number"
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="mr-2 h-4 w-4" />
                  Filters
                  {(statusFilter !== 'all' || dateFilter !== 90) && (
                    <Badge variant="secondary" className="ml-2 px-1 py-0">1</Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[200px]">
                <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup value={statusFilter} onValueChange={(value) => setStatusFilter(value as OrderStatus)}>
                  <DropdownMenuRadioItem value="all">
                    All ({activeStatusCounts.all})
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="pending">
                    Pending ({activeStatusCounts.pending})
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="paid">
                    Paid ({activeStatusCounts.paid})
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="awaiting_shipping">
                    Awaiting Shipping ({activeStatusCounts.awaiting_shipping})
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="shipped">
                    Shipped ({activeStatusCounts.shipped})
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="completed">
                    Completed ({activeStatusCounts.completed})
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="cancelled">
                    Cancelled ({activeStatusCounts.cancelled})
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
                
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Date Range</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup value={dateFilter?.toString() || 'all'} onValueChange={(value) => setDateFilter(value === 'all' ? null : parseInt(value))}>
                  <DropdownMenuRadioItem value="all">All time</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="7">Last 7 days</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="30">Last 30 days</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="90">Last 90 days</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
                
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleClearFilters}>
                  <X className="mr-2 h-4 w-4" />
                  Clear All
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <ArrowUpDown className="mr-2 h-4 w-4" />
                  Sort
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[180px]">
                <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup value={sortField} onValueChange={(value) => setSortField(value as SortField)}>
                  <DropdownMenuRadioItem value="date">Date</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="amount">Amount</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="status">Status</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
                
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Direction</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup value={sortDirection} onValueChange={(value) => setSortDirection(value as SortDirection)}>
                  <DropdownMenuRadioItem value="desc">Newest first</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="asc">Oldest first</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <Button variant="outline" size="sm" onClick={handleExportOrders}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </div>
        
        {dateFilter && (
          <div className="flex items-center mb-4">
            <Badge variant="outline" className="mr-2">
              Last {dateFilter} days
            </Badge>
            {statusFilter !== 'all' && (
              <Badge variant="outline" className="mr-2">
                Status: {statusFilter === 'awaiting_shipping' ? 'Awaiting Shipping' : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}
              </Badge>
            )}
            {(dateFilter !== 90 || statusFilter !== 'all') && (
              <Button variant="ghost" size="sm" onClick={handleClearFilters} className="h-7 px-2">
                <X className="h-3 w-3 mr-1" />
                Clear
              </Button>
            )}
          </div>
        )}
        
        <div className="mb-2">
          {activeTab === 'purchases' ? (
            <p className="text-sm text-muted-foreground">
              Showing {filteredOrders.length} of {purchases.length} purchases
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Showing {filteredSales.length} of {sales.length} sales
            </p>
          )}
        </div>
        
        <TabsContent value="purchases" className="space-y-4">
          {purchases.length === 0 ? (
            <div className="text-center py-12 border rounded-lg bg-background">
              <h3 className="text-lg font-medium mb-2">No purchases yet</h3>
              <p className="text-muted-foreground">
                When you buy items, they will appear here.
              </p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-12 border rounded-lg bg-background">
              <h3 className="text-lg font-medium mb-2">No matching orders</h3>
              <p className="text-muted-foreground mb-4">
                Try adjusting your filters to see more results.
              </p>
              <Button variant="outline" onClick={handleClearFilters}>Clear Filters</Button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredOrders.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="sales" className="space-y-4">
          {sales.length === 0 ? (
            <div className="text-center py-12 border rounded-lg bg-background">
              <h3 className="text-lg font-medium mb-2">No sales yet</h3>
              <p className="text-muted-foreground">
                When you sell items, they will appear here.
              </p>
            </div>
          ) : filteredSales.length === 0 ? (
            <div className="text-center py-12 border rounded-lg bg-background">
              <h3 className="text-lg font-medium mb-2">No matching sales</h3>
              <p className="text-muted-foreground mb-4">
                Try adjusting your filters to see more results.
              </p>
              <Button variant="outline" onClick={handleClearFilters}>Clear Filters</Button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredSales.map((order) => (
                <OrderCard key={order.id} order={order} isSale={true} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
};

// Use dynamic import with ssr disabled
export default dynamic(() => Promise.resolve(OrdersComponent), {
  ssr: false
});