import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

export function NotificationDebugger() {
  const { user } = useAuth();
  const { notifications, unreadCount, isLoading } = useNotifications();
  const [testResult, setTestResult] = useState<any>(null);
  const [isTestingNotification, setIsTestingNotification] = useState(false);
  const [isTestingAPI, setIsTestingAPI] = useState(false);

  const testNotificationCreation = async () => {
    if (!user) return;

    setIsTestingNotification(true);
    setTestResult(null);

    try {
      const token = await user.getIdToken();
      
      const response = await fetch('/api/debug/test-notification-creation', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();
      setTestResult(result);
    } catch (error) {
      console.error('Error testing notification creation:', error);
      setTestResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsTestingNotification(false);
    }
  };

  const testNotificationAPI = async () => {
    if (!user) return;

    setIsTestingAPI(true);
    setTestResult(null);

    try {
      const response = await fetch('/api/notifications/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.uid,
          type: 'system',
          title: '🔧 API Test Notification',
          message: 'This notification was created directly via the API endpoint.',
          data: {
            actionUrl: '/dashboard/notifications'
          }
        })
      });

      const result = await response.json();
      setTestResult(result);
    } catch (error) {
      console.error('Error testing notification API:', error);
      setTestResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsTestingAPI(false);
    }
  };

  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Notification Debugger</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Please log in to test notifications.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification System Debugger</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current State */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-3 border rounded-lg">
            <p className="text-sm font-medium">Hook State</p>
            <p className="text-lg font-bold">{isLoading ? 'Loading...' : 'Loaded'}</p>
          </div>
          <div className="p-3 border rounded-lg">
            <p className="text-sm font-medium">Total Notifications</p>
            <p className="text-lg font-bold">{notifications.length}</p>
          </div>
          <div className="p-3 border rounded-lg">
            <p className="text-sm font-medium">Unread Count</p>
            <p className="text-lg font-bold">{unreadCount}</p>
          </div>
        </div>

        {/* Test Buttons */}
        <div className="flex gap-2">
          <Button 
            onClick={testNotificationCreation}
            disabled={isTestingNotification}
            variant="outline"
          >
            {isTestingNotification && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Test Service Creation
          </Button>
          <Button 
            onClick={testNotificationAPI}
            disabled={isTestingAPI}
            variant="outline"
          >
            {isTestingAPI && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Test API Creation
          </Button>
        </div>

        {/* Test Results */}
        {testResult && (
          <div className="p-4 border rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              {testResult.success ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-500" />
              )}
              <span className="font-medium">
                {testResult.success ? 'Test Successful' : 'Test Failed'}
              </span>
            </div>
            
            {testResult.success ? (
              <div className="space-y-2">
                {testResult.testNotificationId && (
                  <p className="text-sm">
                    <strong>Created Notification ID:</strong> {testResult.testNotificationId}
                  </p>
                )}
                {testResult.notificationId && (
                  <p className="text-sm">
                    <strong>Created Notification ID:</strong> {testResult.notificationId}
                  </p>
                )}
                {testResult.userNotificationsCount !== undefined && (
                  <p className="text-sm">
                    <strong>User Notifications Count:</strong> {testResult.userNotificationsCount}
                  </p>
                )}
                {testResult.unreadCount !== undefined && (
                  <p className="text-sm">
                    <strong>Unread Count:</strong> {testResult.unreadCount}
                  </p>
                )}
                {testResult.notifications && (
                  <div className="mt-2">
                    <p className="text-sm font-medium">Recent Notifications:</p>
                    <div className="space-y-1 mt-1">
                      {testResult.notifications.slice(0, 3).map((notification: any) => (
                        <div key={notification.id} className="text-xs p-2 bg-muted rounded">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {notification.type}
                            </Badge>
                            <span className={notification.read ? 'text-muted-foreground' : 'font-medium'}>
                              {notification.title}
                            </span>
                          </div>
                          <p className="text-muted-foreground mt-1">{notification.message}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-red-600">
                  <strong>Error:</strong> {testResult.error}
                </p>
                {testResult.details && (
                  <p className="text-xs text-muted-foreground">
                    <strong>Details:</strong> {testResult.details}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Current Notifications Preview */}
        {notifications.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Current Notifications (from hook):</p>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {notifications.slice(0, 5).map((notification) => (
                <div key={notification.id} className="text-xs p-2 bg-muted rounded">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {notification.type}
                    </Badge>
                    <span className={notification.read ? 'text-muted-foreground' : 'font-medium'}>
                      {notification.title}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-1">{notification.message}</p>
                  <p className="text-muted-foreground text-xs">
                    {notification.createdAt.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}