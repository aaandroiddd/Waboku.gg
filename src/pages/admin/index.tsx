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
import { MobileSelect } from "@/components/ui/mobile-select";
import { Footer } from '@/components/Footer';
import { WantedPostsDebugger } from '@/components/dashboard/WantedPostsDebugger';
import { WebhookFixTrigger } from '@/components/WebhookFixTrigger';
import { ApiTestPanel } from '@/components/ApiTestPanel';
import { NotificationDebugger } from '@/components/NotificationDebugger';
import { EmailNotificationTester } from '@/components/EmailNotificationTester';
import { MockListingGenerator } from '@/components/admin/MockListingGenerator';
import { PickupCodeDebugger } from '@/components/admin/PickupCodeDebugger';
import { ListingUsernameDebugger } from '@/components/admin/ListingUsernameDebugger';
import ProductionUsernameDebugger from '@/components/admin/ProductionUsernameDebugger';
import { ListingExpirationDebugger } from '@/components/admin/ListingExpirationDebugger';
import DashboardOfferDebugger from '@/components/admin/DashboardOfferDebugger';
import UserMigrationTool from '@/components/admin/UserMigrationTool';
import ShippingReminderTester from '@/components/admin/ShippingReminderTester';
import AccountTierDebugger from '@/components/admin/AccountTierDebugger';
import { TTLFieldValidator } from '@/components/admin/TTLFieldValidator';
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
  { id: "account-tier-debug", label: "Account Tier Debugger" },
  { id: "account-tier-sync", label: "Account Tier Synchronization" },
  { id: "api-endpoints", label: "API Endpoints" },
  { id: "api-test", label: "API Test Panel" },
  { id: "dashboard-offer-debug", label: "Dashboard Offer Debugger" },
  { id: "db-usage", label: "Database Usage Monitoring" },
  { id: "email-test", label: "Email Notification Testing" },
  { id: "firebase", label: "Firebase Diagnostics" },
  { id: "fix-archived-listings", label: "Fix Archived Listings Visibility" },
  { id: "fix-specific-listing", label: "Fix Specific Listing" },
  { id: "listing-analytics", label: "Listing Analytics & Capacity Monitoring" },
  { id: "listing-debug", label: "Listing Debug Tool" },
  { id: "listing-expiration-debug", label: "Listing Expiration Debugger" },
  { id: "listing-username-debug", label: "Listing Username Debugger" },
  { id: "listing-visibility", label: "Listing Visibility Diagnostics" },
  { id: "mock-listings", label: "Mock Listing Generator" },
  { id: "moderation", label: "Content Moderation" },
  { id: "moderator", label: "Moderator Management" },
  { id: "notification-debug", label: "Notification System Debugger" },
  { id: "pickup-code-debug", label: "Pickup Code Debugger" },
  { id: "production-username-debug", label: "Production Username Debugger" },
  { id: "review-system", label: "Review System Debug" },
  { id: "review-migration", label: "Review Username Migration" },
  { id: "shipping-reminders", label: "Shipping Reminder System" },
  { id: "subscription", label: "Subscription Management" },
  { id: "support-management", label: "Support Ticket Management" },
  { id: "ttl-field-validator", label: "TTL Field Validator" },
  { id: "user-migration", label: "User Account Migration" },
  { id: "user-tier", label: "User Tier Management" },
  { id: "wanted-posts", label: "Wanted Posts Debugging Tools" },
  { id: "webhook", label: "Stripe Webhook Fix" },
  { id: "webhook-notification-test", label: "Webhook & Notification Testing" },
];

export default function AdminDashboard() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [adminSecret, setAdminSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [responseDialog, setResponseDialog] = useState(false);
  const [apiResponse, setApiResponse] = useState<ApiResponse | null>(null);
  const [userId, setUserId] = useState('');
  const [selectedTier, setSelectedTier] = useState<string>('');
  const [moderatorUserId, setModeratorUserId] = useState('');
  const [listingsDebugResult, setListingsDebugResult] = useState<string>('');
  const [isDebuggingListings, setIsDebuggingListings] = useState(false);
  const [testTtlListingId, setTestTtlListingId] = useState('');

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
    setLoading(true);
    setAuthError('');
    
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
        setAuthError('');
        localStorage.setItem('admin_secret', secret);
      } else {
        setIsAuthorized(false);
        localStorage.removeItem('admin_secret');
        
        // Handle different error responses
        if (response.status === 401) {
          setAuthError('Invalid admin secret. Please check your credentials and try again.');
        } else if (response.status === 403) {
          setAuthError('Access denied. You do not have admin privileges.');
        } else {
          setAuthError('Authentication failed. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error verifying admin:', error);
      setIsAuthorized(false);
      setAuthError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleApiCall = async (endpoint: string, method: string = 'POST') => {
    setLoading(true);
    try {
      let headers = {
        'Content-Type': 'application/json'
      };
      if (endpoint === '/api/listings/cleanup-archived' || 
          endpoint === '/api/admin/test-cleanup-archived' || 
          endpoint === '/api/admin/force-cleanup-archived' ||
          endpoint === '/api/admin/nuclear-cleanup-archived' ||
          endpoint === '/api/admin/ultra-nuclear-cleanup-archived' ||
          endpoint === '/api/admin/check-cleanup-status' ||
          endpoint === '/api/admin/manual-cleanup-specific' ||
          endpoint === '/api/admin/test-specific-listing-delete' ||
          endpoint === '/api/debug/test-admin-privileges' ||
          endpoint === '/api/admin/migrate-to-ttl' ||
          endpoint === '/api/listings/cleanup-related-data' ||
          endpoint === '/api/admin/test-ttl-archive' ||
          endpoint === '/api/cron/cleanup-ttl-listings' ||
          endpoint === '/api/admin/check-offers-status' ||
          endpoint === '/api/cron/cleanup-old-offers' ||
          endpoint === '/api/offers/expire-old') {
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
          <Card className="p-6 max-w-md mx-auto">
            <h1 className="text-2xl font-bold mb-4">Admin Authentication</h1>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="adminSecret">Admin Secret</Label>
                <Input
                  id="adminSecret"
                  type="password"
                  placeholder="Enter admin secret"
                  value={adminSecret}
                  onChange={(e) => setAdminSecret(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && adminSecret && !loading) {
                      verifyAdmin(adminSecret);
                    }
                  }}
                />
              </div>
              
              {authError && (
                <Alert className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
                  <AlertDescription className="text-red-800 dark:text-red-200">
                    {authError}
                  </AlertDescription>
                </Alert>
              )}
              
              <Button 
                onClick={() => verifyAdmin(adminSecret)}
                disabled={!adminSecret || loading}
                className="w-full"
              >
                {loading ? 'Verifying...' : 'Verify Admin Access'}
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

  const debugListings = async () => {
    setIsDebuggingListings(true);
    setListingsDebugResult('');
    try {
      const response = await fetch('/api/debug/compare-listings', {
        method: 'GET',
        headers: {
          'x-admin-secret': adminSecret
        }
      });

      const result = await response.json();
      
      if (response.ok) {
        setListingsDebugResult(JSON.stringify(result, null, 2));
      } else {
        setListingsDebugResult(`❌ Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Listings debug error:', error);
      setListingsDebugResult(`❌ Network error: ${error}`);
    } finally {
      setIsDebuggingListings(false);
    }
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
                    <MobileSelect
                      value={selectedTier}
                      onValueChange={setSelectedTier}
                      placeholder="Select tier"
                      options={[
                        { value: "free", label: "Free" },
                        { value: "premium", label: "Premium" }
                      ]}
                    />
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
                  
                  {/* Test Cleanup Archived - Debug Tool */}
                  <Card className="p-4">
                    <h3 className="font-semibold mb-2">Test Cleanup Analysis</h3>
                    <p className="text-sm text-muted-foreground mb-4">Analyze archived listings without deleting them</p>
                    <Button
                      onClick={() => handleApiCall('/api/admin/test-cleanup-archived')}
                      disabled={loading}
                      className="w-full"
                    >
                      {loading ? 'Analyzing...' : 'Analyze Archived Listings'}
                    </Button>
                  </Card>
                  
                  {/* Force Cleanup Archived - Actual Deletion */}
                  <Card className="p-4">
                    <h3 className="font-semibold mb-2">Force Cleanup Archived</h3>
                    <p className="text-sm text-muted-foreground mb-4">⚠️ Actually delete expired archived listings</p>
                    <Button
                      onClick={() => handleApiCall('/api/admin/force-cleanup-archived')}
                      disabled={loading}
                      className="w-full"
                    >
                      {loading ? 'Deleting...' : 'Force Delete Expired'}
                    </Button>
                  </Card>
                  
                  {/* Test Admin Privileges - Debug Tool */}
                  <Card className="p-4">
                    <h3 className="font-semibold mb-2">Test Admin Privileges</h3>
                    <p className="text-sm text-muted-foreground mb-4">Debug Firebase Admin SDK privileges and security rule bypass</p>
                    <Button
                      onClick={() => handleApiCall('/api/debug/test-admin-privileges')}
                      disabled={loading}
                      className="w-full"
                    >
                      {loading ? 'Testing...' : 'Test Admin SDK Privileges'}
                    </Button>
                  </Card>
                  
                  {/* Nuclear Cleanup Archived - Last Resort */}
                  <Card className="p-4">
                    <h3 className="font-semibold mb-2">Nuclear Cleanup Archived</h3>
                    <p className="text-sm text-muted-foreground mb-4">🚨 Last resort: Use transactions to bypass security rules</p>
                    <Button
                      onClick={() => handleApiCall('/api/admin/nuclear-cleanup-archived')}
                      disabled={loading}
                      className="w-full"
                    >
                      {loading ? 'Nuclear Cleanup...' : 'Nuclear Cleanup'}
                    </Button>
                  </Card>
                  
                  {/* Ultra Nuclear Cleanup Archived - Ultimate Last Resort */}
                  <Card className="p-4">
                    <h3 className="font-semibold mb-2">Ultra Nuclear Cleanup Archived</h3>
                    <p className="text-sm text-muted-foreground mb-4">💀 Ultimate last resort: Direct admin operations, no transactions</p>
                    <Button
                      onClick={() => handleApiCall('/api/admin/ultra-nuclear-cleanup-archived')}
                      disabled={loading}
                      className="w-full"
                    >
                      {loading ? 'Ultra Nuclear Cleanup...' : 'Ultra Nuclear Cleanup'}
                    </Button>
                  </Card>
                  
                  {/* Check Cleanup Status - Status Monitor */}
                  <Card className="p-4">
                    <h3 className="font-semibold mb-2">Check Cleanup Status</h3>
                    <p className="text-sm text-muted-foreground mb-4">📊 Monitor if automatic cleanup is working properly</p>
                    <Button
                      onClick={() => handleApiCall('/api/admin/check-cleanup-status')}
                      disabled={loading}
                      className="w-full"
                    >
                      {loading ? 'Checking Status...' : 'Check Cleanup Status'}
                    </Button>
                  </Card>
                  
                  {/* Manual Cleanup Specific - Fix Individual Listing */}
                  <Card className="p-4">
                    <h3 className="font-semibold mb-2">Fix Specific Expired Listing</h3>
                    <p className="text-sm text-muted-foreground mb-4">🎯 Manually delete the specific expired listing (NOlBNyOhmrqwr9QGHuze)</p>
                    <Button
                      onClick={() => handleApiCall('/api/admin/manual-cleanup-specific')}
                      disabled={loading}
                      className="w-full"
                    >
                      {loading ? 'Fixing Listing...' : 'Fix Expired Listing'}
                    </Button>
                  </Card>
                  
                  {/* Diagnostic Test for Specific Listing */}
                  <Card className="p-4">
                    <h3 className="font-semibold mb-2">Diagnostic Test - Specific Listing</h3>
                    <p className="text-sm text-muted-foreground mb-4">🔍 Run detailed diagnostic test on the problematic listing to understand the FAILED_PRECONDITION error</p>
                    <Button
                      onClick={() => handleApiCall('/api/admin/test-specific-listing-delete')}
                      disabled={loading}
                      className="w-full"
                    >
                      {loading ? 'Running Diagnostic...' : 'Run Diagnostic Test'}
                    </Button>
                  </Card>
                  
                  {/* TTL Migration */}
                  <Card className="p-4">
                    <h3 className="font-semibold mb-2">Migrate to TTL System</h3>
                    <p className="text-sm text-muted-foreground mb-4">🔄 Migrate existing archived listings to use Firestore TTL for automatic deletion</p>
                    <Button
                      onClick={() => handleApiCall('/api/admin/migrate-to-ttl')}
                      disabled={loading}
                      className="w-full"
                    >
                      {loading ? 'Migrating...' : 'Migrate to TTL'}
                    </Button>
                  </Card>
                  
                  {/* Related Data Cleanup */}
                  <Card className="p-4">
                    <h3 className="font-semibold mb-2">Cleanup Related Data</h3>
                    <p className="text-sm text-muted-foreground mb-4">🧹 Clean up orphaned favorites and offers after TTL deletion</p>
                    <Button
                      onClick={() => handleApiCall('/api/listings/cleanup-related-data')}
                      disabled={loading}
                      className="w-full"
                    >
                      {loading ? 'Cleaning...' : 'Cleanup Related Data'}
                    </Button>
                  </Card>
                  
                  {/* Test TTL Archive - 1 Minute Timer */}
                  <Card className="p-4">
                    <h3 className="font-semibold mb-2">Test TTL Archive (1 Minute)</h3>
                    <p className="text-sm text-muted-foreground mb-4">🧪 Archive a specific listing or random active listing with 1-minute TTL for testing automatic deletion</p>
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="testTtlListingId">Listing ID (Optional)</Label>
                        <Input
                          id="testTtlListingId"
                          placeholder="Enter specific listing ID or leave blank for random"
                          value={testTtlListingId}
                          onChange={(e) => setTestTtlListingId(e.target.value)}
                        />
                      </div>
                      <Button
                        onClick={async () => {
                          setLoading(true);
                          try {
                            let headers = {
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${adminSecret}`
                            };
                            
                            const body = testTtlListingId ? { listingId: testTtlListingId } : {};
                            
                            const response = await fetch('/api/admin/test-ttl-archive', {
                              method: 'POST',
                              headers,
                              body: JSON.stringify(body)
                            });
                            const data = await response.json();
                            setApiResponse(data);
                            setResponseDialog(true);
                            
                            // Clear the input on success
                            if (response.ok) {
                              setTestTtlListingId('');
                            }
                          } catch (error) {
                            setApiResponse({ error: 'Failed to execute TTL archive test' });
                            setResponseDialog(true);
                          }
                          setLoading(false);
                        }}
                        disabled={loading}
                        className="w-full"
                      >
                        {loading ? 'Archiving...' : 'Test 1-Minute TTL Archive'}
                      </Button>
                    </div>
                  </Card>
                  
                  {/* Manual TTL Cleanup */}
                  <Card className="p-4">
                    <h3 className="font-semibold mb-2">Manual TTL Cleanup</h3>
                    <p className="text-sm text-muted-foreground mb-4">🧹 Manually run the TTL cleanup process to delete expired listings (backup to Firestore TTL)</p>
                    <Button
                      onClick={() => handleApiCall('/api/cron/cleanup-ttl-listings')}
                      disabled={loading}
                      className="w-full"
                    >
                      {loading ? 'Cleaning up...' : 'Run TTL Cleanup'}
                    </Button>
                  </Card>
                  
                  {/* Check TTL Listing Status */}
                  <Card className="p-4">
                    <h3 className="font-semibold mb-2">Check TTL Listing Status</h3>
                    <p className="text-sm text-muted-foreground mb-4">🔍 Diagnose why a specific listing wasn't deleted by TTL policy</p>
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="checkTtlListingId">Listing ID</Label>
                        <Input
                          id="checkTtlListingId"
                          placeholder="Enter listing ID to check (e.g., hem67FELn6lyPPQinm3L)"
                          value={testTtlListingId}
                          onChange={(e) => setTestTtlListingId(e.target.value)}
                        />
                      </div>
                      <Button
                        onClick={async () => {
                          if (!testTtlListingId) {
                            setApiResponse({ error: 'Listing ID is required' });
                            setResponseDialog(true);
                            return;
                          }
                          setLoading(true);
                          try {
                            const response = await fetch(`/api/admin/check-ttl-listing?listingId=${testTtlListingId}`, {
                              method: 'GET',
                              headers: {
                                'Authorization': `Bearer ${adminSecret}`
                              }
                            });
                            const data = await response.json();
                            setApiResponse(data);
                            setResponseDialog(true);
                          } catch (error) {
                            setApiResponse({ error: 'Failed to check TTL listing status' });
                            setResponseDialog(true);
                          }
                          setLoading(false);
                        }}
                        disabled={loading || !testTtlListingId}
                        className="w-full"
                      >
                        {loading ? 'Checking...' : 'Check TTL Status'}
                      </Button>
                    </div>
                  </Card>
                  
                  {/* Check Offers Status */}
                  <Card className="p-4">
                    <h3 className="font-semibold mb-2">Check Current Offers Status</h3>
                    <p className="text-sm text-muted-foreground mb-4">📊 Analyze current offers in the system and TTL implementation status</p>
                    <Button
                      onClick={() => handleApiCall('/api/admin/check-offers-status')}
                      disabled={loading}
                      className="w-full"
                    >
                      {loading ? 'Analyzing...' : 'Analyze Current Offers'}
                    </Button>
                  </Card>
                  
                  {/* Manual Old Offers Cleanup */}
                  <Card className="p-4">
                    <h3 className="font-semibold mb-2">Manual Old Offers Cleanup</h3>
                    <p className="text-sm text-muted-foreground mb-4">🧹 Manually run cleanup for offers older than 30 days (keeps expired offers visible)</p>
                    <Button
                      onClick={() => handleApiCall('/api/cron/cleanup-old-offers')}
                      disabled={loading}
                      className="w-full"
                    >
                      {loading ? 'Cleaning up...' : 'Run Old Offers Cleanup'}
                    </Button>
                  </Card>
                  
                  {/* Manual Expire Old Offers */}
                  <Card className="p-4">
                    <h3 className="font-semibold mb-2">Manual Expire Old Offers</h3>
                    <p className="text-sm text-muted-foreground mb-4">⏰ Manually run the process to expire pending offers that have passed their expiration time</p>
                    <Button
                      onClick={() => handleApiCall('/api/offers/expire-old')}
                      disabled={loading}
                      className="w-full"
                    >
                      {loading ? 'Expiring...' : 'Expire Old Offers'}
                    </Button>
                  </Card>
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
                      className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
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

            {/* Dashboard Offer Debugger */}
            <AccordionItem value="dashboard-offer-debug" id="dashboard-offer-debug" ref={el => (sectionRefs.current["dashboard-offer-debug"] = el)}>
              <AccordionTrigger>Dashboard Offer Debugger</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 py-4">
                  <p className="text-sm text-muted-foreground">
                    Debug why offers are not appearing in the dashboard overview "Latest Offers" section. This tool replicates the exact same logic used in the dashboard overview to help identify discrepancies between the dashboard and offers page.
                  </p>
                  <DashboardOfferDebugger />
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
                      className="w-full"
                    >
                      Connection Debugger
                    </Button>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Account Tier Debugger */}
            <AccordionItem value="account-tier-debug" id="account-tier-debug" ref={el => (sectionRefs.current["account-tier-debug"] = el)}>
              <AccordionTrigger>Account Tier Debugger</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 py-4">
                  <p className="text-sm text-muted-foreground">
                    Test and debug the simplified account tier detection system. This tool allows you to test individual users, batch process multiple users, and manage the account tier cache for optimal performance.
                  </p>
                  <AccountTierDebugger />
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
                    className="w-full"
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
                      className="w-full"
                    >
                      Database Usage Monitor
                    </Button>
                    <Button 
                      onClick={() => router.push(`/admin/database-monitor`)}
                      className="w-full"
                    >
                      Real-time Database Monitor
                    </Button>
                    <Button 
                      onClick={() => router.push(`/admin/database-usage-audit`)}
                      className="w-full"
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
                    className="w-full"
                  >
                    Listing Analytics Dashboard
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Listing Debug Tool */}
            <AccordionItem value="listing-debug" id="listing-debug" ref={el => (sectionRefs.current["listing-debug"] = el)}>
              <AccordionTrigger>Listing Debug Tool</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 py-4">
                  <p className="text-sm text-muted-foreground">
                    Compare mock vs real listings, analyze status distribution, and debug why only mock listings might be showing on certain pages.
                  </p>
                  <Button 
                    onClick={debugListings}
                    disabled={isDebuggingListings}
                    className="w-full"
                  >
                    {isDebuggingListings ? 'Analyzing...' : 'Analyze Listings'}
                  </Button>
                  
                  {listingsDebugResult && (
                    <div className="mt-4">
                      <Label className="text-sm font-medium">Debug Results:</Label>
                      <ScrollArea className="max-h-[400px] mt-2">
                        <pre className="p-4 bg-muted rounded-lg overflow-x-auto text-xs">
                          {listingsDebugResult}
                        </pre>
                      </ScrollArea>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Listing Expiration Debugger */}
            <AccordionItem value="listing-expiration-debug" id="listing-expiration-debug" ref={el => (sectionRefs.current["listing-expiration-debug"] = el)}>
              <AccordionTrigger>Listing Expiration Debugger</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 py-4">
                  <p className="text-sm text-muted-foreground">
                    Debug and analyze listing expiration times to ensure they match the user's account tier. This tool can identify listings with incorrect expiration times and fix them automatically.
                  </p>
                  <ListingExpirationDebugger />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Listing Username Debugger */}
            <AccordionItem value="listing-username-debug" id="listing-username-debug" ref={el => (sectionRefs.current["listing-username-debug"] = el)}>
              <AccordionTrigger>Listing Username Debugger</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 py-4">
                  <p className="text-sm text-muted-foreground">
                    Diagnose and fix issues where user IDs are showing instead of usernames on listing cards. This tool can detect listings with user ID usernames and automatically fix them.
                  </p>
                  <ListingUsernameDebugger />
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
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    Review System Debug
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Review Username Migration */}
            <AccordionItem value="review-migration" id="review-migration" ref={el => (sectionRefs.current["review-migration"] = el)}>
              <AccordionTrigger>Review Username Migration</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 py-4">
                  <p className="text-sm text-muted-foreground">
                    Migrate existing reviews to store usernames and avatar URLs for deleted user handling. This will update reviews that don't have stored usernames and mark deleted users appropriately.
                  </p>
                  <Alert className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950">
                    <AlertDescription className="text-yellow-800 dark:text-yellow-200">
                      ⚠️ This operation will update all reviews in the database. It's safe to run multiple times but may take a while for large datasets.
                    </AlertDescription>
                  </Alert>
                  <Button 
                    onClick={async () => {
                      setLoading(true);
                      try {
                        const response = await fetch('/api/admin/migrate-review-usernames', {
                          method: 'POST',
                          headers: {
                            'x-admin-secret': adminSecret,
                            'Content-Type': 'application/json'
                          }
                        });
                        const data = await response.json();
                        setApiResponse(data);
                        setResponseDialog(true);
                      } catch (error) {
                        setApiResponse({ error: 'Failed to run review username migration' });
                        setResponseDialog(true);
                      }
                      setLoading(false);
                    }}
                    disabled={loading}
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    {loading ? 'Migrating Reviews...' : 'Migrate Review Usernames'}
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

            {/* Pickup Code Debugger */}
            <AccordionItem value="pickup-code-debug" id="pickup-code-debug" ref={el => (sectionRefs.current["pickup-code-debug"] = el)}>
              <AccordionTrigger>Pickup Code Debugger</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 py-4">
                  <p className="text-sm text-muted-foreground">
                    Debug and test the 6-digit pickup code system for local pickup orders. Generate codes, verify them, and inspect database storage.
                  </p>
                  <PickupCodeDebugger />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Production Username Debugger */}
            <AccordionItem value="production-username-debug" id="production-username-debug" ref={el => (sectionRefs.current["production-username-debug"] = el)}>
              <AccordionTrigger>Production Username Debugger</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 py-4">
                  <p className="text-sm text-muted-foreground">
                    Fix production listings that show user IDs instead of usernames. This tool directly accesses the production database to identify and fix username issues that affect the live marketplace.
                  </p>
                  <ProductionUsernameDebugger />
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
                        className="bg-primary hover:bg-primary/90 text-primary-foreground"
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
                        className="bg-primary hover:bg-primary/90 text-primary-foreground"
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
                        className="bg-primary hover:bg-primary/90 text-primary-foreground"
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
                        className="bg-secondary hover:bg-secondary/90 text-secondary-foreground"
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
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    Support Management Dashboard
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* TTL Field Validator */}
            <AccordionItem value="ttl-field-validator" id="ttl-field-validator" ref={el => (sectionRefs.current["ttl-field-validator"] = el)}>
              <AccordionTrigger>TTL Field Validator</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 py-4">
                  <p className="text-sm text-muted-foreground">
                    Validate and fix TTL field management across Firestore collections. This tool identifies fields set to null instead of using FieldValue.delete() and can automatically fix them to ensure proper TTL functionality.
                  </p>
                  <TTLFieldValidator />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Shipping Reminder System */}
            <AccordionItem value="shipping-reminders" id="shipping-reminders" ref={el => (sectionRefs.current["shipping-reminders"] = el)}>
              <AccordionTrigger>Shipping Reminder System</AccordionTrigger>
              <AccordionContent>
                <div className="py-4">
                  <ShippingReminderTester />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* User Account Migration */}
            <AccordionItem value="user-migration" id="user-migration" ref={el => (sectionRefs.current["user-migration"] = el)}>
              <AccordionTrigger>User Account Migration</AccordionTrigger>
              <AccordionContent>
                <div className="py-4">
                  <UserMigrationTool />
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

            {/* Fix Archived Listings Visibility */}
            <AccordionItem value="fix-archived-listings" id="fix-archived-listings" ref={el => (sectionRefs.current["fix-archived-listings"] = el)}>
              <AccordionTrigger>Fix Archived Listings Visibility</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 py-4">
                  <p className="text-sm text-muted-foreground">
                    Fix archived listings that are still showing on public pages. This tool ensures archived listings have proper TTL fields, correct timestamps, and are properly filtered from public views.
                  </p>
                  <Alert className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950">
                    <AlertDescription className="text-yellow-800 dark:text-yellow-200">
                      ⚠️ This tool will update archived listings to ensure they don't appear on public pages and have proper TTL for automatic deletion.
                    </AlertDescription>
                  </Alert>
                  <Button 
                    onClick={async () => {
                      setLoading(true);
                      try {
                        const response = await fetch('/api/debug/fix-archived-listings-visibility', {
                          method: 'POST',
                          headers: {
                            'Authorization': `Bearer ${adminSecret}`,
                            'Content-Type': 'application/json'
                          }
                        });
                        const data = await response.json();
                        setApiResponse(data);
                        setResponseDialog(true);
                      } catch (error) {
                        setApiResponse({ error: 'Failed to fix archived listings visibility' });
                        setResponseDialog(true);
                      }
                      setLoading(false);
                    }}
                    disabled={loading}
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    {loading ? 'Fixing Archived Listings...' : 'Fix Archived Listings Visibility'}
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Fix Specific Listing */}
            <AccordionItem value="fix-specific-listing" id="fix-specific-listing" ref={el => (sectionRefs.current["fix-specific-listing"] = el)}>
              <AccordionTrigger>Fix Specific Listing</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 py-4">
                  <p className="text-sm text-muted-foreground">
                    Analyze and fix a specific listing's expiration status. This tool can determine if a listing should be archived based on its creation date and account tier, or restore incorrectly archived premium listings.
                  </p>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="specificListingId">Listing ID</Label>
                      <Input
                        id="specificListingId"
                        placeholder="Enter listing ID to analyze and fix"
                        value={testTtlListingId}
                        onChange={(e) => setTestTtlListingId(e.target.value)}
                      />
                    </div>
                    <Button 
                      onClick={async () => {
                        if (!testTtlListingId) {
                          setApiResponse({ error: 'Listing ID is required' });
                          setResponseDialog(true);
                          return;
                        }
                        setLoading(true);
                        try {
                          const response = await fetch('/api/debug/fix-specific-listing', {
                            method: 'POST',
                            headers: {
                              'Authorization': `Bearer ${adminSecret}`,
                              'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                              listingId: testTtlListingId
                            })
                          });
                          const data = await response.json();
                          setApiResponse(data);
                          setResponseDialog(true);
                          
                          // Clear the input on success
                          if (response.ok) {
                            setTestTtlListingId('');
                          }
                        } catch (error) {
                          setApiResponse({ error: 'Failed to fix specific listing' });
                          setResponseDialog(true);
                        }
                        setLoading(false);
                      }}
                      disabled={loading || !testTtlListingId}
                      className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                      {loading ? 'Analyzing & Fixing...' : 'Analyze & Fix Listing'}
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p><strong>Archive:</strong> If listing should be expired but isn't archived</p>
                    <p><strong>Add TTL:</strong> If listing is archived but missing automatic deletion</p>
                    <p><strong>Restore:</strong> If premium user listing was incorrectly archived</p>
                  </div>
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