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
import { Loader2, RefreshCw, Filter, Search, ArrowUpDown, Download } from 'lucide-react';
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
  DropdownMenuLabel
} from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';

const OrdersComponent = () => {
  const { user } = useAuth();
  const router = useRouter();
  const { clearUnreadCount, resetUnreadCount } = useUnread();
  const [purchases, setPurchases] = useState<Order[]>([]);
  const [sales, setSales] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingOrder, setProcessingOrder] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
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
          
          // Fetch sales
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
            <h1 className="text-3xl font-bold tracking-tight pl-5">Orders Dashboard</h1>
            <p className="text-muted-foreground mt-1 pl-5">
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

      <Tabs defaultValue={router.query.tab === 'sales' ? 'sales' : 'purchases'} className="space-y-4">
        <TabsList>
          <TabsTrigger value="purchases">Purchases ({purchases.length})</TabsTrigger>
          <TabsTrigger value="sales">Sales ({sales.length})</TabsTrigger>
        </TabsList>
        
        <TabsContent value="purchases" className="space-y-4">
          {purchases.length === 0 ? (
            <div className="text-center py-12 border rounded-lg bg-background">
              <h3 className="text-lg font-medium mb-2">No purchases yet</h3>
              <p className="text-muted-foreground">
                When you buy items, they will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {purchases.map((order) => (
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
          ) : (
            <div className="space-y-4">
              {sales.map((order) => (
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