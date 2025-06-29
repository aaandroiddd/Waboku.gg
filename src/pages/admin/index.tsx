import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Footer } from '@/components/Footer';
import { WantedPostsDebugger } from '@/components/dashboard/WantedPostsDebugger';
import { WebhookFixTrigger } from '@/components/WebhookFixTrigger';
import { ApiTestPanel } from '@/components/ApiTestPanel';
import { NotificationDebugger } from '@/components/NotificationDebugger';
import { EmailNotificationTester } from '@/components/EmailNotificationTester';
import { MockListingGenerator } from '@/components/admin/MockListingGenerator';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";

interface ApiResponse {
  success?: boolean;
  error?: string;
  message?: string;
  [key: string]: any;
}

const SECTIONS = [
  { id: "account-tier-sync", label: "Account Tier Synchronization" },
  { id: "api-endpoints", label: "API Endpoints" },
  { id: "api-test", label: "API Test Panel" },
  { id: "moderation", label: "Content Moderation" },
  { id: "db-usage", label: "Database Usage Monitoring" },
  { id: "email-test", label: "Email Notification Testing" },
  { id: "firebase", label: "Firebase Diagnostics" },
  { id: "listing-analytics", label: "Listing Analytics & Capacity Monitoring" },
  { id: "listing-visibility", label: "Listing Visibility Diagnostics" },
  { id: "mock-listings", label: "Mock Listing Generator" },
  { id: "moderator", label: "Moderator Management" },
  { id: "notification-debug", label: "Notification System Debugger" },
  { id: "review-system", label: "Review System Debug" },
  { id: "webhook", label: "Stripe Webhook Fix" },
  { id: "subscription", label: "Subscription Management" },
  { id: "support-management", label: "Support Ticket Management" },
  { id: "user-tier", label: "User Tier Management" },
  { id: "wanted-posts", label: "Wanted Posts Debugging Tools" },
  { id: "webhook-notification-test", label: "Webhook & Notification Testing" },
];

export default function AdminDashboard() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [adminSecret, setAdminSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [responseDialog, setResponseDialog] = useState(false);
  const [apiResponse, setApiResponse] = useState<ApiResponse | null>(null);
  const [userId, setUserId] = useState('');
  const [selectedTier, setSelectedTier] = useState<string>('');
  const [moderatorUserId, setModeratorUserId] = useState('');

  // For smooth scroll to section
  const sectionRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  useEffect(() => {
    const secret = localStorage.getItem('admin_secret');
    if (secret) {
      setAdminSecret(secret);
      verifyAdmin(secret);
    }
  }, []);

  const verifyAdmin = async (secret: string) => {
    try {
      const response = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${secret}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setIsAuthorized(true);
        localStorage.setItem('admin_secret', secret);
      } else {
        setIsAuthorized(false);
        localStorage.removeItem('admin_secret');
      }
    } catch (error) {
      console.error('Error verifying admin:', error);
      setIsAuthorized(false);
    }
  };

  const handleApiCall = async (endpoint: string, method: string = 'POST') => {
    setLoading(true);
    try {
      let headers = {
        'Content-Type': 'application/json'
      };
      if (endpoint === '/api/listings/cleanup-archived') {
        headers = {
          ...headers,
          'Authorization': `Bearer ${adminSecret}`
        };
      } else {
        headers = {
          ...headers,
          'x-admin-secret': adminSecret
        };
      }
      const response = await fetch(endpoint, {
        method,
        headers
      });
      const data = await response.json();
      setApiResponse(data);
      setResponseDialog(true);
    } catch (error) {
      setApiResponse({ error: 'Failed to execute API call' });
      setResponseDialog(true);
    }
    setLoading(false);
  };

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="container mx-auto p-8 flex-grow">
          <Card className="p-6">
            <h1 className="text-2xl font-bold mb-4">Admin Authentication</h1>
            <div className="space-y-4">
              <input
                type="password"
                placeholder="Enter admin secret"
                className="w-full p-2 border rounded"
                onChange={(e) => setAdminSecret(e.target.value)}
              />
              <Button 
                onClick={() => verifyAdmin(adminSecret)}
                disabled={!adminSecret}
              >
                Verify Admin Access
              </Button>
            </div>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  const apiEndpoints = [
    {
      name: "Storage Cleanup (60 days)",
      endpoint: "/api/cleanup/storage-cleanup",
      description: "Delete listing images older than 60 days"
    },
    {
      name: "Archive Expired Listings",
      endpoint: "/api/listings/archive-expired",
      description: "Archive listings that have expired"
    },
    {
      name: "Cleanup Archived Listings",
      endpoint: "/api/listings/cleanup-archived",
      description: "Remove old archived listings"
    },
    {
      name: "Set Default Tiers",
      endpoint: "/api/admin/set-default-tiers",
      description: "Initialize default account tiers"
    },
    {
      name: "Cleanup Inactive Listings",
      endpoint: "/api/cleanup-inactive-listings",
      description: "Remove inactive listings"
    }
  ];

  const handleUpdateUserTier = async () => {
    if (!userId || !selectedTier) {
      setApiResponse({ error: 'User ID and tier are required' });
      setResponseDialog(true);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch('/api/admin/update-user-tier', {
        method: 'POST',
        headers: {
          'x-admin-secret': adminSecret,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          tier: selectedTier
        })
      });
      const data = await response.json();
      setApiResponse(data);
      setResponseDialog(true);
      if (response.ok) {
        setUserId('');
        setSelectedTier('');
      }
    } catch (error) {
      setApiResponse({ error: 'Failed to update user tier' });
      setResponseDialog(true);
    }
    setLoading(false);
  };

  // Smooth scroll to section
  const handleTOCClick = (id: string) => {
    const ref = sectionRefs.current[id];
    if (ref) {
      ref.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="container mx-auto p-8 flex-grow">
        <Card className="p-6">
          <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>
          <Alert className="mb-6">
            <AlertDescription>
              ⚠️ These operations can modify or delete data. Use with caution.
            </AlertDescription>
          </Alert>

          {/* Table of Contents */}
          <nav className="mb-8">
            <h2 className="text-lg font-semibold mb-2">Quick Navigation</h2>
            <ul className="flex flex-wrap gap-2 text-sm">
              {SECTIONS.map((section) => (
                <li key={section.id}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTOCClick(section.id)}
                  >
                    {section.label}
                  </Button>
                </li>
              ))}
            </ul>
          </nav>

          {/* Accordion for all admin sections */}
          <Accordion type="multiple" className="w-full">
            {/* User Tier Management */}
            <AccordionItem value="user-tier" id="user-tier" ref={el => (sectionRefs.current["user-tier"] = el)}>
              <AccordionTrigger>User Tier Management</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="userId">User ID</Label>
                    <Input
                      id="userId"
                      placeholder="Enter Firebase User ID"
                      value={userId}
                      onChange={(e) => setUserId(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tier">Account Tier</Label>
                    <Select value={selectedTier} onValueChange={setSelectedTier}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select tier" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="free">Free</SelectItem>
                        <SelectItem value="premium">Premium</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    onClick={handleUpdateUserTier}
                    disabled={loading || !userId || !selectedTier}
                    className="w-full"
                  >
                    {loading ? 'Updating...' : 'Update User Tier'}
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* API Endpoints */}
            <AccordionItem value="api-endpoints" id="api-endpoints" ref={el => (sectionRefs.current["api-endpoints"] = el)}>
              <AccordionTrigger>API Endpoints</AccordionTrigger>
              <AccordionContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 py-4">
                  {apiEndpoints.map((api) => (
                    <Card key={api.endpoint} className="p-4">
                      <h3 className="font-semibold mb-2">{api.name}</h3>
                      <p className="text-sm text-muted-foreground mb-4">{api.description}</p>
                      <Button
                        onClick={() => handleApiCall(api.endpoint)}
                        disabled={loading}
                        className="w-full"
                      >
                        {loading ? 'Processing...' : 'Execute'}
                      </Button>
                    </Card>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Mock Listing Generator */}
            <AccordionItem value="mock-listings" id="mock-listings" ref={el => (sectionRefs.current["mock-listings"] = el)}>
              <AccordionTrigger>Mock Listing Generator</AccordionTrigger>
              <AccordionContent>
                <div className="py-4">
                  <MockListingGenerator adminSecret={adminSecret} />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Subscription Management */}
            <AccordionItem value="subscription" id="subscription" ref={el => (sectionRefs.current["subscription"] = el)}>
              <AccordionTrigger>Subscription Management</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 py-4">
                  <p className="text-sm text-muted-foreground">
                    Fix subscription downgrades and synchronize subscription data between Stripe, Firestore, and Realtime Database.
                  </p>
                  <Button 
                    onClick={() => router.push(`/admin/fix-subscriptions?adminSecret=${adminSecret}`)}
                    className="w-full"
                  >
                    Fix Subscriptions
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Content Moderation */}
            <AccordionItem value="moderation" id="moderation" ref={el => (sectionRefs.current["moderation"] = el)}>
              <AccordionTrigger>Content Moderation</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 py-4">
                  <p className="text-sm text-muted-foreground">
                    Review and moderate listings that have been flagged for review.
                  </p>
                  <Button 
                    onClick={() => router.push(`/admin/moderation?adminSecret=${adminSecret}`)}
                    className="w-full"
                  >
                    Moderation Dashboard
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Moderator Management */}
            <AccordionItem value="moderator" id="moderator" ref={el => (sectionRefs.current["moderator"] = el)}>
              <AccordionTrigger>Moderator Management</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="moderatorUserId">User ID</Label>
                    <Input
                      id="moderatorUserId"
                      placeholder="Enter Firebase User ID"
                      value={moderatorUserId}
                      onChange={(e) => setModeratorUserId(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      onClick={async () => {
                        if (!moderatorUserId) {
                          setApiResponse({ error: 'User ID is required' });
                          setResponseDialog(true);
                          return;
                        }
                        setLoading(true);
                        try {
                          const response = await fetch('/api/admin/assign-moderator', {
                            method: 'POST',
                            headers: {
                              'x-admin-secret': adminSecret,
                              'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                              userId: moderatorUserId,
                              action: 'add'
                            })
                          });
                          const data = await response.json();
                          setApiResponse(data);
                          setResponseDialog(true);
                          if (response.ok) {
                            setModeratorUserId('');
                          }
                        } catch (error) {
                          setApiResponse({ error: 'Failed to assign moderator role' });
                          setResponseDialog(true);
                        }
                        setLoading(false);
                      }}
                      disabled={loading || !moderatorUserId}
                      className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      {loading ? 'Assigning...' : 'Assign Moderator'}
                    </Button>
                    <Button 
                      onClick={async () => {
                        if (!moderatorUserId) {
                          setApiResponse({ error: 'User ID is required' });
                          setResponseDialog(true);
                          return;
                        }
                        setLoading(true);
                        try {
                          const response = await fetch('/api/admin/assign-moderator', {
                            method: 'POST',
                            headers: {
                              'x-admin-secret': adminSecret,
                              'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                              userId: moderatorUserId,
                              action: 'remove'
                            })
                          });
                          const data = await response.json();
                          setApiResponse(data);
                          setResponseDialog(true);
                          if (response.ok) {
                            setModeratorUserId('');
                          }
                        } catch (error) {
                          setApiResponse({ error: 'Failed to remove moderator role' });
                          setResponseDialog(true);
                        }
                        setLoading(false);
                      }}
                      disabled={loading || !moderatorUserId}
                      variant="outline"
                      className="flex-1"
                    >
                      {loading ? 'Removing...' : 'Remove Moderator'}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Moderators can access the moderation dashboard to review flagged listings.
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Stripe Webhook Fix */}
            <AccordionItem value="webhook" id="webhook" ref={el => (sectionRefs.current["webhook"] = el)}>
              <AccordionTrigger>Stripe Webhook Fix</AccordionTrigger>
              <AccordionContent>
                <div className="py-4">
                  <WebhookFixTrigger adminSecret={adminSecret} />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* API Test Panel */}
            <AccordionItem value="api-test" id="api-test" ref={el => (sectionRefs.current["api-test"] = el)}>
              <AccordionTrigger>API Test Panel</AccordionTrigger>
              <AccordionContent>
                <div className="py-4">
                  <ApiTestPanel adminSecret={adminSecret} />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Firebase Diagnostics */}
            <AccordionItem value="firebase" id="firebase" ref={el => (sectionRefs.current["firebase"] = el)}>
              <AccordionTrigger>Firebase Diagnostics</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 py-4">
                  <p className="text-sm text-muted-foreground">
                    Troubleshoot Firebase connection issues and database rules.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      onClick={() => router.push(`/admin/firebase-diagnostics`)}
                      className="w-full"
                    >
                      Firebase Diagnostics
                    </Button>
                    <Button 
                      onClick={() => router.push(`/admin/firebase-connection-debug`)}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      Connection Debugger
                    </Button>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Account Tier Sync */}
            <AccordionItem value="account-tier-sync" id="account-tier-sync" ref={el => (sectionRefs.current["account-tier-sync"] = el)}>
              <AccordionTrigger>Account Tier Synchronization</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 py-4">
                  <p className="text-sm text-muted-foreground">
                    Sync account tiers with Stripe subscription data to ensure correct listing expiration.
                  </p>
                  <Button 
                    onClick={() => router.push(`/admin/account-tier-sync`)}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    Account Tier Sync
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Database Usage Monitoring */}
            <AccordionItem value="db-usage" id="db-usage" ref={el => (sectionRefs.current["db-usage"] = el)}>
              <AccordionTrigger>Database Usage Monitoring</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 py-4">
                  <p className="text-sm text-muted-foreground">
                    Monitor and optimize Firebase Realtime Database usage to reduce quota issues.
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <Button 
                      onClick={() => router.push(`/admin/database-usage`)}
                      className="w-full bg-yellow-600 hover:bg-yellow-700"
                    >
                      Database Usage Monitor
                    </Button>
                    <Button 
                      onClick={() => router.push(`/admin/database-monitor`)}
                      className="w-full bg-orange-600 hover:bg-orange-700"
                    >
                      Real-time Database Monitor
                    </Button>
                    <Button 
                      onClick={() => router.push(`/admin/database-usage-audit`)}
                      className="w-full bg-red-600 hover:bg-red-700"
                    >
                      Database Usage Audit
                    </Button>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Listing Analytics */}
            <AccordionItem value="listing-analytics" id="listing-analytics" ref={el => (sectionRefs.current["listing-analytics"] = el)}>
              <AccordionTrigger>Listing Analytics & Capacity Monitoring</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 py-4">
                  <p className="text-sm text-muted-foreground">
                    Monitor marketplace health, listing counts per category, and 7-digit ID capacity usage.
                  </p>
                  <Button 
                    onClick={() => router.push(`/admin/listing-analytics`)}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    Listing Analytics Dashboard
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Listing Visibility Diagnostics */}
            <AccordionItem value="listing-visibility" id="listing-visibility" ref={el => (sectionRefs.current["listing-visibility"] = el)}>
              <AccordionTrigger>Listing Visibility Diagnostics</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 py-4">
                  <p className="text-sm text-muted-foreground">
                    Diagnose and fix issues with listing visibility in the marketplace.
                  </p>
                  <Button 
                    onClick={() => router.push(`/admin/listing-diagnostics`)}
                    className="w-full"
                  >
                    Listing Diagnostics
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Review System Debug */}
            <AccordionItem value="review-system" id="review-system" ref={el => (sectionRefs.current["review-system"] = el)}>
              <AccordionTrigger>Review System Debug</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 py-4">
                  <p className="text-sm text-muted-foreground">
                    Diagnose and fix issues with the review system.
                  </p>
                  <Button 
                    onClick={() => router.push(`/admin/review-system`)}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    Review System Debug
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Notification System Debugger */}
            <AccordionItem value="notification-debug" id="notification-debug" ref={el => (sectionRefs.current["notification-debug"] = el)}>
              <AccordionTrigger>Notification System Debugger</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 py-4">
                  <p className="text-sm text-muted-foreground">
                    Test and debug the notification system functionality, including creation, delivery, and API endpoints.
                  </p>
                  <NotificationDebugger />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Email Notification Testing */}
            <AccordionItem value="email-test" id="email-test" ref={el => (sectionRefs.current["email-test"] = el)}>
              <AccordionTrigger>Email Notification Testing</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 py-4">
                  <p className="text-sm text-muted-foreground">
                    Test email notifications using Resend. Send welcome emails, notification emails, or test the full notification system.
                  </p>
                  <EmailNotificationTester adminSecret={adminSecret} />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Webhook & Notification Testing */}
            <AccordionItem value="webhook-notification-test" id="webhook-notification-test" ref={el => (sectionRefs.current["webhook-notification-test"] = el)}>
              <AccordionTrigger>Webhook & Notification Testing</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 py-4">
                  <p className="text-sm text-muted-foreground">
                    Comprehensive testing for webhook processing, notification creation, email sending, and badge system functionality.
                  </p>
                  
                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="testUserId">Test User ID</Label>
                      <Input
                        id="testUserId"
                        placeholder="Enter Firebase User ID for testing"
                        value={userId}
                        onChange={(e) => setUserId(e.target.value)}
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <Button 
                        onClick={async () => {
                          if (!userId) {
                            setApiResponse({ error: 'User ID is required for testing' });
                            setResponseDialog(true);
                            return;
                          }
                          setLoading(true);
                          try {
                            const response = await fetch('/api/debug/test-webhook-and-notifications', {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json'
                              },
                              body: JSON.stringify({
                                testType: 'webhook_simulation',
                                userId: userId
                              })
                            });
                            const data = await response.json();
                            setApiResponse(data);
                            setResponseDialog(true);
                          } catch (error) {
                            setApiResponse({ error: 'Failed to run webhook simulation test' });
                            setResponseDialog(true);
                          }
                          setLoading(false);
                        }}
                        disabled={loading || !userId}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {loading ? 'Testing...' : 'Test Webhook Simulation'}
                      </Button>
                      
                      <Button 
                        onClick={async () => {
                          if (!userId) {
                            setApiResponse({ error: 'User ID is required for testing' });
                            setResponseDialog(true);
                            return;
                          }
                          setLoading(true);
                          try {
                            const response = await fetch('/api/debug/test-webhook-and-notifications', {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json'
                              },
                              body: JSON.stringify({
                                testType: 'notification_system',
                                userId: userId
                              })
                            });
                            const data = await response.json();
                            setApiResponse(data);
                            setResponseDialog(true);
                          } catch (error) {
                            setApiResponse({ error: 'Failed to run notification system test' });
                            setResponseDialog(true);
                          }
                          setLoading(false);
                        }}
                        disabled={loading || !userId}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {loading ? 'Testing...' : 'Test Notification System'}
                      </Button>
                      
                      <Button 
                        onClick={async () => {
                          if (!userId) {
                            setApiResponse({ error: 'User ID is required for testing' });
                            setResponseDialog(true);
                            return;
                          }
                          setLoading(true);
                          try {
                            const response = await fetch('/api/debug/test-webhook-and-notifications', {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json'
                              },
                              body: JSON.stringify({
                                testType: 'message_notification',
                                userId: userId
                              })
                            });
                            const data = await response.json();
                            setApiResponse(data);
                            setResponseDialog(true);
                          } catch (error) {
                            setApiResponse({ error: 'Failed to run message notification test' });
                            setResponseDialog(true);
                          }
                          setLoading(false);
                        }}
                        disabled={loading || !userId}
                        className="bg-purple-600 hover:bg-purple-700"
                      >
                        {loading ? 'Testing...' : 'Test Message Notifications'}
                      </Button>
                      
                      <Button 
                        onClick={async () => {
                          if (!userId) {
                            setApiResponse({ error: 'User ID is required for testing' });
                            setResponseDialog(true);
                            return;
                          }
                          setLoading(true);
                          try {
                            const response = await fetch('/api/debug/test-webhook-and-notifications', {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json'
                              },
                              body: JSON.stringify({
                                testType: 'unread_context_test',
                                userId: userId
                              })
                            });
                            const data = await response.json();
                            setApiResponse(data);
                            setResponseDialog(true);
                          } catch (error) {
                            setApiResponse({ error: 'Failed to run unread context test' });
                            setResponseDialog(true);
                          }
                          setLoading(false);
                        }}
                        disabled={loading || !userId}
                        className="bg-orange-600 hover:bg-orange-700"
                      >
                        {loading ? 'Testing...' : 'Test Badge System'}
                      </Button>
                    </div>
                    
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p><strong>Webhook Simulation:</strong> Tests order creation, notification creation, and email sending</p>
                      <p><strong>Notification System:</strong> Tests Firebase Admin, notification CRUD operations</p>
                      <p><strong>Message Notifications:</strong> Tests message notification creation and email delivery</p>
                      <p><strong>Badge System:</strong> Tests UnreadContext data sources and badge counting logic</p>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Support Ticket Management */}
            <AccordionItem value="support-management" id="support-management" ref={el => (sectionRefs.current["support-management"] = el)}>
              <AccordionTrigger>Support Ticket Management</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 py-4">
                  <p className="text-sm text-muted-foreground">
                    Manage and respond to user support tickets. View all tickets, respond to users, and update ticket statuses.
                  </p>
                  <Button 
                    onClick={() => router.push(`/admin/support-management`)}
                    className="w-full bg-indigo-600 hover:bg-indigo-700"
                  >
                    Support Management Dashboard
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Wanted Posts Debugging Tools */}
            <AccordionItem value="wanted-posts" id="wanted-posts" ref={el => (sectionRefs.current["wanted-posts"] = el)}>
              <AccordionTrigger>Wanted Posts Debugging Tools</AccordionTrigger>
              <AccordionContent>
                <div className="py-4">
                  <WantedPostsDebugger />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* API Response Dialog */}
          <Dialog open={responseDialog} onOpenChange={setResponseDialog}>
            <DialogContent className="max-w-[600px]">
              <DialogHeader>
                <DialogTitle>API Response</DialogTitle>
                <DialogDescription>
                  Response details from the API operation
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[400px] mt-4">
                <pre className="p-4 bg-muted rounded-lg overflow-x-auto">
                  {JSON.stringify(apiResponse, null, 2)}
                </pre>
              </ScrollArea>
            </DialogContent>
          </Dialog>
        </Card>
      </div>
      <Footer />
    </div>
  );
}