import React from 'react';
import { useRouter } from 'next/router';
import { formatDistanceToNow } from 'date-fns';
import { 
  CheckCheck, 
  MessageSquare, 
  DollarSign, 
  ShoppingCart, 
  Clock, 
  Package, 
  AlertCircle,
  Shield,
  Bell
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useNotifications } from '@/hooks/useNotifications';
import { Notification, NotificationType } from '@/types/notification';
import { cn } from '@/lib/utils';

interface NotificationListProps {
  onNotificationClick?: () => void;
}

export function NotificationList({ onNotificationClick }: NotificationListProps) {
  const router = useRouter();
  const { notifications, isLoading, markAsRead, markAllAsRead } = useNotifications();

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case 'sale':
        return <DollarSign className="h-4 w-4 text-green-500" />;
      case 'message':
        return <MessageSquare className="h-4 w-4 text-blue-500" />;
      case 'offer':
      case 'offer_accepted':
      case 'offer_declined':
        return <ShoppingCart className="h-4 w-4 text-orange-500" />;
      case 'listing_expired':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'order_update':
        return <Package className="h-4 w-4 text-purple-500" />;
      case 'system':
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
      case 'moderation':
        return <Shield className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read if not already read
    if (!notification.read) {
      await markAsRead(notification.id);
    }

    // Navigate to action URL if provided
    if (notification.data?.actionUrl) {
      router.push(notification.data.actionUrl);
    }

    // Close dropdown
    onNotificationClick?.();
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
  };

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Notifications</h3>
        </div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-start space-x-3 animate-pulse">
              <div className="w-8 h-8 bg-muted rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold">Notifications</h3>
        {notifications.some(n => !n.read) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMarkAllAsRead}
            className="text-xs"
          >
            <CheckCheck className="h-3 w-3 mr-1" />
            Mark all read
          </Button>
        )}
      </div>

      {/* Notifications List */}
      <ScrollArea className="h-96">
        {notifications.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No notifications yet</p>
            <p className="text-xs mt-1">We'll notify you when something happens!</p>
          </div>
        ) : (
          <div className="p-2">
            {notifications.map((notification, index) => (
              <div key={notification.id}>
                <button
                  onClick={() => handleNotificationClick(notification)}
                  className={cn(
                    "w-full text-left p-3 rounded-lg hover:bg-muted/50 transition-colors",
                    !notification.read && "bg-primary/10 border border-primary/20 dark:bg-primary/10 dark:border-primary/30"
                  )}
                >
                  <div className="flex items-start space-x-3">
                    {/* Icon */}
                    <div className="flex-shrink-0 mt-0.5">
                      {getNotificationIcon(notification.type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className={cn(
                            "text-sm font-medium",
                            !notification.read && "font-semibold"
                          )}>
                            {notification.title}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {notification.message}
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            {formatDistanceToNow(notification.createdAt, { addSuffix: true })}
                          </p>
                        </div>

                        {/* Unread indicator */}
                        {!notification.read && (
                          <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-2" />
                        )}
                      </div>
                    </div>
                  </div>
                </button>
                
                {index < notifications.length - 1 && (
                  <Separator className="my-1" />
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="border-t p-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              router.push('/dashboard/notifications');
              onNotificationClick?.();
            }}
            className="w-full text-xs"
          >
            View all notifications
          </Button>
        </div>
      )}
    </div>
  );
}