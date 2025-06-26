import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { HelpCircle, MessageCircle, Send, CheckCircle } from "lucide-react";
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/components/ui/use-toast';

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

interface SupportTicket {
  subject: string;
  category: string;
  priority: string;
  description: string;
}

const SupportPageContent = () => {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState("");
  
  const [ticket, setTicket] = useState<SupportTicket>({
    subject: '',
    category: '',
    priority: 'medium',
    description: ''
  });

  // Redirect if not authenticated
  useEffect(() => {
    if (!user) {
      router.push('/auth/sign-in?redirect=/support');
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      // Validation
      if (!ticket.subject.trim()) {
        throw new Error("Subject is required");
      }
      if (!ticket.category) {
        throw new Error("Please select a category");
      }
      if (!ticket.description.trim()) {
        throw new Error("Description is required");
      }
      if (ticket.description.length < 10) {
        throw new Error("Description must be at least 10 characters long");
      }

      // Get the user's ID token for authentication
      const token = await user?.getIdToken();
      if (!token) {
        throw new Error("Authentication required. Please sign in again.");
      }

      const response = await fetch('/api/support/create-ticket', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          subject: ticket.subject.trim(),
          category: ticket.category,
          priority: ticket.priority,
          description: ticket.description.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create support ticket');
      }

      setIsSubmitted(true);
      toast({
        title: "Support ticket created",
        description: `Your ticket #${data.ticketId} has been submitted. We'll get back to you soon!`,
      });

      // Reset form
      setTicket({
        subject: '',
        category: '',
        priority: 'medium',
        description: ''
      });

    } catch (err: any) {
      console.error('Error creating support ticket:', err);
      setError(err.message || 'Failed to create support ticket. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: keyof SupportTicket, value: string) => {
    setTicket(prev => ({ ...prev, [field]: value }));
    if (error) setError(""); // Clear error when user starts typing
  };

  if (!user) {
    return <Skeleton className="w-full h-[400px]" />;
  }

  if (isSubmitted) {
    return (
      <DashboardLayout>
        <Toaster />
        <div className="container mx-auto p-6 max-w-2xl">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
                <h2 className="text-2xl font-bold">Ticket Submitted Successfully!</h2>
                <p className="text-muted-foreground">
                  Thank you for contacting support. We've received your ticket and will respond within 24 hours.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
                  <Button onClick={() => setIsSubmitted(false)} variant="outline" className="w-full sm:w-auto">
                    Submit Another Ticket
                  </Button>
                  <Button onClick={() => router.push('/dashboard/support-tickets')} variant="outline" className="w-full sm:w-auto">
                    View My Tickets
                  </Button>
                  <Button onClick={() => router.push('/dashboard')} className="w-full sm:w-auto">
                    Back to Dashboard
                  </Button>
                </div>
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
      <div className="container mx-auto p-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <HelpCircle className="h-6 w-6" />
              Contact Support
            </CardTitle>
            <CardDescription>
              Need help? Submit a support ticket and our team will get back to you as soon as possible.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Subject */}
              <div className="space-y-2">
                <Label htmlFor="subject">Subject *</Label>
                <Input
                  id="subject"
                  value={ticket.subject}
                  onChange={(e) => handleInputChange('subject', e.target.value)}
                  placeholder="Brief description of your issue"
                  maxLength={100}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  {ticket.subject.length}/100 characters
                </p>
              </div>

              {/* Category */}
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select value={ticket.category} onValueChange={(value) => handleInputChange('category', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="account">Account Issues</SelectItem>
                    <SelectItem value="billing">Billing & Payments</SelectItem>
                    <SelectItem value="orders">Orders & Shipping</SelectItem>
                    <SelectItem value="listings">Listings & Marketplace</SelectItem>
                    <SelectItem value="technical">Technical Issues</SelectItem>
                    <SelectItem value="refunds">Refunds & Returns</SelectItem>
                    <SelectItem value="safety">Safety & Security</SelectItem>
                    <SelectItem value="feature">Feature Request</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Priority */}
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select value={ticket.priority} onValueChange={(value) => handleInputChange('priority', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low - General inquiry</SelectItem>
                    <SelectItem value="medium">Medium - Standard issue</SelectItem>
                    <SelectItem value="high">High - Urgent issue</SelectItem>
                    <SelectItem value="critical">Critical - Account/payment issue</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  value={ticket.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Please provide detailed information about your issue, including any error messages, steps to reproduce the problem, and what you expected to happen."
                  className="min-h-[120px]"
                  maxLength={2000}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  {ticket.description.length}/2000 characters (minimum 10 characters)
                </p>
              </div>

              {/* User Info Display */}
              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <h4 className="font-medium text-sm">Your Information</h4>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p><strong>Email:</strong> {user.email}</p>
                  <p><strong>Username:</strong> {user.displayName || 'Not set'}</p>
                  <p><strong>User ID:</strong> {user.uid}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  This information will be included with your ticket to help us assist you better.
                </p>
              </div>

              {/* Submit Button */}
              <Button 
                type="submit" 
                disabled={isLoading || !ticket.subject.trim() || !ticket.category || !ticket.description.trim() || ticket.description.length < 10}
                className="w-full"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Creating Ticket...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Send className="h-4 w-4" />
                    Submit Support Ticket
                  </div>
                )}
              </Button>
            </form>

            {/* Help Text */}
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
              <div className="flex items-start gap-3">
                <MessageCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div className="space-y-2">
                  <h4 className="font-medium text-blue-900 dark:text-blue-100">Response Time</h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    We typically respond to support tickets within 24 hours during business days. 
                    Critical issues are prioritized and may receive faster responses.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default dynamic(() => Promise.resolve(SupportPageContent), {
  ssr: false
});