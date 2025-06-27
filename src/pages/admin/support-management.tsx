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
  RefreshCw,
  Shield,
  Lock,
  UserCheck,
  UserX,
  SortAsc,
  SortDesc,
  Timer
} from "lucide-react";
import { useToast } from '@/components/ui/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { Footer } from '@/components/Footer';
import { TimestampTooltip } from '@/components/ui/timestamp-tooltip';

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
  assignedTo?: string;
  assignedToName?: string;
  assignedAt?: Date;
  timePriority?: 'good' | 'warning' | 'bad' | null;
  hoursSinceCreated?: number;
  hasUnreadFromUser?: boolean;
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
  const [assignmentFilter, setAssignmentFilter] = useState("all");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [authError, setAuthError] = useState("");
  const [currentUserName, setCurrentUserName] = useState("");

  // Check if user is authorized (admin or moderator)
  const checkAuthorization = async () => {
    if (!user) {
      setIsAuthorized(false);
      setAuthError("Please sign in to access this page.");
      return;
    }

    try {
      // Set current user name for assignment
      setCurrentUserName(user.displayName || user.email?.split('@')[0] || 'Unknown User');

      // Check if user has admin secret in localStorage (for admin access)
      const adminSecret = localStorage.getItem('adminSecret');
      if (adminSecret === process.env.NEXT_PUBLIC_ADMIN_SECRET) {
        setIsAuthorized(true);
        setAuthError("");
        return;
      }

      // Check if user is a moderator via API call
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.isAdmin || data.isModerator) {
          setIsAuthorized(true);
          setAuthError("");
        } else {
          setIsAuthorized(false);
          setAuthError("Access denied. Admin or moderator privileges required.");
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        setIsAuthorized(false);
        setAuthError(errorData.error || "Access denied. Admin or moderator privileges required.");
      }
    } catch (err) {
      console.error('Error checking authorization:', err);
      setIsAuthorized(false);
      setAuthError("Failed to verify permissions. Please try again.");
    }
  };

  useEffect(() => {
    if (!user) {
      router.push(`/admin/login?returnUrl=${encodeURIComponent(router.asPath)}`);
      return;
    }
    
    checkAuthorization();
  }, [user, router]);

  useEffect(() => {
    if (isAuthorized === true) {
      fetchTickets();
    }
  }, [isAuthorized]);

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
      setError(""); // Clear any previous errors
    } catch (err: any) {
      console.error('Error fetching tickets:', err);
      setError(err.message || 'Failed to load support tickets');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTicketClick = async (ticket: SupportTicket) => {
    // Navigate to individual ticket page
    router.push(`/admin/support-management/${ticket.ticketId}`);
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

    console.log('Attempting to change status from', selectedTicket.status, 'to', newStatus);

    // Show loading state immediately
    toast({
      title: "Updating status...",
      description: "Please wait while we update the ticket status.",
    });

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

      const responseData = await response.json();
      console.log('Status update response:', responseData);

      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to update status');
      }

      // Update the selected ticket status immediately
      const updatedTicket = {
        ...selectedTicket,
        status: newStatus as any,
        updatedAt: new Date(),
        lastModifiedBy: user.uid,
        lastModifiedAt: new Date()
      };
      
      setSelectedTicket(updatedTicket);
      
      // Update tickets list immediately
      setTickets(prev => prev.map(t => 
        t.ticketId === selectedTicket.ticketId ? updatedTicket : t
      ));
      
      // Force multiple refreshes to ensure sync
      setTimeout(() => fetchTickets(), 500);
      setTimeout(() => fetchTickets(), 2000);
      setTimeout(() => fetchTickets(), 5000);
      
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
      
      // Refresh tickets on error to ensure we have the latest state
      fetchTickets();
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

  const getTimePriorityColor = (timePriority: string | null) => {
    switch (timePriority) {
      case 'good':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'bad':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default:
        return '';
    }
  };

  const handleAssignTicket = async (ticketId: string, assign: boolean) => {
    if (!user) return;

    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/admin/support/assign-ticket', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          ticketId,
          assignedTo: assign ? user.uid : null,
          assignedToName: assign ? currentUserName : null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to assign ticket');
      }

      const data = await response.json();
      console.log('Assignment response:', data);

      // Use the returned data from the API to ensure consistency
      const updatedTicketData = {
        assignedTo: data.updatedTicket?.assignedTo || (assign ? user.uid : undefined),
        assignedToName: data.updatedTicket?.assignedToName || (assign ? currentUserName : undefined),
        assignedAt: data.updatedTicket?.assignedAt ? new Date(data.updatedTicket.assignedAt) : (assign ? new Date() : undefined),
        updatedAt: data.updatedTicket?.updatedAt ? new Date(data.updatedTicket.updatedAt) : new Date()
      };

      // Update local state with the confirmed data
      setTickets(prev => prev.map(t => 
        t.ticketId === ticketId 
          ? { ...t, ...updatedTicketData }
          : t
      ));

      // Update selected ticket if it's the one being assigned
      if (selectedTicket?.ticketId === ticketId) {
        setSelectedTicket(prev => prev ? {
          ...prev,
          ...updatedTicketData
        } : null);
      }

      toast({
        title: assign ? "Ticket assigned" : "Ticket unassigned",
        description: assign 
          ? `Ticket assigned to ${currentUserName}` 
          : "Ticket has been unassigned",
      });

      // Refresh tickets after a short delay to ensure database consistency
      setTimeout(() => {
        fetchTickets();
      }, 1000);

    } catch (err: any) {
      console.error('Error assigning ticket:', err);
      toast({
        title: "Error",
        description: err.message || 'Failed to assign ticket',
        variant: "destructive",
      });
      
      // Refresh tickets on error to get the current state
      fetchTickets();
    }
  };

  const handleSortChange = (newSortBy: string) => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('desc');
    }
  };

  // Filter and sort tickets
  const filteredAndSortedTickets = tickets
    .filter(ticket => {
      const matchesSearch = 
        ticket.ticketId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ticket.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ticket.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ticket.userEmail.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
      const matchesPriority = priorityFilter === 'all' || ticket.priority === priorityFilter;
      const matchesCategory = categoryFilter === 'all' || ticket.category === categoryFilter;
      
      const matchesAssignment = 
        assignmentFilter === 'all' ||
        (assignmentFilter === 'assigned_to_me' && ticket.assignedTo === user?.uid) ||
        (assignmentFilter === 'unassigned' && !ticket.assignedTo) ||
        (assignmentFilter === 'assigned' && ticket.assignedTo);
      
      return matchesSearch && matchesStatus && matchesPriority && matchesCategory && matchesAssignment;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'createdAt':
          const dateA = new Date(a.createdAt).getTime();
          const dateB = new Date(b.createdAt).getTime();
          return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
        
        case 'updatedAt':
          const updatedA = new Date(a.updatedAt).getTime();
          const updatedB = new Date(b.updatedAt).getTime();
          return sortOrder === 'asc' ? updatedA - updatedB : updatedB - updatedA;
        
        case 'priority':
          const priorityA = a.priorityLevel || 0;
          const priorityB = b.priorityLevel || 0;
          if (priorityA !== priorityB) {
            return sortOrder === 'asc' ? priorityA - priorityB : priorityB - priorityA;
          }
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        
        case 'status':
          const statusOrder = { 'open': 1, 'in_progress': 2, 'resolved': 3, 'closed': 4 };
          const statusA = statusOrder[a.status] || 5;
          const statusB = statusOrder[b.status] || 5;
          if (statusA !== statusB) {
            return sortOrder === 'asc' ? statusA - statusB : statusB - statusA;
          }
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        
        case 'timeAge':
          const ageA = a.hoursSinceCreated || 0;
          const ageB = b.hoursSinceCreated || 0;
          return sortOrder === 'asc' ? ageA - ageB : ageB - ageA;
        
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

  // Show loading while checking authorization
  if (isAuthorized === null || isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="container mx-auto p-6 flex-1">
          <div className="space-y-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // Show access denied if not authorized
  if (isAuthorized === false) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="container mx-auto p-6 flex-1">
          <Card className="max-w-md mx-auto mt-20">
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <div className="flex justify-center">
                  <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-full">
                    <Lock className="h-8 w-8 text-red-600 dark:text-red-400" />
                  </div>
                </div>
                <h2 className="text-xl font-semibold">Access Denied</h2>
                <p className="text-muted-foreground">
                  {authError || "You don't have permission to access this page."}
                </p>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    This page requires admin or moderator privileges.
                  </p>
                  <div className="flex flex-col gap-2 justify-center">
                    <Button 
                      variant="outline" 
                      onClick={() => router.push('/admin/login')}
                      className="w-full"
                    >
                      <Shield className="h-4 w-4 mr-2" />
                      Admin Login
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => router.push('/dashboard')}
                      className="w-full"
                    >
                      Back to Dashboard
                    </Button>
                    <Button 
                      variant="secondary" 
                      onClick={() => {
                        const secret = prompt('Enter admin secret:');
                        if (secret) {
                          localStorage.setItem('adminSecret', secret);
                          window.location.reload();
                        }
                      }}
                      className="w-full"
                    >
                      Enter Admin Secret
                    </Button>
                    <Button 
                      variant="ghost" 
                      onClick={async () => {
                        try {
                          const { signOut } = await import('firebase/auth');
                          const { auth } = await import('@/lib/firebase');
                          await signOut(auth);
                          router.push('/auth/sign-in');
                        } catch (error) {
                          console.error('Error signing out:', error);
                          router.push('/auth/sign-in');
                        }
                      }}
                      className="w-full"
                    >
                      Log Out
                    </Button>
                  </div>
                  <div className="pt-4 border-t">
                    <p className="text-xs text-muted-foreground mb-2">
                      Need help? Contact an administrator
                    </p>
                    <Button 
                      variant="link" 
                      onClick={() => router.push('/support')}
                      className="w-full text-xs"
                    >
                      Contact Support
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  if (selectedTicket) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="container mx-auto p-6 max-w-6xl flex-1">
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
                Created <TimestampTooltip date={selectedTicket.createdAt} />
              </div>
              {selectedTicket.lastResponseAt && (
                <div className="flex items-center gap-1">
                  <MessageCircle className="h-4 w-4" />
                  Last response <TimestampTooltip date={selectedTicket.lastResponseAt} />
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-muted/50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">User Information</h4>
                <div className="space-y-2 text-sm">
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
              
              <div className="bg-muted/50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Assignment & Priority</h4>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium">Assigned to:</span>{' '}
                    {selectedTicket.assignedTo ? (
                      <span className="text-blue-600 dark:text-blue-400">
                        {selectedTicket.assignedTo === user?.uid ? 'You' : selectedTicket.assignedToName}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Unassigned</span>
                    )}
                  </div>
                  {selectedTicket.assignedAt && (
                    <div>
                      <span className="font-medium">Assigned:</span>{' '}
                      <TimestampTooltip date={selectedTicket.assignedAt} className="text-xs text-muted-foreground" />
                    </div>
                  )}
                  {selectedTicket.timePriority && (
                    <div>
                      <span className="font-medium">Time Priority:</span>{' '}
                      <Badge className={getTimePriorityColor(selectedTicket.timePriority)} size="sm">
                        <Timer className="h-3 w-3 mr-1" />
                        {selectedTicket.timePriority === 'good' ? 'Recent' :
                         selectedTicket.timePriority === 'warning' ? 'Aging' : 'Urgent'}
                      </Badge>
                    </div>
                  )}
                  <div className="flex items-center gap-2 pt-2">
                    {selectedTicket.assignedTo === user?.uid ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAssignTicket(selectedTicket.ticketId, false)}
                      >
                        <UserX className="h-3 w-3 mr-1" />
                        Unassign from me
                      </Button>
                    ) : !selectedTicket.assignedTo ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAssignTicket(selectedTicket.ticketId, true)}
                      >
                        <UserCheck className="h-3 w-3 mr-1" />
                        Assign to me
                      </Button>
                    ) : null}
                  </div>
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
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="container mx-auto p-6 flex-1">
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

      {/* Filters and Sorting */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="space-y-4">
            {/* First row - Filters */}
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
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
              <div className="space-y-2">
                <Label htmlFor="assignment-filter">Assignment</Label>
                <Select value={assignmentFilter} onValueChange={setAssignmentFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tickets</SelectItem>
                    <SelectItem value="assigned_to_me">Assigned to Me</SelectItem>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    <SelectItem value="assigned">Assigned</SelectItem>
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
                    setAssignmentFilter("all");
                  }}
                  className="w-full"
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Clear Filters
                </Button>
              </div>
            </div>

            {/* Second row - Sorting */}
            <Separator />
            <div className="flex items-center gap-4 flex-wrap">
              <Label className="text-sm font-medium">Sort by:</Label>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant={sortBy === 'createdAt' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleSortChange('createdAt')}
                  className="flex items-center gap-1"
                >
                  <Calendar className="h-3 w-3" />
                  Created Date
                  {sortBy === 'createdAt' && (
                    sortOrder === 'asc' ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />
                  )}
                </Button>
                <Button
                  variant={sortBy === 'updatedAt' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleSortChange('updatedAt')}
                  className="flex items-center gap-1"
                >
                  <Clock className="h-3 w-3" />
                  Last Updated
                  {sortBy === 'updatedAt' && (
                    sortOrder === 'asc' ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />
                  )}
                </Button>
                <Button
                  variant={sortBy === 'priority' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleSortChange('priority')}
                  className="flex items-center gap-1"
                >
                  <AlertTriangle className="h-3 w-3" />
                  Priority
                  {sortBy === 'priority' && (
                    sortOrder === 'asc' ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />
                  )}
                </Button>
                <Button
                  variant={sortBy === 'status' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleSortChange('status')}
                  className="flex items-center gap-1"
                >
                  <MessageCircle className="h-3 w-3" />
                  Status
                  {sortBy === 'status' && (
                    sortOrder === 'asc' ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />
                  )}
                </Button>
                <Button
                  variant={sortBy === 'timeAge' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleSortChange('timeAge')}
                  className="flex items-center gap-1"
                >
                  <Timer className="h-3 w-3" />
                  Time Age
                  {sortBy === 'timeAge' && (
                    sortOrder === 'asc' ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {filteredAndSortedTickets.length === 0 ? (
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
          {filteredAndSortedTickets.map((ticket) => {
            const hasUnreadFromUser = ticket.responses.some(r => !r.isFromSupport && !r.readBySupport);
            const isAssignedToMe = ticket.assignedTo === user?.uid;
            
            return (
              <Card 
                key={ticket.ticketId} 
                className={`transition-colors hover:bg-muted/50 ${
                  hasUnreadFromUser ? 'ring-2 ring-blue-500' : ''
                } ${
                  ticket.timePriority === 'bad' ? 'border-l-4 border-l-red-500' :
                  ticket.timePriority === 'warning' ? 'border-l-4 border-l-yellow-500' :
                  ticket.timePriority === 'good' ? 'border-l-4 border-l-green-500' : ''
                }`}
              >
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div 
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => handleTicketClick(ticket)}
                      >
                        <h3 className="font-medium text-sm sm:text-base">
                          <span className="text-muted-foreground">#</span>{ticket.ticketId} - {ticket.subject}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {hasUnreadFromUser && (
                          <Badge variant="destructive" className="text-xs">
                            <span className="hidden sm:inline">New Response</span>
                            <span className="sm:hidden">New</span>
                          </Badge>
                        )}
                        {ticket.timePriority && (
                          <Badge className={getTimePriorityColor(ticket.timePriority)}>
                            <Timer className="h-3 w-3 mr-1" />
                            <span className="hidden sm:inline">
                              {ticket.timePriority === 'good' ? 'Recent' :
                               ticket.timePriority === 'warning' ? 'Aging' : 'Urgent'}
                            </span>
                            <span className="sm:hidden">
                              {ticket.timePriority === 'good' ? 'R' :
                               ticket.timePriority === 'warning' ? 'A' : 'U'}
                            </span>
                          </Badge>
                        )}
                      </div>
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
                      {ticket.assignedTo && (
                        <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                          <UserCheck className="h-3 w-3 mr-1" />
                          {isAssignedToMe ? 'Assigned to me' : `Assigned to ${ticket.assignedToName}`}
                        </Badge>
                      )}
                    </div>

                    <div 
                      className="cursor-pointer"
                      onClick={() => handleTicketClick(ticket)}
                    >
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {ticket.description}
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs text-muted-foreground">
                        <span className="truncate">From: {ticket.userName} ({ticket.userEmail})</span>
                        <span>Created <TimestampTooltip date={ticket.createdAt} className="text-xs text-muted-foreground" /></span>
                        {ticket.responses.length > 0 && (
                          <span>{ticket.responses.length} response{ticket.responses.length !== 1 ? 's' : ''}</span>
                        )}
                        {ticket.lastResponseAt && (
                          <span>Last activity <TimestampTooltip date={ticket.lastResponseAt} className="text-xs text-muted-foreground" /></span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {ticket.assignedTo === user?.uid ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAssignTicket(ticket.ticketId, false);
                            }}
                            className="text-xs"
                          >
                            <UserX className="h-3 w-3 mr-1" />
                            Unassign
                          </Button>
                        ) : !ticket.assignedTo ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAssignTicket(ticket.ticketId, true);
                            }}
                            className="text-xs"
                          >
                            <UserCheck className="h-3 w-3 mr-1" />
                            Assign to me
                          </Button>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            <UserCheck className="h-3 w-3 mr-1" />
                            Assigned
                          </Badge>
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
      <Footer />
    </div>
  );
};

export default AdminSupportManagement;