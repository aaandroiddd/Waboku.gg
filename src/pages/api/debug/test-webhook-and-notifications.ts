import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { notificationService } from '@/lib/notification-service';
import { emailService } from '@/lib/email-service';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { testType, userId, listingId } = req.body;

    // Initialize Firebase Admin
    getFirebaseAdmin();
    const db = getFirestore();

    const results: any = {
      testType,
      timestamp: new Date().toISOString(),
      tests: {}
    };

    switch (testType) {
      case 'webhook_simulation': {
        // Test 1: Simulate a webhook event for order creation
        results.tests.webhookSimulation = {
          description: 'Simulating webhook order creation process'
        };

        try {
          // Get test user data
          const userDoc = await db.collection('users').doc(userId).get();
          if (!userDoc.exists) {
            throw new Error('Test user not found');
          }
          const userData = userDoc.data();

          // Get test listing data
          let listingData = null;
          if (listingId) {
            const listingDoc = await db.collection('listings').doc(listingId).get();
            if (listingDoc.exists) {
              listingData = listingDoc.data();
            }
          }

          // Create a mock order
          const mockOrderData = {
            listingId: listingId || 'test-listing-id',
            buyerId: userId,
            sellerId: 'test-seller-id',
            status: 'awaiting_shipping',
            amount: 100.00,
            platformFee: 10.00,
            paymentSessionId: 'test-session-id',
            paymentIntentId: 'test-payment-intent-id',
            paymentStatus: 'paid',
            createdAt: new Date(),
            updatedAt: new Date(),
            listingSnapshot: {
              title: listingData?.title || 'Test Trading Card',
              price: listingData?.price || 100.00,
              imageUrl: listingData?.imageUrls?.[0] || null
            },
            shippingAddress: {
              name: 'Test User',
              line1: '123 Test St',
              city: 'Test City',
              state: 'CA',
              postal_code: '12345',
              country: 'US'
            }
          };

          // Create the order
          const orderRef = await db.collection('orders').add(mockOrderData);
          results.tests.webhookSimulation.orderId = orderRef.id;
          results.tests.webhookSimulation.orderCreated = true;

          // Test notification creation
          try {
            const notificationId = await notificationService.createNotification({
              userId: userId,
              type: 'order_update',
              title: '🛒 Test Order Confirmed!',
              message: `Your test order for "${mockOrderData.listingSnapshot.title}" has been confirmed and is awaiting shipment.`,
              data: {
                orderId: orderRef.id,
                actionUrl: `/dashboard/orders/${orderRef.id}`
              }
            });

            results.tests.webhookSimulation.notificationId = notificationId;
            results.tests.webhookSimulation.notificationCreated = true;
          } catch (notificationError) {
            results.tests.webhookSimulation.notificationError = {
              message: notificationError instanceof Error ? notificationError.message : 'Unknown error',
              stack: notificationError instanceof Error ? notificationError.stack : null
            };
            results.tests.webhookSimulation.notificationCreated = false;
          }

          // Test email sending
          try {
            if (userData.email) {
              await emailService.sendOrderConfirmationEmail({
                userName: userData.displayName || userData.username || 'User',
                userEmail: userData.email,
                orderNumber: orderRef.id.substring(0, 8).toUpperCase(),
                orderDate: new Date().toLocaleDateString(),
                cardName: mockOrderData.listingSnapshot.title,
                setName: 'Test Set',
                condition: 'Near Mint',
                quantity: 1,
                price: (mockOrderData.amount - mockOrderData.platformFee).toFixed(2),
                sellerName: 'Test Seller',
                sellerLocation: 'Test Location',
                subtotal: (mockOrderData.amount - mockOrderData.platformFee).toFixed(2),
                shipping: '0.00',
                fee: mockOrderData.platformFee.toFixed(2),
                total: mockOrderData.amount.toFixed(2),
                shippingAddress: `${mockOrderData.shippingAddress.name}\n${mockOrderData.shippingAddress.line1}\n${mockOrderData.shippingAddress.city}, ${mockOrderData.shippingAddress.state} ${mockOrderData.shippingAddress.postal_code}`,
                orderId: orderRef.id
              });

              results.tests.webhookSimulation.emailSent = true;
            } else {
              results.tests.webhookSimulation.emailSent = false;
              results.tests.webhookSimulation.emailError = 'No email address found for user';
            }
          } catch (emailError) {
            results.tests.webhookSimulation.emailError = {
              message: emailError instanceof Error ? emailError.message : 'Unknown error',
              stack: emailError instanceof Error ? emailError.stack : null
            };
            results.tests.webhookSimulation.emailSent = false;
          }

          // Clean up test order
          await orderRef.delete();
          results.tests.webhookSimulation.orderCleaned = true;

        } catch (error) {
          results.tests.webhookSimulation.error = {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : null
          };
        }
        break;
      }

      case 'notification_system': {
        // Test 2: Test notification system directly
        results.tests.notificationSystem = {
          description: 'Testing notification system components'
        };

        try {
          // Test Firebase Admin initialization
          const { admin, db: adminDb } = getFirebaseAdmin();
          results.tests.notificationSystem.firebaseAdminInitialized = !!admin;
          results.tests.notificationSystem.firestoreInitialized = !!adminDb;

          // Test notification creation
          const testNotificationId = await notificationService.createNotification({
            userId: userId,
            type: 'system',
            title: '🧪 Test Notification',
            message: 'This is a test notification to verify the system is working.',
            data: {
              actionUrl: '/dashboard'
            }
          });

          results.tests.notificationSystem.notificationId = testNotificationId;
          results.tests.notificationSystem.notificationCreated = true;

          // Test notification retrieval
          const notifications = await notificationService.getUserNotifications(userId, 5);
          results.tests.notificationSystem.notificationsRetrieved = notifications.length;
          results.tests.notificationSystem.latestNotification = notifications[0] || null;

          // Test unread count
          const unreadCount = await notificationService.getUnreadCount(userId);
          results.tests.notificationSystem.unreadCount = unreadCount;

          // Clean up test notification
          if (testNotificationId) {
            await notificationService.deleteNotification(testNotificationId);
            results.tests.notificationSystem.notificationCleaned = true;
          }

        } catch (error) {
          results.tests.notificationSystem.error = {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : null
          };
        }
        break;
      }

      case 'message_notification': {
        // Test 3: Test message notification creation
        results.tests.messageNotification = {
          description: 'Testing message notification creation'
        };

        try {
          // Create a test message notification
          const messageNotificationId = await notificationService.createNotification({
            userId: userId,
            type: 'message',
            title: '💬 Test Message',
            message: 'Test User sent you a message',
            data: {
              messageThreadId: 'test-thread-id',
              actionUrl: '/dashboard/messages'
            }
          });

          results.tests.messageNotification.notificationId = messageNotificationId;
          results.tests.messageNotification.notificationCreated = true;

          // Test email notification
          const userDoc = await db.collection('users').doc(userId).get();
          const userData = userDoc.data();

          if (userData?.email) {
            try {
              await emailService.sendEmailNotification({
                userId: userId,
                userEmail: userData.email,
                userName: userData.displayName || userData.username || 'User',
                type: 'message',
                title: '💬 Test Message',
                message: 'Test User sent you a message',
                actionUrl: '/dashboard/messages',
                data: {
                  messageThreadId: 'test-thread-id'
                }
              });

              results.tests.messageNotification.emailSent = true;
            } catch (emailError) {
              results.tests.messageNotification.emailError = {
                message: emailError instanceof Error ? emailError.message : 'Unknown error'
              };
              results.tests.messageNotification.emailSent = false;
            }
          }

          // Clean up
          if (messageNotificationId) {
            await notificationService.deleteNotification(messageNotificationId);
            results.tests.messageNotification.notificationCleaned = true;
          }

        } catch (error) {
          results.tests.messageNotification.error = {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : null
          };
        }
        break;
      }

      case 'unread_context_test': {
        // Test 4: Test UnreadContext functionality
        results.tests.unreadContextTest = {
          description: 'Testing UnreadContext data sources'
        };

        try {
          // Check for unread notifications
          const unreadNotifications = await db.collection('notifications')
            .where('userId', '==', userId)
            .where('read', '==', false)
            .where('deleted', '!=', true)
            .get();

          results.tests.unreadContextTest.unreadNotifications = unreadNotifications.size;

          // Check for unread offers
          const unreadOffers = await db.collection('offers')
            .where('sellerId', '==', userId)
            .where('status', '==', 'pending')
            .where('cleared', '==', false)
            .get();

          results.tests.unreadContextTest.unreadOffers = unreadOffers.size;

          // Check for unread orders (new orders as seller)
          const newOrders = await db.collection('orders')
            .where('sellerId', '==', userId)
            .where('sellerRead', '==', false)
            .get();

          results.tests.unreadContextTest.newOrdersAsSeller = newOrders.size;

          // Check for unread orders (updated orders as buyer)
          const updatedOrders = await db.collection('orders')
            .where('buyerId', '==', userId)
            .where('buyerRead', '==', false)
            .get();

          results.tests.unreadContextTest.updatedOrdersAsBuyer = updatedOrders.size;

          // Check for unshipped orders (as buyer)
          const unshippedOrders = await db.collection('orders')
            .where('buyerId', '==', userId)
            .where('status', 'in', ['paid', 'awaiting_shipping'])
            .get();

          results.tests.unreadContextTest.unshippedOrdersAsBuyer = unshippedOrders.size;

          // Check message threads (would need to check Firebase Realtime Database)
          results.tests.unreadContextTest.messageThreadsNote = 'Message threads are in Realtime Database, not checked in this test';

        } catch (error) {
          results.tests.unreadContextTest.error = {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : null
          };
        }
        break;
      }

      default:
        return res.status(400).json({ error: 'Invalid test type' });
    }

    return res.status(200).json(results);

  } catch (error) {
    console.error('Error in webhook and notifications test:', error);
    return res.status(500).json({
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : null
    });
  }
}