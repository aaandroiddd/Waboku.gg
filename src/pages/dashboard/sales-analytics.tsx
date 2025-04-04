import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingAnimation } from '@/components/LoadingAnimation';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getFirebaseServices } from '@/lib/firebase';
import { collection, query, where, orderBy, getDocs, getDoc, doc } from 'firebase/firestore';
import { Order } from '@/types/order';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { AlertCircle, DollarSign, Package, TrendingUp, Users, Calendar, ArrowUpRight, Download } from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, differenceInDays, addMonths, startOfDay, endOfDay } from 'date-fns';

type TimeRange = '7days' | '30days' | '90days' | 'thisMonth' | 'lastMonth' | 'allTime';

export default function SalesAnalytics() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<Order[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>('30days');
  const [hasStripeAccount, setHasStripeAccount] = useState(false);
  const [accountStatus, setAccountStatus] = useState<'none' | 'pending' | 'active' | 'error'>('none');

  // Fetch Stripe account status
  useEffect(() => {
    if (!user) return;

    const checkConnectAccount = async () => {
      try {
        const token = await user.getIdToken(true);
        
        const response = await fetch('/api/stripe/connect/account-status', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
        });

        if (!response.ok) {
          throw new Error('Failed to check account status');
        }

        const data = await response.json();
        setAccountStatus(data.status);
        setHasStripeAccount(data.status === 'active');
      } catch (error) {
        console.error('Error checking account status:', error);
        setAccountStatus('error');
      }
    };

    checkConnectAccount();
  }, [user]);

  // Fetch sales data
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchSales = async () => {
      try {
        setLoading(true);
        const { db } = getFirebaseServices();
        
        console.log('Fetching sales data for user:', user.uid);
        
        // Ensure we have a valid user ID
        if (!user.uid) {
          console.error('Invalid user ID for sales query');
          setSales([]);
          setLoading(false);
          return;
        }

        // First, try to fetch the specific order we know exists (for debugging)
        try {
          const specificOrderId = '0PEKaLYZcfnq2GkK2FFu';
          const specificOrderRef = doc(db, 'orders', specificOrderId);
          const specificOrderDoc = await getDoc(specificOrderRef);
          
          if (specificOrderDoc.exists()) {
            const data = specificOrderDoc.data();
            console.log(`Found specific order ${specificOrderId}:`, data);
            console.log(`Order seller ID: ${data.sellerId}, Current user ID: ${user.uid}`);
          } else {
            console.log(`Specific order ${specificOrderId} not found`);
          }
        } catch (err) {
          console.error('Error checking specific order:', err);
        }
        
        // Fetch sales from orders collection - try without the orderBy to avoid potential index issues
        const salesQuery = query(
          collection(db, 'orders'),
          where('sellerId', '==', user.uid)
        );

        console.log('Executing Firestore query with params:', {
          collection: 'orders',
          sellerId: user.uid,
          queryType: 'where'
        });

        const salesSnapshot = await getDocs(salesQuery);
        console.log(`Found ${salesSnapshot.docs.length} sales documents`);

        if (salesSnapshot.empty) {
          // Try a different approach - fetch all orders and filter client-side
          // This is less efficient but helps diagnose if there's an issue with the query
          console.log('No sales found with direct query, trying alternative approach...');
          
          try {
            const allOrdersQuery = query(collection(db, 'orders'));
            const allOrdersSnapshot = await getDocs(allOrdersQuery);
            console.log(`Found ${allOrdersSnapshot.docs.length} total orders in the database`);
            
            // Filter orders that belong to this seller
            const userOrders = allOrdersSnapshot.docs.filter(doc => {
              const data = doc.data();
              return data.sellerId === user.uid;
            });
            
            console.log(`Found ${userOrders.length} orders for this user after client-side filtering`);
            
            if (userOrders.length > 0) {
              // Process these orders instead
              const salesData = processOrderDocuments(userOrders, user.uid);
              setSales(salesData);
              setLoading(false);
              return;
            }
          } catch (err) {
            console.error('Error with alternative query approach:', err);
          }
          
          console.log('No sales found for this user after all attempts');
          setSales([]);
          setLoading(false);
          return;
        }

        const salesData = processOrderDocuments(salesSnapshot.docs, user.uid);
        console.log(`Successfully processed ${salesData.length} sales`);
        setSales(salesData);
      } catch (error) {
        console.error('Error fetching sales data:', error);
        setSales([]);
      } finally {
        setLoading(false);
      }
    };

    // Helper function to process order documents consistently
    const processOrderDocuments = (docs: any[], userId: string): Order[] => {
      return docs.map(doc => {
        try {
          const data = doc.data();
          console.log(`Processing sale document ${doc.id}:`, data);
          
          // Safely convert timestamps to dates
          let createdAt = new Date();
          let updatedAt = new Date();
          
          if (data.createdAt) {
            if (typeof data.createdAt.toDate === 'function') {
              createdAt = data.createdAt.toDate();
            } else if (data.createdAt instanceof Date) {
              createdAt = data.createdAt;
            } else if (typeof data.createdAt === 'string') {
              createdAt = new Date(data.createdAt);
            } else if (typeof data.createdAt === 'number') {
              createdAt = new Date(data.createdAt);
            }
          }
          
          if (data.updatedAt) {
            if (typeof data.updatedAt.toDate === 'function') {
              updatedAt = data.updatedAt.toDate();
            } else if (data.updatedAt instanceof Date) {
              updatedAt = data.updatedAt;
            } else if (typeof data.updatedAt === 'string') {
              updatedAt = new Date(data.updatedAt);
            } else if (typeof data.updatedAt === 'number') {
              updatedAt = new Date(data.updatedAt);
            }
          }
          
          // Ensure amount is a number
          let amount = 0;
          if (data.amount !== undefined && data.amount !== null) {
            if (typeof data.amount === 'number') {
              amount = data.amount;
            } else if (typeof data.amount === 'string') {
              amount = parseFloat(data.amount);
            } else if (data.paymentIntent && data.paymentIntent.amount) {
              // Try to get amount from payment intent if available
              amount = typeof data.paymentIntent.amount === 'number' ? 
                data.paymentIntent.amount / 100 : // Convert from cents if needed
                parseFloat(data.paymentIntent.amount) / 100;
            }
          }
          
          // Check if this is an order from an offer
          const isOfferOrder = data.offerPrice !== undefined;
          if (isOfferOrder) {
            console.log(`Processing order from offer: ${doc.id}, Amount: ${amount}, OfferPrice: ${data.offerPrice}`);
          }
          
          // Handle listing snapshot
          let listingSnapshot = data.listingSnapshot || {};
          if (!listingSnapshot.title && data.listing) {
            // Try to extract from listing field if available
            listingSnapshot = {
              title: data.listing.title || 'Unknown Product',
              price: data.listing.price || amount,
              imageUrl: data.listing.imageUrl || null
            };
          }
          
          return {
            id: doc.id,
            listingId: data.listingId || 'unknown',
            buyerId: data.buyerId || 'unknown',
            sellerId: data.sellerId || userId,
            amount: isNaN(amount) ? 0 : amount,
            status: data.status || 'pending',
            createdAt,
            updatedAt,
            listingSnapshot,
            paymentSessionId: data.paymentSessionId,
            paymentIntentId: data.paymentIntentId || (data.paymentIntent ? data.paymentIntent.id : undefined),
            transferId: data.transferId,
            transferAmount: data.transferAmount,
            platformFee: data.platformFee,
            paymentStatus: data.paymentStatus,
            shippingAddress: data.shippingAddress,
            trackingInfo: data.trackingInfo,
          };
        } catch (err) {
          console.error(`Error processing sale document ${doc.id}:`, err);
          // Return a minimal valid order object instead of null
          return {
            id: doc.id,
            listingId: 'unknown',
            buyerId: 'unknown',
            sellerId: userId,
            amount: 0,
            status: 'pending',
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        }
      }) as Order[];
    };

    // Always attempt to fetch sales data, even if hasStripeAccount is false
    // This ensures we can see if there's data that should be displayed
    fetchSales();
  }, [user]);

  // Filter sales based on selected time range
  const filteredSales = useMemo(() => {
    if (!sales.length) return [];

    const now = new Date();
    let startDate: Date;

    switch (timeRange) {
      case '7days':
        startDate = subDays(now, 7);
        break;
      case '30days':
        startDate = subDays(now, 30);
        break;
      case '90days':
        startDate = subDays(now, 90);
        break;
      case 'thisMonth':
        startDate = startOfMonth(now);
        break;
      case 'lastMonth':
        const lastMonth = addMonths(now, -1);
        startDate = startOfMonth(lastMonth);
        return sales.filter(sale => {
          const saleDate = new Date(sale.createdAt);
          return saleDate >= startOfMonth(lastMonth) && saleDate <= endOfMonth(lastMonth);
        });
      case 'allTime':
        return sales;
      default:
        startDate = subDays(now, 30);
    }

    return sales.filter(sale => {
      return new Date(sale.createdAt) >= startDate;
    });
  }, [sales, timeRange]);

  // Calculate sales metrics
  const metrics = useMemo(() => {
    if (!filteredSales.length) {
      return {
        totalSales: 0,
        totalRevenue: 0,
        averageOrderValue: 0,
        completedOrders: 0,
        pendingOrders: 0,
        cancelledOrders: 0,
      };
    }

    const totalRevenue = filteredSales.reduce((sum, sale) => sum + (sale.amount || 0), 0);
    const completedOrders = filteredSales.filter(sale => 
      ['completed', 'shipped'].includes(sale.status)
    ).length;
    const pendingOrders = filteredSales.filter(sale => 
      ['pending', 'paid', 'awaiting_shipping'].includes(sale.status) || !sale.status || sale.status === ''
    ).length;
    const cancelledOrders = filteredSales.filter(sale => 
      sale.status === 'cancelled'
    ).length;

    return {
      totalSales: filteredSales.length,
      totalRevenue,
      averageOrderValue: totalRevenue / filteredSales.length,
      completedOrders,
      pendingOrders,
      cancelledOrders,
    };
  }, [filteredSales]);

  // Prepare data for charts
  const dailySalesData = useMemo(() => {
    if (!filteredSales.length) return [];

    const salesByDay = new Map<string, { date: string, sales: number, revenue: number }>(); 
    
    // Determine date range based on timeRange
    const now = new Date();
    let startDate: Date;
    let endDate = now;
    
    switch (timeRange) {
      case '7days':
        startDate = subDays(now, 7);
        break;
      case '30days':
        startDate = subDays(now, 30);
        break;
      case '90days':
        startDate = subDays(now, 90);
        break;
      case 'thisMonth':
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        break;
      case 'lastMonth':
        const lastMonth = addMonths(now, -1);
        startDate = startOfMonth(lastMonth);
        endDate = endOfMonth(lastMonth);
        break;
      case 'allTime':
        if (filteredSales.length > 0) {
          // Find earliest sale date
          startDate = filteredSales.reduce((earliest, sale) => {
            return sale.createdAt < earliest ? sale.createdAt : earliest;
          }, filteredSales[0].createdAt);
        } else {
          startDate = subDays(now, 30);
        }
        break;
      default:
        startDate = subDays(now, 30);
    }
    
    // Initialize all days in the range with zero values
    const dayCount = differenceInDays(endDate, startDate) + 1;
    for (let i = 0; i < dayCount; i++) {
      const date = addDays(startDate, i);
      const dateStr = format(date, 'MMM dd');
      salesByDay.set(dateStr, { date: dateStr, sales: 0, revenue: 0 });
    }
    
    // Populate with actual sales data
    filteredSales.forEach(sale => {
      const dateStr = format(new Date(sale.createdAt), 'MMM dd');
      const existing = salesByDay.get(dateStr) || { date: dateStr, sales: 0, revenue: 0 };
      
      salesByDay.set(dateStr, {
        date: dateStr,
        sales: existing.sales + 1,
        revenue: existing.revenue + (sale.amount || 0)
      });
    });
    
    return Array.from(salesByDay.values());
  }, [filteredSales, timeRange]);

  // Status distribution data for pie chart
  const statusDistributionData = useMemo(() => {
    if (!filteredSales.length) return [];

    const statusCounts = filteredSales.reduce((acc, sale) => {
      // For orders with awaiting_payment status, use that as the primary status
      if (sale.paymentStatus === 'awaiting_payment') {
        acc['awaiting_payment'] = (acc['awaiting_payment'] || 0) + 1;
      } else {
        // Handle orders with missing status as 'pending'
        const status = sale.status || 'pending';
        acc[status] = (acc[status] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(statusCounts).map(([status, count]) => ({
      name: formatStatus(status),
      value: count,
    }));
  }, [filteredSales]);

  // Helper function to format status for display
  function formatStatus(status: string): string {
    switch (status) {
      case 'pending': return 'Pending';
      case 'paid': return 'Paid';
      case 'awaiting_shipping': return 'Awaiting Shipping';
      case 'shipped': return 'Shipped';
      case 'completed': return 'Completed';
      case 'cancelled': return 'Cancelled';
      case 'awaiting_payment': return 'Awaiting Payment';
      default: return status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ');
    }
  }

  // Helper function to add days to a date
  function addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  // Handle export of sales data
  const handleExportSalesData = () => {
    if (filteredSales.length === 0) {
      return;
    }
    
    // Create CSV content
    const headers = ['Order #', 'Date', 'Buyer', 'Product', 'Amount', 'Status'];
    const csvContent = [
      headers.join(','),
      ...filteredSales.map(order => {
        const date = format(order.createdAt, 'MM/dd/yyyy');
        const product = order.listingSnapshot?.title || 'Unknown Product';
        const amount = order.amount.toFixed(2);
        const status = formatStatus(order.status);
        
        return [
          order.id,
          date,
          'Buyer', // Placeholder as we don't display buyer info
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
    link.setAttribute('download', `sales-data-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Colors for pie chart
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#FF6B6B'];

  return (
    <DashboardLayout>
      {loading && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <LoadingAnimation size="80" color="currentColor" className="text-primary" />
        </div>
      )}
      
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex flex-col space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Sales Analytics</h1>
          <p className="text-muted-foreground">
            Track your sales performance and revenue metrics
          </p>
        </div>

        <Separator />

        {!hasStripeAccount && (
          <Alert className="bg-primary/10 border-primary mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Stripe Connect Recommended</AlertTitle>
            <AlertDescription className="flex flex-col sm:flex-row sm:items-center gap-4">
              <span>Setting up a Stripe Connect account is recommended for full sales analytics features.</span>
              <Button 
                onClick={() => router.push('/dashboard/connect-account')}
                size="sm"
                className="sm:ml-auto"
              >
                Set Up Stripe Connect
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <Select
            value={timeRange}
            onValueChange={(value) => setTimeRange(value as TimeRange)}
          >
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Select time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7days">Last 7 days</SelectItem>
              <SelectItem value="30days">Last 30 days</SelectItem>
              <SelectItem value="90days">Last 90 days</SelectItem>
              <SelectItem value="thisMonth">This month</SelectItem>
              <SelectItem value="lastMonth">Last month</SelectItem>
              <SelectItem value="allTime">All time</SelectItem>
            </SelectContent>
          </Select>

          <Button 
            variant="outline" 
            size="sm"
            onClick={handleExportSalesData}
            disabled={filteredSales.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            Export Data
          </Button>
        </div>

        {!loading && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Sales Card */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Orders
                  </CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.totalSales}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {timeRangeToText(timeRange)}
                  </p>
                </CardContent>
              </Card>

              {/* Total Revenue Card */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Revenue
                  </CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ${metrics.totalRevenue.toFixed(2)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {timeRangeToText(timeRange)}
                  </p>
                </CardContent>
              </Card>

              {/* Average Order Value Card */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Average Order Value
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ${metrics.averageOrderValue.toFixed(2)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {timeRangeToText(timeRange)}
                  </p>
                </CardContent>
              </Card>

              {/* Order Status Card */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Order Status
                  </CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs">Completed:</span>
                      <Badge variant="outline" className="text-xs">{metrics.completedOrders}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs">Pending:</span>
                      <Badge variant="outline" className="text-xs">{metrics.pendingOrders}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs">Cancelled:</span>
                      <Badge variant="outline" className="text-xs">{metrics.cancelledOrders}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
              {/* Sales Over Time Chart */}
              <Card className="col-span-1 lg:col-span-2">
                <CardHeader>
                  <CardTitle>Sales Over Time</CardTitle>
                  <CardDescription>
                    Number of orders and revenue by day
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-80">
                  {dailySalesData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={dailySalesData}
                        margin={{
                          top: 5,
                          right: 30,
                          left: 20,
                          bottom: 5,
                        }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                        <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                        <Tooltip />
                        <Bar yAxisId="left" dataKey="sales" fill="#8884d8" name="Orders" />
                        <Bar yAxisId="right" dataKey="revenue" fill="#82ca9d" name="Revenue ($)" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-muted-foreground">No sales data available</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Order Status Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle>Order Status Distribution</CardTitle>
                  <CardDescription>
                    Breakdown of orders by status
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-80">
                  {statusDistributionData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusDistributionData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={renderCustomizedLabel}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {statusDistributionData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-muted-foreground">No status data available</p>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="flex flex-wrap gap-2 justify-center">
                  {statusDistributionData.map((entry, index) => (
                    <div key={`legend-${index}`} className="flex items-center">
                      <div 
                        className="w-3 h-3 mr-1" 
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-xs">{entry.name}</span>
                    </div>
                  ))}
                </CardFooter>
              </Card>
            </div>

            {/* Recent Sales Table */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Sales</CardTitle>
                <CardDescription>
                  Your most recent orders
                </CardDescription>
              </CardHeader>
              <CardContent>
                {filteredSales.length > 0 ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-5 text-xs font-medium text-muted-foreground">
                      <div>Date</div>
                      <div className="col-span-2">Product</div>
                      <div>Status</div>
                      <div className="text-right">Amount</div>
                    </div>
                    <Separator />
                    {filteredSales.slice(0, 5).map((sale) => (
                      <div 
                        key={sale.id} 
                        className="grid grid-cols-5 text-sm py-2 hover:bg-muted/50 rounded-md cursor-pointer transition-colors"
                        onClick={() => router.push(`/dashboard/orders/${sale.id}`)}
                      >
                        <div>{format(sale.createdAt, 'MMM dd, yyyy')}</div>
                        <div className="col-span-2 truncate">{sale.listingSnapshot?.title || 'Unknown Product'}</div>
                        <div>
                          <Badge variant="outline">
                            {sale.paymentStatus === 'awaiting_payment' 
                              ? formatStatus('awaiting_payment') 
                              : formatStatus(sale.status)}
                          </Badge>
                        </div>
                        <div className="text-right font-medium">${sale.amount.toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-muted-foreground">No recent sales</p>
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex flex-col sm:flex-row gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  onClick={() => router.push('/dashboard/orders?tab=sales')}
                >
                  View All Sales
                </Button>
                <Button 
                  variant="default" 
                  size="sm" 
                  className="w-full"
                  onClick={() => router.push('/dashboard/orders/index')}
                >
                  Manage Orders
                </Button>
              </CardFooter>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

// Helper function to render custom labels in the pie chart
const renderCustomizedLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}: {
  cx: number;
  cy: number;
  midAngle: number;
  innerRadius: number;
  outerRadius: number;
  percent: number;
}) => {
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

// Helper function to convert time range to display text
function timeRangeToText(range: TimeRange): string {
  switch (range) {
    case '7days': return 'Last 7 days';
    case '30days': return 'Last 30 days';
    case '90days': return 'Last 90 days';
    case 'thisMonth': return 'This month';
    case 'lastMonth': return 'Last month';
    case 'allTime': return 'All time';
    default: return '';
  }
}