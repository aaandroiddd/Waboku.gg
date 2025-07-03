import dynamic from 'next/dynamic';
import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUnread } from '@/contexts/UnreadContext';
import { useDashboard } from '@/contexts/DashboardContext';
import { Order } from '@/types/order';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Filter, Search, ArrowUpDown, Download, Check, X, HelpCircle, MessageCircle, AlertTriangle, Clock, Info } from 'lucide-react';
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
import { ReviewPrompt } from '@/components/ReviewPrompt';
import { sortOrdersByAttention, getAttentionCounts } from '@/lib/order-utils';

type OrderStatus = 'all' | 'pending' | 'paid' | 'awaiting_shipping' | 'shipped' | 'completed' | 'cancelled';
type SortField = 'date' | 'amount' | 'status';
type SortDirection = 'asc' | 'desc';

const OrdersComponent = () => {
  const { user } = useAuth();
  const router = useRouter();
  const { clearUnreadCount, resetUnreadCount } = useUnread();
  const { 
    data: dashboardData, 
    loading: dashboardLoading, 
    isLoadingOrders, 
    refreshSection,
    getOrders 
  } = useDashboard();
  
  const [processingOrder, setProcessingOrder] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sellerNames, setSellerNames] = useState<Record<string, string>>({});
  const [dismissedReviewPrompts, setDismissedReviewPrompts] = useState<string[]>([]);
  
  // Filtering and sorting state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus>('all');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [dateFilter, setDateFilter] = useState<number | null>(90); // Last 90 days by default
  const [activeTab, setActiveTab] = useState<'purchases' | 'sales'>(
    router.query.tab === 'sales' ? 'sales' : 'purchases'
  );
  
  // Get orders from preloaded data and separate into purchases and sales
  const { purchases, sales } = useMemo(() => {
    const allOrders = getOrders();
    
    if (!user || !allOrders.length) {
      return { purchases: [], sales: [] };
    }
    
    const purchases: Order[] = [];
    const sales: Order[] = [];
    
    allOrders.forEach((order: any) => {
      // Ensure proper date conversion
      const processedOrder = {
        ...order,
        createdAt: order.createdAt instanceof Date ? order.createdAt : new Date(order.createdAt),
        updatedAt: order.updatedAt instanceof Date ? order.updatedAt : new Date(order.updatedAt),
      };
      
      // Use the _orderType if available, otherwise check user IDs
      if (order._orderType === 'purchase' || (!order._orderType && order.buyerId === user.uid)) {
        purchases.push(processedOrder);
      } else if (order._orderType === 'sale' || (!order._orderType && order.sellerId === user.uid)) {
        sales.push(processedOrder);
      }
    });
    
    return { purchases, sales };
  }, [getOrders, user]);
  
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
            
            // Refresh the orders data
            await refreshSection('orders');
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
  }, [router.query, user, processingOrder, refreshSection]);
  
  // Load dismissed review prompts from localStorage
  useEffect(() => {
    try {
      const savedDismissedPrompts = localStorage.getItem('dismissedReviewPrompts');
      if (savedDismissedPrompts) {
        setDismissedReviewPrompts(JSON.parse(savedDismissedPrompts));
      }
    } catch (error) {
      console.error('Error loading dismissed review prompts:', error);
    }
  }, []);
  
  // Fetch seller names for completed orders that need reviews
  useEffect(() => {
    const fetchSellerNames = async () => {
      if (!user) return;
      
      const completedOrders = purchases.filter(
        order => order.status === 'completed' && !order.reviewSubmitted
      );
      
      if (completedOrders.length === 0) return;
      
      const sellerIds = [...new Set(completedOrders.map(order => order.sellerId))];
      const names: Record<string, string> = {};
      
      try {
        // Use a batch API call instead of individual calls
        const response = await fetch('/api/users/get-usernames', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userIds: sellerIds }),
        });
        
        if (response.ok) {
          const userData = await response.json();
          Object.assign(names, userData);
        } else {
          // Fallback to individual calls if batch API doesn't exist
          const { getFirebaseServices } = await import('@/lib/firebase');
          const { doc, getDoc } = await import('firebase/firestore');
          const { db } = getFirebaseServices();
          
          for (const sellerId of sellerIds) {
            if (!sellerId) continue;
            
            const userDoc = await getDoc(doc(db, 'users', sellerId));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              names[sellerId] = userData.displayName || userData.username || 'Seller';
            } else {
              names[sellerId] = 'Seller';
            }
          }
        }
        
        setSellerNames(names);
      } catch (error) {
        console.error('Error fetching seller names:', error);
      }
    };
    
    fetchSellerNames();
  }, [purchases, user]);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    
    try {
      setIsRefreshing(true);
      await refreshSection('orders');
      toast.success('Orders refreshed successfully');
    } catch (error) {
      console.error('Error refreshing orders:', error);
      toast.error('Failed to refresh orders. Please try again.');
    } finally {
      setIsRefreshing(false);
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

  // Filter and sort orders with memoization for performance
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
    
    // Apply sorting - prioritize attention-based sorting for better UX
    if (sortField === 'date' && sortDirection === 'desc') {
      result = sortOrdersByAttention(result, false);
    } else {
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
          const statusA = getEffectiveStatus(a);
          const statusB = getEffectiveStatus(b);
          return sortDirection === 'asc'
            ? statusA.localeCompare(statusB)
            : statusB.localeCompare(statusA);
        }
        return 0;
      });
    }
    
    return result;
  }, [purchases, statusFilter, searchTerm, sortField, sortDirection, dateFilter]);

  // Filter and sort sales with memoization for performance
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
    
    // Apply sorting - prioritize attention-based sorting for better UX
    if (sortField === 'date' && sortDirection === 'desc') {
      result = sortOrdersByAttention(result, true);
    } else {
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
          const statusA = getEffectiveStatus(a);
          const statusB = getEffectiveStatus(b);
          return sortDirection === 'asc'
            ? statusA.localeCompare(statusB)
            : statusB.localeCompare(statusA);
        }
        return 0;
      });
    }
    
    return result;
  }, [sales, statusFilter, searchTerm, sortField, sortDirection, dateFilter]);

  // Get active orders count for each status with memoization
  const getStatusCounts = useMemo(() => {
    return (orders: Order[]) => {
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
        if (order.paymentStatus === 'awaiting_payment') {
          counts.pending++;
        } else if (!order.status || order.status === '') {
          counts.pending++;
        } else if (counts[order.status as keyof typeof counts] !== undefined) {
          counts[order.status as keyof typeof counts]++;
        }
      });
      
      return counts;
    };
  }, []);
  
  const purchaseStatusCounts = useMemo(() => getStatusCounts(purchases), [purchases, getStatusCounts]);
  const salesStatusCounts = useMemo(() => getStatusCounts(sales), [sales, getStatusCounts]);
  const activeStatusCounts = activeTab === 'purchases' ? purchaseStatusCounts : salesStatusCounts;
  
  // Get attention counts for current orders with memoization
  const purchaseAttentionCounts = useMemo(() => getAttentionCounts(purchases, false), [purchases]);
  const salesAttentionCounts = useMemo(() => getAttentionCounts(sales, true), [sales]);
  const activeAttentionCounts = activeTab === 'purchases' ? purchaseAttentionCounts : salesAttentionCounts;
  
  // Get orders that need reviews (completed orders without reviews) with memoization
  const ordersNeedingReviews = useMemo(() => {
    return purchases.filter(
      order => 
        order.status === 'completed' && 
        !order.reviewSubmitted && 
        !dismissedReviewPrompts.includes(order.id)
    );
  }, [purchases, dismissedReviewPrompts]);
  
  // Handle dismissing a review prompt
  const handleDismissReviewPrompt = (orderId: string) => {
    setDismissedReviewPrompts(prev => [...prev, orderId]);
  };

  // Show loading state only if we're loading orders and don't have any cached data
  if (isLoadingOrders() && purchases.length === 0 && sales.length === 0) {
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
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => router.push('/support')}
            >
              <HelpCircle className="mr-2 h-4 w-4" />
              Get Support
            </Button>
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
        
        {/* Attention Summary */}
        {activeAttentionCounts.total > 0 && (
          <div className="mb-4 p-4 rounded-lg border border-primary/20 bg-primary/10 dark:bg-primary/20">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-medium text-primary mb-2">
                  {activeAttentionCounts.total} {activeTab === 'purchases' ? 'purchase' : 'sale'}{activeAttentionCounts.total === 1 ? '' : 's'} need{activeAttentionCounts.total === 1 ? 's' : ''} your attention
                </h3>
                <div className="flex flex-wrap gap-2">
                  {activeAttentionCounts.high > 0 && (
                    <Badge variant="outline" className="border-red-600 text-red-600 dark:border-red-400 dark:text-red-400">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {activeAttentionCounts.high} urgent
                    </Badge>
                  )}
                  {activeAttentionCounts.medium > 0 && (
                    <Badge variant="outline" className="border-orange-600 text-orange-600 dark:border-orange-400 dark:text-orange-400">
                      <Clock className="h-3 w-3 mr-1" />
                      {activeAttentionCounts.medium} action needed
                    </Badge>
                  )}
                  {activeAttentionCounts.low > 0 && (
                    <Badge variant="outline" className="border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400">
                      <Info className="h-3 w-3 mr-1" />
                      {activeAttentionCounts.low} informational
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-primary/80 mt-2">
                  Orders requiring attention are automatically sorted to the top when using default date sorting.
                </p>
              </div>
            </div>
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
          {/* Review Prompts - Show at the top for completed orders without reviews */}
          {activeTab === 'purchases' && ordersNeedingReviews.length > 0 && (
            <div className="mb-6 space-y-4">
              <h3 className="text-lg font-semibold">Pending Reviews</h3>
              <div className="grid gap-4 md:grid-cols-2">
                {ordersNeedingReviews.slice(0, 2).map((order) => (
                  <ReviewPrompt 
                    key={order.id}
                    orderId={order.id}
                    sellerName={sellerNames[order.sellerId] || 'Seller'}
                    onDismiss={() => handleDismissReviewPrompt(order.id)}
                  />
                ))}
              </div>
              {ordersNeedingReviews.length > 2 && (
                <div className="text-center">
                  <Button 
                    variant="link" 
                    onClick={() => setStatusFilter('completed')}
                  >
                    View all {ordersNeedingReviews.length} orders needing reviews
                  </Button>
                </div>
              )}
            </div>
          )}
          
          {purchases.length === 0 ? (
            <div className="text-center py-12 border rounded-lg bg-background">
              <h3 className="text-lg font-medium mb-2">No purchases yet</h3>
              <p className="text-muted-foreground mb-4">
                When you buy items, they will appear here.
              </p>
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <Button 
                  variant="outline" 
                  onClick={() => router.push('/support')}
                >
                  <HelpCircle className="mr-2 h-4 w-4" />
                  Need Help?
                </Button>
              </div>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-12 border rounded-lg bg-background">
              <h3 className="text-lg font-medium mb-2">No matching orders</h3>
              <p className="text-muted-foreground mb-4">
                Try adjusting your filters to see more results.
              </p>
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <Button variant="outline" onClick={handleClearFilters}>Clear Filters</Button>
                <Button 
                  variant="outline" 
                  onClick={() => router.push('/support')}
                >
                  <HelpCircle className="mr-2 h-4 w-4" />
                  Get Support
                </Button>
              </div>
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
              <p className="text-muted-foreground mb-4">
                When you sell items, they will appear here.
              </p>
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <Button 
                  variant="outline" 
                  onClick={() => router.push('/support')}
                >
                  <HelpCircle className="mr-2 h-4 w-4" />
                  Need Help?
                </Button>
              </div>
            </div>
          ) : filteredSales.length === 0 ? (
            <div className="text-center py-12 border rounded-lg bg-background">
              <h3 className="text-lg font-medium mb-2">No matching sales</h3>
              <p className="text-muted-foreground mb-4">
                Try adjusting your filters to see more results.
              </p>
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <Button variant="outline" onClick={handleClearFilters}>Clear Filters</Button>
                <Button 
                  variant="outline" 
                  onClick={() => router.push('/support')}
                >
                  <HelpCircle className="mr-2 h-4 w-4" />
                  Get Support
                </Button>
              </div>
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