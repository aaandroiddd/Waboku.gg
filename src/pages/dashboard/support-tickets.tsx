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
  AlertTriangle
} from "lucide-react";
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/components/ui/use-toast';
import { formatDistanceToNow } from 'date-fns';

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
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingResponse, setIsSubmittingResponse] = useState(false);
  const [error, setError] = useState("");
  const [responseMessage, setResponseMessage] = useState("");

  // Redirect if not authenticated
  useEffect(() => {
    if (!user) {
      router.push('/auth/sign-in?redirect=/dashboard/support-tickets');
      return;
    }
    fetchTickets();
  }, [user, router]);

  const fetchTickets = async () => {
    try {
      setIsLoading(true);
      const token = await user?.getIdToken();
      if (!token) throw new Error("Authentication required");

      const response = await fetch('/api/support/get-tickets', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch tickets');
      }

      const data = await response.json();
      setTickets(data.tickets || []);
    } catch (err: any) {
      console.error('Error fetching tickets:', err);
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
                  Created {formatDistanceToNow(selectedTicket.createdAt)} ago
                </div>
                {selectedTicket.lastResponseAt && (
                  <div className="flex items-center gap-1">
                    <MessageCircle className="h-4 w-4" />
                    Last response {formatDistanceToNow(selectedTicket.lastResponseAt)} ago
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
                    <span className="text-sm text-muted-foreground">
                      {formatDistanceToNow(selectedTicket.createdAt)} ago
                    </span>
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
                            ? 'bg-blue-50 dark:bg-blue-950/20 border-l-4 border-blue-500' 
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
                          <span className="text-sm text-muted-foreground">
                            {formatDistanceToNow(response.createdAt)} ago
                          </span>
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
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Support Tickets</h1>
            <p className="text-muted-foreground">
              View and manage your support tickets
            </p>
          </div>
          <Button onClick={() => router.push('/support')}>
            <Plus className="h-4 w-4 mr-2" />
            New Ticket
          </Button>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
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
        ) : (
          <div className="space-y-4">
            {tickets.map((ticket) => (
              <Card 
                key={ticket.ticketId} 
                className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                  ticket.hasUnreadResponses ? 'ring-2 ring-blue-500' : ''
                }`}
                onClick={() => handleTicketClick(ticket)}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">
                          #{ticket.ticketId} - {ticket.subject}
                        </h3>
                        {ticket.hasUnreadResponses && (
                          <Badge variant="destructive" className="text-xs">
                            New Response
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
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Created {formatDistanceToNow(ticket.createdAt)} ago</span>
                        {ticket.responses.length > 0 && (
                          <span>{ticket.responses.length} response{ticket.responses.length !== 1 ? 's' : ''}</span>
                        )}
                        {ticket.lastResponseAt && (
                          <span>Last activity {formatDistanceToNow(ticket.lastResponseAt)} ago</span>
                        )}
                      </div>
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