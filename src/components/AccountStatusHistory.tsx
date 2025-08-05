import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  CreditCard, 
  XCircle, 
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Wifi,
  WifiOff
} from 'lucide-react';

interface SubscriptionEvent {
  id: string;
  type: 'subscription_created' | 'subscription_updated' | 'subscription_canceled' | 'subscription_continued' | 'payment_succeeded' | 'payment_failed' | 'admin_update' | 'tier_changed';
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

interface HistoryResponse {
  events: SubscriptionEvent[];
  paymentMethods: PaymentMethod[];
  hasMore: boolean;
  lastEventId?: string;
  currentPage: number;
  totalPages: number;
  limit: number;
  cached?: boolean;
  timestamp: string;
}

interface ErrorState {
  message: string;
  code?: string;
  retryable: boolean;
}

export function AccountStatusHistory() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [events, setEvents] = useState<SubscriptionEvent[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [error, setError] = useState<ErrorState | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [lastEventId, setLastEventId] = useState<string | undefined>();
  const [isOnline, setIsOnline] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  
  const limit = 10; // Items per page

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const fetchAccountHistory = useCallback(async (page: number = 1, append: boolean = false) => {
    if (!user) return;
    
    try {
      if (!append) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }
      setError(null);
      
      // Get a fresh token
      const idToken = await user.getIdToken(true);
      
      // Build query parameters
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      });
      
      if (append && lastEventId) {
        params.append('startAfter', lastEventId);
      }
      
      // Fetch subscription history from API
      const response = await fetch(`/api/stripe/subscription-history?${params}`, {
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data: HistoryResponse = await response.json();
      
      if (append) {
        setEvents(prev => [...prev, ...data.events]);
      } else {
        setEvents(data.events);
        setPaymentMethods(data.paymentMethods || []);
      }
      
      setHasMore(data.hasMore);
      setLastEventId(data.lastEventId);
      setCurrentPage(data.currentPage);
      setTotalPages(data.totalPages);
      setRetryCount(0); // Reset retry count on success
      
    } catch (err: any) {
      console.error('Error fetching account history:', err);
      
      // Determine if error is retryable
      const isRetryable = !err.message?.includes('401') && 
                         !err.message?.includes('403') && 
                         !err.message?.includes('INVALID_TOKEN') &&
                         isOnline;
      
      setError({
        message: err.message || 'Failed to load account history',
        code: err.code,
        retryable: isRetryable
      });
      
      // Auto-retry for network errors (up to 3 times)
      if (isRetryable && retryCount < 3) {
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          fetchAccountHistory(page, append);
        }, Math.pow(2, retryCount) * 1000); // Exponential backoff
      }
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [user, lastEventId, retryCount, isOnline]);

  // Initial load
  useEffect(() => {
    if (user) {
      fetchAccountHistory(1, false);
    }
  }, [user]);

  // Retry function
  const handleRetry = useCallback(() => {
    setRetryCount(0);
    fetchAccountHistory(currentPage, false);
  }, [fetchAccountHistory, currentPage]);

  // Load more function
  const handleLoadMore = useCallback(() => {
    if (hasMore && !isLoadingMore) {
      fetchAccountHistory(currentPage + 1, true);
    }
  }, [fetchAccountHistory, hasMore, isLoadingMore, currentPage]);

  // Pagination functions
  const handlePreviousPage = useCallback(() => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
      fetchAccountHistory(currentPage - 1, false);
    }
  }, [currentPage, fetchAccountHistory]);

  const handleNextPage = useCallback(() => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
      fetchAccountHistory(currentPage + 1, false);
    }
  }, [currentPage, totalPages, fetchAccountHistory]);

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Invalid date';
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'subscription_created':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'subscription_updated':
        return <Clock className="h-5 w-5 text-blue-500" />;
      case 'subscription_canceled':
        return <XCircle className="h-5 w-5 text-amber-500" />;
      case 'subscription_continued':
        return <RefreshCw className="h-5 w-5 text-green-500" />;
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

  // Progressive loading skeleton
  const LoadingSkeleton = ({ count = 3 }: { count?: number }) => (
    <div className="space-y-4">
      {Array(count).fill(0).map((_, i) => (
        <div key={i} className="flex items-center gap-4 animate-pulse">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );

  // Error display component
  const ErrorDisplay = ({ error, onRetry }: { error: ErrorState; onRetry: () => void }) => (
    <Alert className="border-red-200 dark:border-red-800">
      <div className="flex items-start gap-3">
        {isOnline ? (
          <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
        ) : (
          <WifiOff className="h-5 w-5 text-red-500 mt-0.5" />
        )}
        <div className="flex-1">
          <AlertDescription className="text-red-700 dark:text-red-300">
            {!isOnline ? 'You appear to be offline. Please check your internet connection.' : error.message}
            {error.code && (
              <span className="block text-sm text-red-600 dark:text-red-400 mt-1">
                Error code: {error.code}
              </span>
            )}
          </AlertDescription>
          {error.retryable && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onRetry}
              className="mt-2"
              disabled={!isOnline}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          )}
        </div>
      </div>
    </Alert>
  );

  if (isLoading && events.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Account History
            {!isOnline && <WifiOff className="h-5 w-5 text-amber-500" />}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <LoadingSkeleton />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            Account History
            {!isOnline && <WifiOff className="h-5 w-5 text-amber-500" />}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchAccountHistory(1, false)}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error && <ErrorDisplay error={error} onRetry={handleRetry} />}
        
        <Tabs defaultValue="history">
          <TabsList className="mb-4">
            <TabsTrigger value="history">
              Subscription History
              {events.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {events.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="payment">
              Payment Methods
              {paymentMethods.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {paymentMethods.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="history">
            {events.length === 0 && !isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No subscription history found.</p>
                <p className="text-sm mt-2">Your account activity will appear here.</p>
              </div>
            ) : (
              <>
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-4">
                    {events.map((event, index) => (
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
                                
                                {event.details.renewalDate && event.type === 'subscription_continued' && (
                                  <div>
                                    <span className="text-muted-foreground">Next Renewal:</span>{' '}
                                    {formatDate(event.details.renewalDate)}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {/* Progressive loading indicator */}
                    {isLoadingMore && (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        <span className="ml-2 text-sm text-muted-foreground">Loading more...</span>
                      </div>
                    )}
                  </div>
                </ScrollArea>
                
                {/* Pagination Controls */}
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePreviousPage}
                      disabled={currentPage <= 1 || isLoading}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleNextPage}
                      disabled={currentPage >= totalPages || isLoading}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>
                      Page {currentPage} of {totalPages}
                    </span>
                    {hasMore && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleLoadMore}
                        disabled={isLoadingMore}
                      >
                        {isLoadingMore ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : null}
                        Load More
                      </Button>
                    )}
                  </div>
                </div>
              </>
            )}
          </TabsContent>
          
          <TabsContent value="payment">
            {paymentMethods.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No payment methods found.</p>
                <p className="text-sm mt-2">Your saved payment methods will appear here.</p>
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