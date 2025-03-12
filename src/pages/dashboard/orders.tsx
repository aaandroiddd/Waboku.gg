import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebaseServices } from '@/lib/firebase';
import { collection, query, where, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { Order } from '@/types/order';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatPrice } from '@/lib/price';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/router';
import { toast } from 'sonner';

export default function OrdersPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [purchases, setPurchases] = useState<Order[]>([]);
  const [sales, setSales] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingOrder, setProcessingOrder] = useState(false);

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
            setLoading(true);
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

  useEffect(() => {
    async function fetchOrders() {
      if (!user) return;

      try {
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
      } finally {
        setLoading(false);
      }
    }

    fetchOrders();
  }, [user]);

  const OrderCard = ({ order }: { order: Order }) => (
    <Card className="mb-4">
      <CardContent className="pt-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative w-24 h-24 md:w-32 md:h-32">
            {order.listingSnapshot?.imageUrl ? (
              <Image
                src={order.listingSnapshot.imageUrl}
                alt={order.listingSnapshot.title || 'Order item'}
                fill
                className="object-cover rounded-lg"
              />
            ) : (
              <div className="w-full h-full bg-muted rounded-lg flex items-center justify-center">
                <span className="text-muted-foreground text-sm">No image</span>
              </div>
            )}
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg mb-2">
              {order.listingSnapshot?.title || `Order #${order.id.slice(0, 6)}`}
            </h3>
            <div className="space-y-2">
              <p className="text-muted-foreground">
                Order ID: <span className="font-mono">{order.id.slice(0, 8)}...</span>
              </p>
              <p className="text-muted-foreground">
                Date: {format(order.createdAt, 'PPP')}
              </p>
              <p className="font-semibold">{formatPrice(order.amount)}</p>
              <Badge
                variant={order.status === 'completed' ? 'default' : 'secondary'}
              >
                {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
              </Badge>
            </div>
          </div>
          {order.shippingAddress && (
            <div className="md:w-1/3">
              <h4 className="font-semibold mb-2">Shipping Address</h4>
              <div className="text-sm text-muted-foreground">
                <p>{order.shippingAddress.name}</p>
                <p>{order.shippingAddress.line1}</p>
                {order.shippingAddress.line2 && <p>{order.shippingAddress.line2}</p>}
                <p>
                  {order.shippingAddress.city}, {order.shippingAddress.state}{' '}
                  {order.shippingAddress.postal_code}
                </p>
                <p>{order.shippingAddress.country}</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      </DashboardLayout>
    );
  };

  return (
    <DashboardLayout>
      <Card>
        <CardHeader>
          <CardTitle>Orders Management</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="purchases">
            <TabsList>
              <TabsTrigger value="purchases">
                Purchases ({purchases.length})
              </TabsTrigger>
              <TabsTrigger value="sales">
                Sales ({sales.length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="purchases" className="mt-4">
              {purchases.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  You haven't made any purchases yet.
                </p>
              ) : (
                purchases.map((order) => (
                  <OrderCard key={order.id} order={order} />
                ))
              )}
            </TabsContent>
            <TabsContent value="sales" className="mt-4">
              {sales.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  You haven't made any sales yet.
                </p>
              ) : (
                sales.map((order) => (
                  <OrderCard key={order.id} order={order} />
                ))
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}