import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { MobileSelect } from '@/components/ui/mobile-select';
import { toast } from 'sonner';
import { ArrowLeft, Clock, User, Mail, MessageSquare, AlertCircle, CheckCircle, XCircle, Lock, RefreshCw } from 'lucide-react';
import { Footer } from '@/components/Footer';

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

export default function IndividualSupportTicket() {
  const router = useRouter();
  const { ticketId } = router.query;
  const { user } = useAuth();
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [responseMessage, setResponseMessage] = useState('');
  const [newStatus, setNewStatus] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Helper function to convert various timestamp formats to Date
  const convertTimestamp = (timestamp: any): Date => {
    if (!timestamp) return new Date();
    
    // If it's already a Date object
    if (timestamp instanceof Date) {
      return timestamp;
    }
    
    // If it's a Firestore Timestamp object
    if (timestamp && typeof timestamp === 'object' && timestamp.toDate) {
      return timestamp.toDate();
    }
    
    // If it's a Firestore Timestamp-like object with seconds and nanoseconds
    if (timestamp && typeof timestamp === 'object' && timestamp._seconds !== undefined) {
      return new Date(timestamp._seconds * 1000 + (timestamp._nanoseconds || 0) / 1000000);
    }
    
    // If it's an object with seconds property
    if (timestamp && typeof timestamp === 'object' && timestamp.seconds !== undefined) {
      return new Date(timestamp.seconds * 1000 + (timestamp.nanoseconds || 0) / 1000000);
    }
    
    // If it's a string or number, try to parse it
    if (typeof timestamp === 'string' || typeof timestamp === 'number') {
      const date = new Date(timestamp);
      return isNaN(date.getTime()) ? new Date() : date;
    }
    
    return new Date();
  };

  // Authorization check
  useEffect(() => {
    const checkAuthorization = async () => {
      try {
        const adminSecret = localStorage.getItem('adminSecret');
        const token = adminSecret || (await user?.getIdToken());
        
        if (!token) {
          setIsAuthorized(false);
          return;
        }

        const response = await fetch('/api/admin/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setIsAuthorized(data.success);
        } else {
          const errorData = await response.json();
          console.error('Authorization failed:', errorData);
          setIsAuthorized(false);
        }
      } catch (error) {
        console.error('Authorization check failed:', error);
        setIsAuthorized(false);
      }
    };

    if (user !== undefined) {
      checkAuthorization();
    }
  }, [user]);

  // Fetch ticket data
  useEffect(() => {
    if (isAuthorized && ticketId) {
      fetchTicket();
    }
  }, [isAuthorized, ticketId]);

  const fetchTicket = async () => {
    if (!ticketId) return;
    
    setRefreshing(true);
    try {
      const adminSecret = localStorage.getItem('adminSecret');
      const token = adminSecret || (await user?.getIdToken());
      
      const response = await fetch(`/api/admin/support/get-ticket?ticketId=${ticketId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const ticketData = data.ticket;
        
        // Convert Firestore timestamps to Date objects using the helper function
        const processedTicket = {
          ...ticketData,
          createdAt: convertTimestamp(ticketData.createdAt),
          updatedAt: convertTimestamp(ticketData.updatedAt),
          lastResponseAt: ticketData.lastResponseAt ? convertTimestamp(ticketData.lastResponseAt) : undefined,
          assignedAt: ticketData.assignedAt ? convertTimestamp(ticketData.assignedAt) : undefined,
          responses: (ticketData.responses || []).map((response: any) => ({
            ...response,
            createdAt: convertTimestamp(response.createdAt)
          }))
        };
        
        setTicket(processedTicket);
        setNewStatus(processedTicket.status);
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to fetch ticket');
        // If ticket not found, redirect back to main page
        if (response.status === 404) {
          router.push('/admin/support-management');
        }
      }
    } catch (error) {
      console.error('Error fetching ticket:', error);
      toast.error('Failed to fetch ticket');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSendResponse = async () => {
    if (!responseMessage.trim() || !ticket) return;

    setSubmitting(true);
    try {
      const adminSecret = localStorage.getItem('adminSecret');
      const token = adminSecret || (await user?.getIdToken());

      const response = await fetch('/api/admin/support/add-response', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          ticketId: ticket.ticketId,
          message: responseMessage,
        }),
      });

      if (response.ok) {
        toast.success('Response sent successfully');
        setResponseMessage('');
        
        // Immediately add the new response to local state
        const newResponse = {
          id: `temp-${Date.now()}`, // Temporary ID until we refresh
          message: responseMessage,
          isFromSupport: true,
          authorName: user?.displayName || user?.email || 'Support',
          authorEmail: user?.email || '',
          createdAt: new Date(),
          supportStaffName: user?.displayName || user?.email || 'Support'
        };
        
        setTicket(prevTicket => {
          if (!prevTicket) return prevTicket;
          return {
            ...prevTicket,
            responses: [...(prevTicket.responses || []), newResponse],
            lastResponseAt: new Date(),
            updatedAt: new Date()
          };
        });
        
        // Refresh from server after a short delay to get the actual response ID
        setTimeout(() => {
          fetchTicket();
        }, 1000);
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to send response');
      }
    } catch (error) {
      console.error('Error sending response:', error);
      toast.error('Failed to send response');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!ticket || newStatus === ticket.status) return;

    setSubmitting(true);
    try {
      const adminSecret = localStorage.getItem('adminSecret');
      const token = adminSecret || (await user?.getIdToken());

      const response = await fetch('/api/admin/support/update-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          ticketId: ticket.ticketId,
          status: newStatus,
        }),
      });

      if (response.ok) {
        const responseData = await response.json();
        toast.success('Status updated successfully');
        
        // Immediately update local state with the new status
        setTicket(prevTicket => {
          if (!prevTicket) return prevTicket;
          return {
            ...prevTicket,
            status: newStatus as 'open' | 'in_progress' | 'resolved' | 'closed',
            updatedAt: new Date()
          };
        });
        
        // Also refresh from server after a short delay to ensure consistency
        setTimeout(() => {
          fetchTicket();
        }, 1000);
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to update status');
        // Reset the status selector to the current ticket status on error
        setNewStatus(ticket.status);
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
      // Reset the status selector to the current ticket status on error
      setNewStatus(ticket.status);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignTicket = async () => {
    if (!ticket || !user) return;

    setSubmitting(true);
    try {
      const adminSecret = localStorage.getItem('adminSecret');
      const token = adminSecret || (await user?.getIdToken());

      const isCurrentlyAssigned = ticket.assignedTo === user.uid;
      const newAssignedTo = isCurrentlyAssigned ? null : user.uid;
      const newAssignedToName = isCurrentlyAssigned ? null : user.displayName || user.email;

      console.log('Assignment request:', {
        ticketId: ticket.ticketId,
        currentAssignment: {
          assignedTo: ticket.assignedTo,
          assignedToName: ticket.assignedToName,
          assignedAt: ticket.assignedAt
        },
        newAssignment: {
          assignedTo: newAssignedTo,
          assignedToName: newAssignedToName
        },
        isCurrentlyAssigned,
        userUid: user.uid
      });

      const response = await fetch('/api/admin/support/assign-ticket', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          ticketId: ticket.ticketId,
          assignedTo: newAssignedTo,
          assignedToName: newAssignedToName,
        }),
      });

      if (response.ok) {
        const responseData = await response.json();
        console.log('Assignment response:', responseData);
        
        const action = isCurrentlyAssigned ? 'unassigned' : 'assigned';
        toast.success(`Ticket ${action} successfully`);
        
        // Use the actual response data from the server
        const updatedTicket = responseData.updatedTicket;
        
        // Immediately update local state with the server response
        setTicket(prevTicket => {
          if (!prevTicket) return prevTicket;
          
          // Helper function to convert timestamp to Date
          const convertTimestamp = (timestamp: any) => {
            if (!timestamp) return null;
            if (timestamp instanceof Date) return timestamp;
            if (timestamp.seconds) return new Date(timestamp.seconds * 1000);
            if (typeof timestamp === 'string') return new Date(timestamp);
            return new Date(timestamp);
          };
          
          const newTicket = {
            ...prevTicket,
            assignedTo: updatedTicket.assignedTo || null,
            assignedToName: updatedTicket.assignedToName || null,
            assignedAt: convertTimestamp(updatedTicket.assignedAt),
            updatedAt: convertTimestamp(updatedTicket.updatedAt) || new Date()
          };
          
          console.log('Updated local ticket state:', {
            assignedTo: newTicket.assignedTo,
            assignedToName: newTicket.assignedToName,
            assignedAt: newTicket.assignedAt,
            rawAssignedAt: updatedTicket.assignedAt,
            rawUpdatedAt: updatedTicket.updatedAt
          });
          
          return newTicket;
        });
        
        // Also refresh from server after a short delay to ensure consistency
        setTimeout(() => {
          console.log('Refreshing ticket data from server...');
          fetchTicket();
        }, 1000);
      } else {
        const errorData = await response.json();
        console.error('Assignment failed:', errorData);
        toast.error(errorData.error || 'Failed to update assignment');
      }
    } catch (error) {
      console.error('Error updating assignment:', error);
      toast.error('Failed to update assignment');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-blue-500';
      case 'in_progress': return 'bg-yellow-500';
      case 'in-progress': return 'bg-yellow-500'; // Support both formats
      case 'closed': return 'bg-gray-500';
      case 'resolved': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'low': return 'bg-green-500';
      case 'medium': return 'bg-yellow-500';
      case 'high': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getTimePriorityColor = (timePriority?: string) => {
    switch (timePriority) {
      case 'good': return 'text-green-500';
      case 'warning': return 'text-yellow-500';
      case 'bad': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getTimePriorityLabel = (timePriority?: string) => {
    switch (timePriority) {
      case 'good': return 'Recent';
      case 'warning': return 'Aging';
      case 'bad': return 'Urgent';
      default: return '';
    }
  };

  // Access denied UI
  if (isAuthorized === false) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <Card className="max-w-md mx-auto">
            <CardHeader className="text-center">
              <Lock className="h-12 w-12 mx-auto text-red-500 mb-4" />
              <CardTitle className="text-red-500">Access Denied</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-muted-foreground">
                You don't have permission to access this page. Only administrators and moderators can view support tickets.
              </p>
              <div className="space-y-2">
                <Button 
                  onClick={() => router.push('/admin/login?returnUrl=' + encodeURIComponent(router.asPath))}
                  className="w-full"
                >
                  Admin Login
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => router.push('/dashboard')}
                  className="w-full"
                >
                  Back to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  // Loading state
  if (loading || isAuthorized === null) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading ticket...</span>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // Ticket not found
  if (!ticket) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <Card className="max-w-md mx-auto">
            <CardHeader className="text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-yellow-500 mb-4" />
              <CardTitle>Ticket Not Found</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-muted-foreground">
                The support ticket you're looking for could not be found.
              </p>
              <Button 
                onClick={() => router.push('/admin/support-management')}
                className="w-full"
              >
                Back to Support Management
              </Button>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/admin/support-management')}
              className="w-fit"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Support Management
            </Button>
            <h1 className="text-xl sm:text-2xl font-bold">Support Ticket #{ticket.ticketId}</h1>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchTicket}
            disabled={refreshing}
            className="w-fit sm:w-auto"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Ticket Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Main Ticket Info */}
            <Card>
              <CardHeader>
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
                      <span className="break-words">{ticket.subject}</span>
                      {ticket.timePriority && (
                        <Badge variant="outline" className={`${getTimePriorityColor(ticket.timePriority)} w-fit`}>
                          {getTimePriorityLabel(ticket.timePriority)}
                        </Badge>
                      )}
                    </CardTitle>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center space-x-1">
                        <User className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{ticket.userName}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Mail className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{ticket.userEmail}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Clock className="h-4 w-4 flex-shrink-0" />
                        <span className="text-xs sm:text-sm">
                          {ticket.createdAt instanceof Date ? ticket.createdAt.toLocaleString() : new Date(ticket.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-row lg:flex-col gap-2 lg:items-end">
                    <Badge className={`${getPriorityColor(ticket.priority)} w-fit`}>
                      {ticket.priority.toUpperCase()}
                    </Badge>
                    <Badge className={`${getStatusColor(ticket.status)} w-fit`}>
                      {ticket.status.toUpperCase().replace(/[-_]/g, ' ')}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <p className="whitespace-pre-wrap">{ticket.description}</p>
                </div>
              </CardContent>
            </Card>

            {/* Responses */}
            {ticket.responses && ticket.responses.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <MessageSquare className="h-5 w-5" />
                    <span>Responses ({ticket.responses.length})</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {ticket.responses.map((response) => (
                    <div
                      key={response.id}
                      className={`p-4 rounded-lg ${
                        response.isFromSupport
                          ? 'bg-blue-50 dark:bg-blue-950/20 border-l-4 border-blue-500'
                          : 'bg-gray-50 dark:bg-gray-800/50 border-l-4 border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <Badge variant={response.isFromSupport ? 'default' : 'secondary'}>
                            {response.isFromSupport ? 'Support' : 'User'}
                          </Badge>
                          {response.isFromSupport && response.supportStaffName && (
                            <span className="text-sm text-muted-foreground">
                              by {response.supportStaffName}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {response.createdAt instanceof Date ? response.createdAt.toLocaleString() : new Date(response.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm">{response.message}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Add Response */}
            <Card>
              <CardHeader>
                <CardTitle>Add Response</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Type your response here..."
                  value={responseMessage}
                  onChange={(e) => setResponseMessage(e.target.value)}
                  rows={4}
                />
                <Button
                  onClick={handleSendResponse}
                  disabled={!responseMessage.trim() || submitting}
                >
                  {submitting ? 'Sending...' : 'Send Response'}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Status Management */}
            <Card>
              <CardHeader>
                <CardTitle>Status Management</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Status</label>
                  <MobileSelect 
                    value={newStatus} 
                    onValueChange={setNewStatus}
                    placeholder="Select status"
                    options={[
                      { value: "open", label: "Open" },
                      { value: "in_progress", label: "In Progress" },
                      { value: "closed", label: "Closed" },
                      { value: "resolved", label: "Resolved" }
                    ]}
                  />
                </div>
                {newStatus !== ticket.status && (
                  <Button
                    onClick={handleStatusUpdate}
                    disabled={submitting}
                    className="w-full"
                  >
                    {submitting ? 'Updating...' : 'Update Status'}
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Assignment */}
            <Card>
              <CardHeader>
                <CardTitle>Assignment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {ticket.assignedTo ? (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Assigned to:</p>
                    <p className="font-medium break-words">{ticket.assignedToName}</p>
                    {ticket.assignedAt && (
                      <p className="text-xs text-muted-foreground">
                        {ticket.assignedAt instanceof Date && !isNaN(ticket.assignedAt.getTime()) 
                          ? ticket.assignedAt.toLocaleString() 
                          : 'Date unavailable'}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Not assigned</p>
                )}
                <Button
                  onClick={handleAssignTicket}
                  disabled={submitting}
                  variant={ticket.assignedTo === user?.uid ? 'destructive' : 'default'}
                  className="w-full"
                >
                  {submitting
                    ? 'Updating...'
                    : ticket.assignedTo === user?.uid
                    ? 'Unassign from me'
                    : 'Assign to me'
                  }
                </Button>
              </CardContent>
            </Card>

            {/* Ticket Info */}
            <Card>
              <CardHeader>
                <CardTitle>Ticket Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between items-start">
                  <span className="text-muted-foreground">Ticket ID:</span>
                  <span className="font-mono text-right break-all">{ticket.ticketId}</span>
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-muted-foreground">Created:</span>
                  <span className="text-right">
                    {ticket.createdAt instanceof Date && !isNaN(ticket.createdAt.getTime()) 
                      ? ticket.createdAt.toLocaleDateString() 
                      : 'Date unavailable'}
                  </span>
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-muted-foreground">Last Updated:</span>
                  <span className="text-right">
                    {ticket.updatedAt instanceof Date && !isNaN(ticket.updatedAt.getTime()) 
                      ? ticket.updatedAt.toLocaleDateString() 
                      : 'Date unavailable'}
                  </span>
                </div>
                {ticket.hoursSinceCreated && (
                  <div className="flex justify-between items-start">
                    <span className="text-muted-foreground">Age:</span>
                    <span className={`text-right ${getTimePriorityColor(ticket.timePriority)}`}>
                      {ticket.hoursSinceCreated}h
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}