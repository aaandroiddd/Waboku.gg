import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { 
  HelpCircle, 
  MessageCircle, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Send,
  ArrowLeft,
  Calendar,
  User,
  AlertTriangle,
  Search,
  Filter,
  RefreshCw
} from "lucide-react";
import { useToast } from '@/components/ui/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface TicketResponse {
  id: string;
  message: string;
  isFromSupport: boolean;
  authorName: string;
  authorEmail: string;
  createdAt: Date;
  readByUser?: boolean;
  readBySupport?: boolean;
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

const AdminSupportManagement = () => {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingResponse, setIsSubmittingResponse] = useState(false);
  const [error, setError] = useState("");
  const [responseMessage, setResponseMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  useEffect(() => {
    if (!user) {
      router.push('/admin/login');
      return;
    }
    fetchTickets();
  }, [user, router]);

  const fetchTickets = async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/support/get-all-tickets', {
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
    
    // Mark ticket responses as read by support
    if (!user) return;
    
    try {
      const token = await user.getIdToken();
      await fetch('/api/admin/support/mark-read', {
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
          ? { 
              ...t, 
              responses: t.responses.map(r => ({ ...r, readBySupport: true }))
            }
          : t
      ));
    } catch (err) {
      console.error('Error marking ticket as read:', err);
    }
  };

  const handleSubmitResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !responseMessage.trim() || !user) return;

    setIsSubmittingResponse(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/support/add-response', {
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
        status: 'in_progress' as const
      };
      
      setSelectedTicket(updatedTicket);
      
      // Update tickets list
      setTickets(prev => prev.map(t => 
        t.ticketId === selectedTicket.ticketId ? updatedTicket : t
      ));
      
      setResponseMessage("");
      toast({
        title: "Response sent",
        description: "Your response has been sent to the user.",
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

  const handleStatusChange = async (newStatus: string) => {
    if (!selectedTicket || !user) return;

    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/support/update-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          ticketId: selectedTicket.ticketId,
          status: newStatus,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update status');
      }

      // Update the selected ticket status
      const updatedTicket = {
        ...selectedTicket,
        status: newStatus as any,
        updatedAt: new Date()
      };
      
      setSelectedTicket(updatedTicket);
      
      // Update tickets list
      setTickets(prev => prev.map(t => 
        t.ticketId === selectedTicket.ticketId ? updatedTicket : t
      ));
      
      toast({
        title: "Status updated",
        description: `Ticket status changed to ${newStatus.replace('_', ' ')}`,
      });
    } catch (err: any) {
      console.error('Error updating status:', err);
      toast({
        title: "Error",
        description: err.message || 'Failed to update status',
        variant: "destructive",
      });
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

  // Filter tickets based on search and filters
  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = 
      ticket.ticketId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.userEmail.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || ticket.priority === priorityFilter;
    const matchesCategory = categoryFilter === 'all' || ticket.category === categoryFilter;
    
    return matchesSearch && matchesStatus && matchesPriority && matchesCategory;
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (selectedTicket) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
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
              <div className="space-y-2">
                <Label htmlFor="status">Change Status</Label>
                <Select value={selectedTicket.status} onValueChange={handleStatusChange}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
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
            <div className="bg-muted/50 p-4 rounded-lg">
              <h4 className="font-medium mb-2">User Information</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Name:</span> {selectedTicket.userName}
                </div>
                <div>
                  <span className="font-medium">Email:</span> {selectedTicket.userEmail}
                </div>
                <div>
                  <span className="font-medium">User ID:</span> {selectedTicket.userId}
                </div>
              </div>
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
                        {response.isFromSupport && !response.readByUser && (
                          <Badge variant="outline" className="text-xs">Unread by user</Badge>
                        )}
                        {!response.isFromSupport && !response.readBySupport && (
                          <Badge variant="destructive" className="text-xs">New</Badge>
                        )}
                      </div>
                      <p className="whitespace-pre-wrap">{response.message}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Response Form */}
              <div className="space-y-4">
                <Separator />
                <form onSubmit={handleSubmitResponse} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="response">Add Support Response</Label>
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
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Support Ticket Management</h1>
          <p className="text-muted-foreground">
            Manage and respond to user support tickets
          </p>
        </div>
        <Button onClick={fetchTickets} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search tickets..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status-filter">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority-filter">Priority</Label>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="category-filter">Category</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="account">Account</SelectItem>
                  <SelectItem value="billing">Billing</SelectItem>
                  <SelectItem value="orders">Orders</SelectItem>
                  <SelectItem value="listings">Listings</SelectItem>
                  <SelectItem value="technical">Technical</SelectItem>
                  <SelectItem value="refunds">Refunds</SelectItem>
                  <SelectItem value="safety">Safety</SelectItem>
                  <SelectItem value="feature">Feature</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button 
                variant="outline" 
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("all");
                  setPriorityFilter("all");
                  setCategoryFilter("all");
                }}
                className="w-full"
              >
                <Filter className="h-4 w-4 mr-2" />
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {filteredTickets.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <HelpCircle className="h-16 w-16 text-muted-foreground mx-auto" />
              <h3 className="text-lg font-medium">No Support Tickets Found</h3>
              <p className="text-muted-foreground">
                {tickets.length === 0 
                  ? "No support tickets have been created yet."
                  : "No tickets match your current filters."
                }
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredTickets.map((ticket) => {
            const hasUnreadFromUser = ticket.responses.some(r => !r.isFromSupport && !r.readBySupport);
            
            return (
              <Card 
                key={ticket.ticketId} 
                className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                  hasUnreadFromUser ? 'ring-2 ring-blue-500' : ''
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
                        {hasUnreadFromUser && (
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
                        <span>From: {ticket.userName} ({ticket.userEmail})</span>
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
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminSupportManagement;