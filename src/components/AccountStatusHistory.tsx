import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, CheckCircle, Clock, CreditCard, XCircle } from 'lucide-react';

interface SubscriptionEvent {
  id: string;
  type: 'subscription_created' | 'subscription_updated' | 'subscription_canceled' | 'payment_succeeded' | 'payment_failed' | 'admin_update' | 'tier_changed';
  date: string;
  description: string;
  details?: {
    status?: string;
    tier?: string;
    amount?: number;
    cardBrand?: string;
    cardLast4?: string;
    cancelAtPeriodEnd?: boolean;
    endDate?: string;
    renewalDate?: string;
  };
}

interface PaymentMethod {
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
}

export function AccountStatusHistory() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [events, setEvents] = useState<SubscriptionEvent[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAccountHistory = async () => {
      if (!user) return;
      
      try {
        setIsLoading(true);
        setError(null);
        
        // Get a fresh token
        const idToken = await user.getIdToken(true);
        
        // Fetch subscription history from Firestore and Stripe
        const response = await fetch('/api/stripe/subscription-history', {
          headers: {
            'Authorization': `Bearer ${idToken}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch account history');
        }
        
        const data = await response.json();
        setEvents(data.events || []);
        setPaymentMethods(data.paymentMethods || []);
      } catch (err) {
        console.error('Error fetching account history:', err);
        setError('Failed to load account history. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchAccountHistory();
  }, [user]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'subscription_created':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'subscription_updated':
        return <Clock className="h-5 w-5 text-blue-500" />;
      case 'subscription_canceled':
        return <XCircle className="h-5 w-5 text-amber-500" />;
      case 'payment_succeeded':
        return <CreditCard className="h-5 w-5 text-green-500" />;
      case 'payment_failed':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'admin_update':
        return <CheckCircle className="h-5 w-5 text-purple-500" />;
      case 'tier_changed':
        return <CheckCircle className="h-5 w-5 text-blue-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusBadge = (status?: string) => {
    if (!status) return null;
    
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500">Active</Badge>;
      case 'canceled':
        return <Badge className="bg-amber-500">Canceled</Badge>;
      case 'inactive':
        return <Badge className="bg-gray-500">Inactive</Badge>;
      case 'payment_failed':
        return <Badge className="bg-red-500">Payment Failed</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Account History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array(3).fill(0).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Account History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-4 border rounded-md bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
            {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account History</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="history">
          <TabsList className="mb-4">
            <TabsTrigger value="history">Subscription History</TabsTrigger>
            <TabsTrigger value="payment">Payment Methods</TabsTrigger>
          </TabsList>
          
          <TabsContent value="history">
            {events.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No subscription history found.
              </div>
            ) : (
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-4">
                  {events.map((event) => (
                    <div key={event.id} className="relative pl-6 pb-8">
                      <div className="absolute left-0 top-0 h-full w-[1px] bg-border" />
                      <div className="absolute left-[-4px] top-1 h-2 w-2 rounded-full bg-primary" />
                      
                      <div className="flex items-start gap-3 mb-2">
                        <div className="mt-0.5">
                          {getEventIcon(event.type)}
                        </div>
                        <div className="flex-1">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                            <h4 className="font-medium">{event.description}</h4>
                            <time className="text-sm text-muted-foreground">
                              {formatDate(event.date)}
                            </time>
                          </div>
                          
                          {event.details && (
                            <div className="mt-2 text-sm space-y-1">
                              {event.details.status && (
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground">Status:</span>
                                  {getStatusBadge(event.details.status)}
                                </div>
                              )}
                              
                              {event.details.tier && (
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground">Plan:</span>
                                  <Badge className={event.details.tier === 'premium' ? 'bg-blue-500' : 'bg-gray-500'}>
                                    {event.details.tier === 'premium' ? 'Premium' : 'Free'}
                                  </Badge>
                                </div>
                              )}
                              
                              {event.details.amount && (
                                <div>
                                  <span className="text-muted-foreground">Amount:</span>{' '}
                                  ${event.details.amount.toFixed(2)}
                                </div>
                              )}
                              
                              {event.details.cardBrand && event.details.cardLast4 && (
                                <div>
                                  <span className="text-muted-foreground">Payment Method:</span>{' '}
                                  {event.details.cardBrand.charAt(0).toUpperCase() + event.details.cardBrand.slice(1)} •••• {event.details.cardLast4}
                                </div>
                              )}
                              
                              {event.details.endDate && (
                                <div>
                                  <span className="text-muted-foreground">End Date:</span>{' '}
                                  {formatDate(event.details.endDate)}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
          
          <TabsContent value="payment">
            {paymentMethods.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No payment methods found.
              </div>
            ) : (
              <div className="space-y-4">
                {paymentMethods.map((method, index) => (
                  <div key={index} className="flex items-center gap-4 p-4 border rounded-md">
                    <div className="h-10 w-10 flex items-center justify-center rounded-full bg-muted">
                      <CreditCard className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-medium">
                        {method.brand.charAt(0).toUpperCase() + method.brand.slice(1)} •••• {method.last4}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Expires {method.exp_month.toString().padStart(2, '0')}/{method.exp_year}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}