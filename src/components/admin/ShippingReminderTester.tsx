'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, Clock, Mail, Package, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ShippingReminderSummary {
  totalReminders: number;
  totalNotifications: number;
  totalErrors: number;
  processedOrders: string[];
  ordersChecked: number;
  reminderBreakdown: { [key: number]: number };
  timestamp: string;
}

interface ShippingReminderResponse {
  message: string;
  summary: ShippingReminderSummary;
  error?: string;
  details?: string;
}

export default function ShippingReminderTester() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ShippingReminderResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runShippingReminders = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/cron/shipping-reminders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_ADMIN_SECRET}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      setResult(data);
    } catch (err: any) {
      console.error('Error running shipping reminders:', err);
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const sendTestReminder = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/notifications/test-shipping-reminder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_ADMIN_SECRET}`
        },
        body: JSON.stringify({
          userEmail: 'admin@waboku.gg',
          userName: 'Test Seller',
          orderNumber: 'TEST123',
          orderId: 'test-order-id',
          buyerName: 'Test Buyer',
          listingTitle: 'Test Trading Card',
          orderAmount: 25.99,
          orderDate: new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }),
          hoursOverdue: 12,
          shippingAddress: 'Test User\n123 Test Street\nTest City, TS 12345\nUnited States'
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      setResult({
        message: data.message || 'Test shipping reminder email sent successfully',
        summary: {
          totalReminders: 1,
          totalNotifications: 1,
          totalErrors: 0,
          processedOrders: ['test-order-id'],
          ordersChecked: 1,
          reminderBreakdown: { 48: 1 },
          timestamp: new Date().toISOString()
        }
      });
    } catch (err: any) {
      console.error('Error sending test reminder:', err);
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Shipping Reminder System
        </CardTitle>
        <CardDescription>
          Test and manage the enhanced automated shipping reminder system that sends emails and notifications to sellers at 48h, 72h, and 96h intervals for unshipped orders.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={runShippingReminders}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            {isLoading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Mail className="h-4 w-4" />
            )}
            Run Shipping Reminders
          </Button>
          
          <Button
            onClick={sendTestReminder}
            disabled={isLoading}
            variant="outline"
            className="flex items-center gap-2"
          >
            {isLoading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Clock className="h-4 w-4" />
            )}
            Send Test Reminder
          </Button>
        </div>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Error:</strong> {error}
            </AlertDescription>
          </Alert>
        )}

        {/* Results Display */}
        {result && (
          <div className="space-y-4">
            <Separator />
            
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Results</h3>
              
              <Alert>
                <Package className="h-4 w-4" />
                <AlertDescription>
                  {result.message}
                </AlertDescription>
              </Alert>

              {result.summary && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {result.summary.totalReminders}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Email Reminders
                    </div>
                  </div>
                  
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-cyan-600">
                      {result.summary.totalNotifications || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Notifications
                    </div>
                  </div>
                  
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {result.summary.ordersChecked}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Orders Checked
                    </div>
                  </div>
                  
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-red-600">
                      {result.summary.totalErrors}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Errors
                    </div>
                  </div>
                  
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">
                      {result.summary.processedOrders.length}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Orders Processed
                    </div>
                  </div>
                </div>
              )}

              {result.summary?.reminderBreakdown && Object.keys(result.summary.reminderBreakdown).length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium">Reminder Breakdown by Interval:</h4>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(result.summary.reminderBreakdown).map(([interval, count]) => (
                      <Badge key={interval} variant="outline" className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {interval}h: {count}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {result.summary?.processedOrders && result.summary.processedOrders.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium">Processed Orders:</h4>
                  <div className="flex flex-wrap gap-2">
                    {result.summary.processedOrders.map((orderId) => (
                      <Badge key={orderId} variant="secondary">
                        {orderId}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {result.summary?.timestamp && (
                <div className="text-sm text-muted-foreground">
                  <strong>Completed at:</strong> {new Date(result.summary.timestamp).toLocaleString()}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Information */}
        <div className="space-y-3">
          <Separator />
          <div className="space-y-2">
            <h4 className="font-medium">Enhanced Features:</h4>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Multi-interval reminders: 48h, 72h, and 96h after order creation</li>
              <li>Dual notification system: Email reminders + in-app notifications</li>
              <li>Smart duplicate prevention: Avoids sending reminders within 6 hours</li>
              <li>Comprehensive order filtering: Excludes pickup orders and shipped items</li>
              <li>Detailed tracking: Records all reminder attempts with success/failure status</li>
              <li>Enhanced error handling: Continues processing even if individual emails fail</li>
            </ul>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-medium">Automation Schedule:</h4>
            <p className="text-sm text-muted-foreground">
              Runs automatically every 6 hours via Vercel cron jobs (00:00, 06:00, 12:00, 18:00 UTC). 
              The system intelligently determines which reminder interval each order qualifies for and ensures no spam by tracking previous reminders.
            </p>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-medium">Reminder Timeline:</h4>
            <div className="text-sm text-muted-foreground space-y-1">
              <p><strong>48 hours:</strong> First reminder - gentle nudge to ship the order</p>
              <p><strong>72 hours:</strong> Second reminder - more urgent tone</p>
              <p><strong>96 hours:</strong> Final reminder - warning about potential refund eligibility</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}