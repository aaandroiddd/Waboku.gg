export type NotificationType = 
  | 'sale' 
  | 'message' 
  | 'offer' 
  | 'offer_accepted'
  | 'offer_declined'
  | 'listing_expired' 
  | 'order_update' 
  | 'system'
  | 'moderation';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: {
    listingId?: string;
    orderId?: string;
    offerId?: string;
    messageThreadId?: string;
    actionUrl?: string;
    [key: string]: any;
  };
  read: boolean;
  createdAt: Date;
  updatedAt?: Date;
}

export interface NotificationPreferences {
  userId: string;
  email: {
    sales: boolean;
    messages: boolean;
    offers: boolean;
    orderUpdates: boolean;
    listingUpdates: boolean;
    marketing: boolean;
    system: boolean;
  };
  push: {
    sales: boolean;
    messages: boolean;
    offers: boolean;
    orderUpdates: boolean;
    listingUpdates: boolean;
    system: boolean;
  };
  updatedAt: Date;
}

export interface CreateNotificationData {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Notification['data'];
}