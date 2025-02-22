import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getFirebaseServices } from '@/lib/firebase';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { Order } from '@/types/order';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatPrice } from '@/lib/price';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';

export default function OrdersPage() {
  const { user } = useAuth();
  const [purchases, setPurchases] = useState<Order[]>([]);
  const [sales, setSales] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOrders() {
      if (!user) return;

      try {
        const { db } = getFirebaseServices();
        
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

        const [purchasesSnapshot, salesSnapshot] = await Promise.all([
          getDocs(purchasesQuery),
          getDocs(salesQuery)
        ]);

        const purchasesData = purchasesSnapshot.docs.map(doc => ({
          ...doc.data(),
          createdAt: doc.data().createdAt.toDate(),
          updatedAt: doc.data().updatedAt.toDate(),
        })) as Order[];

        const salesData = salesSnapshot.docs.map(doc => ({
          ...doc.data(),
          createdAt: doc.data().createdAt.toDate(),
          updatedAt: doc.data().updatedAt.toDate(),
        })) as Order[];

        setPurchases(purchasesData);
        setSales(salesData);
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
            {order.listingSnapshot.imageUrl ? (
              <Image
                src={order.listingSnapshot.imageUrl}
                alt={order.listingSnapshot.title}
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
            <h3 className="font-semibold text-lg mb-2">{order.listingSnapshot.title}</h3>
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
  }

  return (
    <DashboardLayout>
      <Card>
        <CardHeader>
          <CardTitle>Orders</CardTitle>
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