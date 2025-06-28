import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
        
        // Convert Firestore timestamps to Date objects
        const processedTicket = {
          ...ticketData,
          createdAt: ticketData.createdAt?.seconds ? new Date(ticketData.createdAt.seconds * 1000) : new Date(ticketData.createdAt),
          updatedAt: ticketData.updatedAt?.seconds ? new Date(ticketData.updatedAt.seconds * 1000) : new Date(ticketData.updatedAt),
          lastResponseAt: ticketData.lastResponseAt?.seconds ? new Date(ticketData.lastResponseAt.seconds * 1000) : ticketData.lastResponseAt,
          assignedAt: ticketData.assignedAt?.seconds ? new Date(ticketData.assignedAt.seconds * 1000) : ticketData.assignedAt,
          responses: (ticketData.responses || []).map((response: any) => ({
            ...response,
            createdAt: response.createdAt?.seconds ? new Date(response.createdAt.seconds * 1000) : new Date(response.createdAt)
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
        fetchTicket(); // Refresh ticket data
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
        toast.success('Status updated successfully');
        fetchTicket(); // Refresh ticket data
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to update status');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
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

      const response = await fetch('/api/admin/support/assign-ticket', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          ticketId: ticket.ticketId,
          assignedTo: ticket.assignedTo === user.uid ? null : user.uid,
          assignedToName: ticket.assignedTo === user.uid ? null : user.displayName || user.email,
        }),
      });

      if (response.ok) {
        const action = ticket.assignedTo === user.uid ? 'unassigned' : 'assigned';
        toast.success(`Ticket ${action} successfully`);
        fetchTicket(); // Refresh ticket data
      } else {
        const errorData = await response.json();
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
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/admin/support-management')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Support Management
            </Button>
            <h1 className="text-2xl font-bold">Support Ticket #{ticket.ticketId}</h1>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchTicket}
            disabled={refreshing}
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
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center space-x-2">
                      <span>{ticket.subject}</span>
                      {ticket.timePriority && (
                        <Badge variant="outline" className={getTimePriorityColor(ticket.timePriority)}>
                          {getTimePriorityLabel(ticket.timePriority)}
                        </Badge>
                      )}
                    </CardTitle>
                    <div className="flex items-center space-x-4 mt-2 text-sm text-muted-foreground">
                      <div className="flex items-center space-x-1">
                        <User className="h-4 w-4" />
                        <span>{ticket.userName}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Mail className="h-4 w-4" />
                        <span>{ticket.userEmail}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Clock className="h-4 w-4" />
                        <span>{ticket.createdAt instanceof Date ? ticket.createdAt.toLocaleString() : new Date(ticket.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge className={getPriorityColor(ticket.priority)}>
                      {ticket.priority.toUpperCase()}
                    </Badge>
                    <Badge className={getStatusColor(ticket.status)}>
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
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                    </SelectContent>
                  </Select>
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
                    <p className="font-medium">{ticket.assignedToName}</p>
                    <p className="text-xs text-muted-foreground">
                      {ticket.assignedAt instanceof Date ? ticket.assignedAt.toLocaleString() : new Date(ticket.assignedAt).toLocaleString()}
                    </p>
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
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ticket ID:</span>
                  <span className="font-mono">{ticket.ticketId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created:</span>
                  <span>{ticket.createdAt instanceof Date ? ticket.createdAt.toLocaleDateString() : new Date(ticket.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last Updated:</span>
                  <span>{ticket.updatedAt instanceof Date ? ticket.updatedAt.toLocaleDateString() : new Date(ticket.updatedAt).toLocaleDateString()}</span>
                </div>
                {ticket.hoursSinceCreated && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Age:</span>
                    <span className={getTimePriorityColor(ticket.timePriority)}>
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