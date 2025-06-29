import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  HelpCircle, 
  MessageCircle, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Send,
  Plus,
  ArrowLeft,
  Calendar,
  User,
  AlertTriangle,
  RefreshCw,
  Filter,
  SortAsc,
  SortDesc,
  X
} from "lucide-react";
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/components/ui/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { TimestampTooltip } from '@/components/ui/timestamp-tooltip';

const DashboardLayout = dynamic(
  () => import('@/components/dashboard/DashboardLayout').then(mod => mod.DashboardLayout),
  {
    loading: () => (
      <div className="p-8">
        <Skeleton className="w-full h-[200px]" />
      </div>
    ),
    ssr: false
  }
);

interface TicketResponse {
  id: string;
  message: string;
  isFromSupport: boolean;
  authorName: string;
  authorEmail: string;
  createdAt: Date;
}

interface SupportTicket {
  ticketId: string;
  userId: string;
  userEmail: string;
  userName: string;
  subject: string;
  category: string;
  priority: string;
  priorityLevel: number;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  createdAt: Date;
  updatedAt: Date;
  responses: TicketResponse[];
  lastResponseAt?: Date;
  hasUnreadResponses?: boolean;
}

const SupportTicketsPageContent = () => {
  console.log('=== SUPPORT TICKETS PAGE COMPONENT LOADED ===');
  console.log('Component render time:', new Date().toISOString());
  
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  console.log('=== AUTH CONTEXT STATE ===');
  console.log('User exists:', !!user);
  console.log('User ID:', user?.uid);
  console.log('User email:', user?.email);
  console.log('Current URL:', typeof window !== 'undefined' ? window.location.href : 'SSR');
  
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingResponse, setIsSubmittingResponse] = useState(false);
  const [error, setError] = useState("");
  const [responseMessage, setResponseMessage] = useState("");
  
  // Filter and sort states
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('date_asc');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Function to clear all authentication and cache data
  const clearAuthCache = () => {
    if (typeof window !== 'undefined') {
      console.log('Clearing all authentication and cache data...');
      
      // Clear all localStorage items that might contain cached user data
      const keysToRemove = Object.keys(localStorage).filter(key => 
        key.includes('firebase') || 
        key.includes('auth') || 
        key.includes('user') || 
        key.includes('support') || 
        key.includes('ticket') ||
        key.includes('waboku')
      );
      
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        console.log('Removed cache key:', key);
      });
      
      // Clear sessionStorage as well
      const sessionKeys = Object.keys(sessionStorage).filter(key => 
        key.includes('firebase') || 
        key.includes('auth') || 
        key.includes('user') || 
        key.includes('support') || 
        key.includes('ticket')
      );
      
      sessionKeys.forEach(key => {
        sessionStorage.removeItem(key);
        console.log('Removed session key:', key);
      });
    }
  };

  // Redirect if not authenticated
  useEffect(() => {
    console.log('=== USEEFFECT TRIGGERED ===');
    console.log('User exists:', !!user);
    if (user) {
      console.log('User ID in useEffect:', user.uid);
      console.log('User email in useEffect:', user.email);
    }
    
    if (!user) {
      console.log('No user, redirecting to sign-in');
      router.push('/auth/sign-in?redirect=/dashboard/support-tickets');
      return;
    }
    
    // Clear cache and fetch tickets
    clearAuthCache();
    console.log('Calling fetchTickets from useEffect');
    fetchTickets();
  }, [user, router]);

  // Auto-refresh tickets when the page becomes visible (user navigates back)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && user) {
        console.log('Page became visible, refreshing support tickets...');
        fetchTickets();
      }
    };

    const handleFocus = () => {
      if (user) {
        console.log('Window focused, refreshing support tickets...');
        fetchTickets();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [user]);

  const fetchTickets = async () => {
    if (!user) return;
    
    try {
      console.log('=== USER SUPPORT TICKETS FETCH START ===');
      console.log('User ID:', user.uid);
      console.log('User email:', user.email);
      
      setIsLoading(true);
      
      // Force token refresh to ensure we have the latest authentication state
      console.log('Forcing token refresh to ensure fresh authentication...');
      const token = await user.getIdToken(true); // Force refresh with true parameter
      if (!token) throw new Error("Authentication required");
      
      console.log('Fresh token obtained, length:', token.length);
      
      // Clear any cached data that might be causing issues
      if (typeof window !== 'undefined') {
        // Clear any support ticket related cache
        const cacheKeys = Object.keys(localStorage).filter(key => 
          key.includes('support') || key.includes('ticket')
        );
        cacheKeys.forEach(key => localStorage.removeItem(key));
        console.log('Cleared support ticket cache keys:', cacheKeys);
      }
      
      // Add cache-busting parameters and headers
      const cacheBuster = Date.now();
      console.log('Making API call to /api/support/get-tickets with fresh token and cache buster');

      const response = await fetch(`/api/support/get-tickets?_t=${cacheBuster}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
      });

      console.log('User support tickets API response status:', response.status);
      console.log('User support tickets API response ok:', response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('User support tickets API error response:', errorText);
        
        // If we get an auth error, try to refresh the user's auth state
        if (response.status === 401) {
          console.log('Authentication error detected, reloading user auth state...');
          try {
            await user.reload();
            console.log('User auth state reloaded');
            // Try one more time with a fresh token
            const freshToken = await user.getIdToken(true);
            const retryResponse = await fetch(`/api/support/get-tickets?_t=${Date.now()}`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${freshToken}`,
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
              },
            });
            
            if (retryResponse.ok) {
              const retryData = await retryResponse.json();
              console.log('Retry successful after auth refresh, tickets:', retryData.tickets?.length || 0);
              setTickets(retryData.tickets || []);
              setError("");
              console.log('=== USER SUPPORT TICKETS FETCH END (RETRY SUCCESS) ===');
              return;
            }
          } catch (retryError) {
            console.error('Retry after auth refresh failed:', retryError);
          }
        }
        
        throw new Error('Failed to fetch tickets');
      }

      const data = await response.json();
      console.log('User support tickets API response data:', data);
      console.log('Number of user tickets received:', data.tickets?.length || 0);
      
      if (data.tickets && data.tickets.length > 0) {
        console.log('First user ticket details:', {
          ticketId: data.tickets[0].ticketId,
          userId: data.tickets[0].userId,
          userEmail: data.tickets[0].userEmail,
          subject: data.tickets[0].subject,
          status: data.tickets[0].status,
          updatedAt: data.tickets[0].updatedAt
        });
      }
      
      setTickets(data.tickets || []);
      setError(""); // Clear any previous errors
      console.log('=== USER SUPPORT TICKETS FETCH END ===');
    } catch (err: any) {
      console.error('Error fetching user support tickets:', err);
      setError(err.message || 'Failed to load support tickets');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTicketClick = async (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    
    // Mark ticket as read if it has unread responses
    if (ticket.hasUnreadResponses) {
      try {
        const token = await user?.getIdToken();
        if (token) {
          await fetch('/api/support/mark-read', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ ticketId: ticket.ticketId }),
          });
          
          // Update local state
          setTickets(prev => prev.map(t => 
            t.ticketId === ticket.ticketId 
              ? { ...t, hasUnreadResponses: false }
              : t
          ));
        }
      } catch (err) {
        console.error('Error marking ticket as read:', err);
      }
    }
  };

  const handleSubmitResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !responseMessage.trim()) return;

    setIsSubmittingResponse(true);
    try {
      const token = await user?.getIdToken();
      if (!token) throw new Error("Authentication required");

      const response = await fetch('/api/support/add-response', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          ticketId: selectedTicket.ticketId,
          message: responseMessage.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit response');
      }

      const data = await response.json();
      
      // Update the selected ticket with the new response
      const updatedTicket = {
        ...selectedTicket,
        responses: [...selectedTicket.responses, data.response],
        updatedAt: new Date(),
        status: 'open' as const
      };
      
      setSelectedTicket(updatedTicket);
      
      // Update tickets list
      setTickets(prev => prev.map(t => 
        t.ticketId === selectedTicket.ticketId ? updatedTicket : t
      ));
      
      setResponseMessage("");
      toast({
        title: "Response sent",
        description: "Your response has been added to the ticket.",
      });
    } catch (err: any) {
      console.error('Error submitting response:', err);
      toast({
        title: "Error",
        description: err.message || 'Failed to submit response',
        variant: "destructive",
      });
    } finally {
      setIsSubmittingResponse(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open':
        return <Clock className="h-4 w-4" />;
      case 'in_progress':
        return <MessageCircle className="h-4 w-4" />;
      case 'resolved':
        return <CheckCircle className="h-4 w-4" />;
      case 'closed':
        return <XCircle className="h-4 w-4" />;
      default:
        return <HelpCircle className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'resolved':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'closed':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'high':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
      case 'medium':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'low':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  // Filter and sort tickets
  const getFilteredAndSortedTickets = () => {
    let filteredTickets = [...tickets];

    // Apply status filter
    if (statusFilter !== 'all') {
      filteredTickets = filteredTickets.filter(ticket => ticket.status === statusFilter);
    }

    // Apply priority filter
    if (priorityFilter !== 'all') {
      filteredTickets = filteredTickets.filter(ticket => ticket.priority === priorityFilter);
    }

    // Apply sorting - default to ascending by creation date (oldest first)
    filteredTickets.sort((a, b) => {
      switch (sortBy) {
        case 'date_asc':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'date_desc':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'status':
          const statusOrder = { 'open': 1, 'in_progress': 2, 'resolved': 3, 'closed': 4 };
          const aStatus = statusOrder[a.status] || 5;
          const bStatus = statusOrder[b.status] || 5;
          return sortOrder === 'asc' ? aStatus - bStatus : bStatus - aStatus;
        case 'priority':
          const priorityOrder = { 'critical': 1, 'high': 2, 'medium': 3, 'low': 4 };
          const aPriority = priorityOrder[a.priority] || 5;
          const bPriority = priorityOrder[b.priority] || 5;
          return sortOrder === 'asc' ? aPriority - bPriority : bPriority - aPriority;
        case 'updated':
          return sortOrder === 'asc' 
            ? new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
            : new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        default:
          // Default: ascending by creation date (oldest first)
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
    });

    return filteredTickets;
  };

  // Clear all filters
  const clearFilters = () => {
    setStatusFilter('all');
    setPriorityFilter('all');
    setSortBy('date_asc');
    setSortOrder('asc');
  };

  // Check if any filters are active
  const hasActiveFilters = statusFilter !== 'all' || priorityFilter !== 'all' || sortBy !== 'date_asc';

  const displayedTickets = getFilteredAndSortedTickets();

  if (!user) {
    return <Skeleton className="w-full h-[400px]" />;
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="container mx-auto p-6">
          <div className="space-y-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (selectedTicket) {
    return (
      <DashboardLayout>
        <Toaster />
        <div className="container mx-auto p-6 max-w-4xl">
          <div className="mb-6">
            <Button 
              variant="ghost" 
              onClick={() => setSelectedTicket(null)}
              className="mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Tickets
            </Button>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <CardTitle className="text-xl">
                    #{selectedTicket.ticketId} - {selectedTicket.subject}
                  </CardTitle>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={getStatusColor(selectedTicket.status)}>
                      {getStatusIcon(selectedTicket.status)}
                      <span className="ml-1 capitalize">{selectedTicket.status.replace('_', ' ')}</span>
                    </Badge>
                    <Badge className={getPriorityColor(selectedTicket.priority)}>
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {selectedTicket.priority.charAt(0).toUpperCase() + selectedTicket.priority.slice(1)}
                    </Badge>
                    <Badge variant="outline">
                      {selectedTicket.category.charAt(0).toUpperCase() + selectedTicket.category.slice(1)}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Created <TimestampTooltip date={selectedTicket.createdAt} />
                </div>
                {selectedTicket.lastResponseAt && (
                  <div className="flex items-center gap-1">
                    <MessageCircle className="h-4 w-4" />
                    Last response <TimestampTooltip date={selectedTicket.lastResponseAt} />
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Original Message */}
              <div className="space-y-4">
                <div className="bg-muted/50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="h-4 w-4" />
                    <span className="font-medium">{selectedTicket.userName}</span>
                    <TimestampTooltip date={selectedTicket.createdAt} className="text-sm text-muted-foreground" />
                  </div>
                  <p className="whitespace-pre-wrap">{selectedTicket.description}</p>
                </div>

                {/* Responses */}
                {selectedTicket.responses.length > 0 && (
                  <div className="space-y-4">
                    <Separator />
                    <h3 className="font-medium">Conversation</h3>
                    {selectedTicket.responses.map((response, index) => (
                      <div 
                        key={response.id || index}
                        className={`p-4 rounded-lg ${
                          response.isFromSupport 
                            ? 'bg-blue-950/20 border border-blue-500/20 dark:bg-blue-950/30 dark:border-blue-500/30' 
                            : 'bg-muted/50'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`p-1 rounded-full ${
                            response.isFromSupport 
                              ? 'bg-blue-500 text-white' 
                              : 'bg-muted'
                          }`}>
                            {response.isFromSupport ? (
                              <HelpCircle className="h-3 w-3" />
                            ) : (
                              <User className="h-3 w-3" />
                            )}
                          </div>
                          <span className="font-medium">
                            {response.isFromSupport ? 'Waboku.gg Support' : response.authorName}
                          </span>
                          <TimestampTooltip date={response.createdAt} className="text-sm text-muted-foreground" />
                        </div>
                        <p className="whitespace-pre-wrap">{response.message}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add Response Form */}
                {selectedTicket.status !== 'closed' && (
                  <div className="space-y-4">
                    <Separator />
                    <form onSubmit={handleSubmitResponse} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="response">Add Response</Label>
                        <Textarea
                          id="response"
                          value={responseMessage}
                          onChange={(e) => setResponseMessage(e.target.value)}
                          placeholder="Type your response here..."
                          className="min-h-[100px]"
                          maxLength={2000}
                        />
                        <p className="text-xs text-muted-foreground">
                          {responseMessage.length}/2000 characters
                        </p>
                      </div>
                      <Button 
                        type="submit" 
                        disabled={isSubmittingResponse || !responseMessage.trim()}
                      >
                        {isSubmittingResponse ? (
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Sending...
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Send className="h-4 w-4" />
                            Send Response
                          </div>
                        )}
                      </Button>
                    </form>
                  </div>
                )}

                {selectedTicket.status === 'closed' && (
                  <Alert>
                    <XCircle className="h-4 w-4" />
                    <AlertDescription>
                      This ticket has been closed. If you need further assistance, please create a new support ticket.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Toaster />
      <div className="container mx-auto p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight">Support Tickets</h1>
            <p className="text-muted-foreground">
              View and manage your support tickets
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <Button onClick={fetchTickets} variant="outline" className="flex items-center justify-center gap-2 w-full sm:w-auto">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button onClick={() => router.push('/support')} className="flex items-center justify-center gap-2 w-full sm:w-auto">
              <Plus className="h-4 w-4" />
              New Ticket
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Filter and Sort Controls */}
        {tickets.length > 0 && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Filter & Sort</span>
                    {hasActiveFilters && (
                      <Badge variant="secondary" className="text-xs">
                        {displayedTickets.length} of {tickets.length}
                      </Badge>
                    )}
                  </div>
                  {hasActiveFilters && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearFilters}
                      className="text-xs"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Clear Filters
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Status Filter */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <div className="relative">
                      <select 
                        value={statusFilter} 
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="block w-full h-9 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring appearance-none cursor-pointer text-foreground"
                        style={{
                          WebkitAppearance: 'none',
                          MozAppearance: 'none',
                          backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6,9 12,15 18,9'%3e%3c/polyline%3e%3c/svg%3e")`,
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'right 12px center',
                          backgroundSize: '16px',
                          paddingRight: '40px',
                          minWidth: 0,
                          touchAction: 'manipulation'
                        }}
                      >
                        <option value="all">All Statuses</option>
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </select>
                    </div>
                  </div>

                  {/* Priority Filter */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Priority</Label>
                    <div className="relative">
                      <select 
                        value={priorityFilter} 
                        onChange={(e) => setPriorityFilter(e.target.value)}
                        className="block w-full h-9 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring appearance-none cursor-pointer text-foreground"
                        style={{
                          WebkitAppearance: 'none',
                          MozAppearance: 'none',
                          backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6,9 12,15 18,9'%3e%3c/polyline%3e%3c/svg%3e")`,
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'right 12px center',
                          backgroundSize: '16px',
                          paddingRight: '40px',
                          minWidth: 0,
                          touchAction: 'manipulation'
                        }}
                      >
                        <option value="all">All Priorities</option>
                        <option value="critical">Critical</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                    </div>
                  </div>

                  {/* Sort By */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Sort By</Label>
                    <div className="relative">
                      <select 
                        value={sortBy} 
                        onChange={(e) => setSortBy(e.target.value)}
                        className="block w-full h-9 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring appearance-none cursor-pointer text-foreground"
                        style={{
                          WebkitAppearance: 'none',
                          MozAppearance: 'none',
                          backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6,9 12,15 18,9'%3e%3c/polyline%3e%3c/svg%3e")`,
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'right 12px center',
                          backgroundSize: '16px',
                          paddingRight: '40px',
                          minWidth: 0,
                          touchAction: 'manipulation'
                        }}
                      >
                        <option value="date_asc">Date (Oldest First)</option>
                        <option value="date_desc">Date (Newest First)</option>
                        <option value="priority">Priority</option>
                        <option value="status">Status</option>
                        <option value="updated">Last Updated</option>
                      </select>
                    </div>
                  </div>

                  {/* Sort Order (only show for non-date sorts) */}
                  {!sortBy.includes('date') && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Order</Label>
                      <div className="relative">
                        <select 
                          value={sortOrder} 
                          onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                          className="block w-full h-9 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring appearance-none cursor-pointer text-foreground"
                          style={{
                            WebkitAppearance: 'none',
                            MozAppearance: 'none',
                            backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6,9 12,15 18,9'%3e%3c/polyline%3e%3c/svg%3e")`,
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'right 12px center',
                            backgroundSize: '16px',
                            paddingRight: '40px',
                            minWidth: 0,
                            touchAction: 'manipulation'
                          }}
                        >
                          <option value="asc">Ascending</option>
                          <option value="desc">Descending</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* Results Summary */}
                <div className="flex items-center justify-between pt-2 border-t">
                  <p className="text-sm text-muted-foreground">
                    Showing {displayedTickets.length} of {tickets.length} tickets
                    {hasActiveFilters && ' (filtered)'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Default: Oldest tickets first
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {tickets.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <HelpCircle className="h-16 w-16 text-muted-foreground mx-auto" />
                <h3 className="text-lg font-medium">No Support Tickets</h3>
                <p className="text-muted-foreground">
                  You haven't created any support tickets yet.
                </p>
                <Button onClick={() => router.push('/support')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Ticket
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : displayedTickets.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <Filter className="h-16 w-16 text-muted-foreground mx-auto" />
                <h3 className="text-lg font-medium">No Tickets Match Your Filters</h3>
                <p className="text-muted-foreground">
                  Try adjusting your filters to see more tickets.
                </p>
                <Button onClick={clearFilters} variant="outline">
                  <X className="h-4 w-4 mr-2" />
                  Clear All Filters
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {displayedTickets.map((ticket) => (
              <Card 
                key={ticket.ticketId} 
                className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                  ticket.hasUnreadResponses ? 'ring-2 ring-blue-500' : ''
                }`}
                onClick={() => handleTicketClick(ticket)}
              >
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-medium text-sm sm:text-base flex-1 min-w-0">
                        <span className="text-muted-foreground">#</span>{ticket.ticketId} - {ticket.subject}
                      </h3>
                      {ticket.hasUnreadResponses && (
                        <Badge variant="destructive" className="text-xs shrink-0 ml-2">
                          <span className="hidden sm:inline">New Response</span>
                          <span className="sm:hidden">New</span>
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={getStatusColor(ticket.status)}>
                        {getStatusIcon(ticket.status)}
                        <span className="ml-1 capitalize">{ticket.status.replace('_', ' ')}</span>
                      </Badge>
                      <Badge className={getPriorityColor(ticket.priority)}>
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        {ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)}
                      </Badge>
                      <Badge variant="outline">
                        {ticket.category.charAt(0).toUpperCase() + ticket.category.slice(1)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {ticket.description}
                    </p>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs text-muted-foreground">
                      <span>Created <TimestampTooltip date={ticket.createdAt} className="text-xs text-muted-foreground" /></span>
                      {ticket.responses.length > 0 && (
                        <span>{ticket.responses.length} response{ticket.responses.length !== 1 ? 's' : ''}</span>
                      )}
                      {ticket.lastResponseAt && (
                        <span>Last activity <TimestampTooltip date={ticket.lastResponseAt} className="text-xs text-muted-foreground" /></span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default dynamic(() => Promise.resolve(SupportTicketsPageContent), {
  ssr: false
});