import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getDatabase } from 'firebase-admin/database';
import { initAdmin } from '@/lib/firebase-admin';
import Stripe from 'stripe';

// Initialize Firebase Admin
const admin = initAdmin();
const db = getFirestore();
const realtimeDb = getDatabase();
const auth = getAuth();

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  // Get the authorization token
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const token = authHeader.split('Bearer ')[1];
  
  try {
    // Verify the token and get the user
    const decodedToken = await auth.verifyIdToken(token);
    const userId = decodedToken.uid;
    
    console.log(`Starting account deletion process for user: ${userId}`);
    
    // 1. Get user profile to check for subscription
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      console.log(`User profile not found for ${userId}, continuing with deletion`);
    } else {
      const userData = userDoc.data();
      
      // 2. Cancel Stripe subscription if it exists
      if (userData?.subscription?.stripeSubscriptionId) {
        try {
          console.log(`Canceling subscription: ${userData.subscription.stripeSubscriptionId}`);
          await stripe.subscriptions.cancel(userData.subscription.stripeSubscriptionId);
          console.log('Subscription canceled successfully');
        } catch (stripeError) {
          console.error('Error canceling subscription:', stripeError);
          // Continue with deletion even if subscription cancellation fails
        }
      }
    }
    
    // 3. Delete username documents
    try {
      const usernamesSnapshot = await db.collection('usernames')
        .where('uid', '==', userId)
        .get();
      
      console.log(`Found ${usernamesSnapshot.size} username documents to delete`);
      
      const usernameDeletePromises = usernamesSnapshot.docs.map(doc => 
        db.collection('usernames').doc(doc.id).delete()
      );
      
      await Promise.all(usernameDeletePromises);
      console.log('Username documents deleted successfully');
    } catch (usernameError) {
      console.error('Error deleting username documents:', usernameError);
      // Continue with other deletions
    }
    
    // 4. Delete user's favorites
    try {
      const favoritesSnapshot = await db.collection('users')
        .doc(userId)
        .collection('favorites')
        .get();
      
      console.log(`Found ${favoritesSnapshot.size} favorites to delete`);
      
      const favoriteDeletePromises = favoritesSnapshot.docs.map(doc => 
        db.collection('users').doc(userId).collection('favorites').doc(doc.id).delete()
      );
      
      await Promise.all(favoriteDeletePromises);
      console.log('Favorites deleted successfully');
    } catch (favoritesError) {
      console.error('Error deleting favorites:', favoritesError);
      // Continue with other deletions
    }
    
    // 5. Delete user's messages from Realtime Database
    try {
      // Get all chats where user is a participant
      const chatsSnapshot = await realtimeDb.ref('chats').once('value');
      const chatsData = chatsSnapshot.val() || {};
      
      const userChatIds = Object.entries(chatsData)
        .filter(([_, chat]: [string, any]) => chat.participants && chat.participants[userId])
        .map(([chatId]) => chatId);
      
      console.log(`Found ${userChatIds.length} chats to process`);
      
      // For each chat, either delete it completely or mark as deleted by this user
      for (const chatId of userChatIds) {
        const chatData = chatsData[chatId];
        const participants = Object.keys(chatData.participants || {});
        
        if (participants.length <= 2) {
          // Delete the entire chat and its messages
          console.log(`Deleting entire chat: ${chatId}`);
          await realtimeDb.ref(`chats/${chatId}`).remove();
          await realtimeDb.ref(`messages/${chatId}`).remove();
        } else {
          // Mark as deleted for current user and remove from participants
          console.log(`Marking chat ${chatId} as deleted for user ${userId}`);
          const updates: Record<string, any> = {};
          updates[`chats/${chatId}/deletedBy/${userId}`] = true;
          updates[`chats/${chatId}/participants/${userId}`] = null;
          await realtimeDb.ref().update(updates);
        }
      }
      
      console.log('Chat cleanup completed successfully');
    } catch (messagesError) {
      console.error('Error cleaning up messages:', messagesError);
      // Continue with other deletions
    }
    
    // 6. Delete user's orders
    try {
      // Delete orders where user is buyer
      const buyerOrdersSnapshot = await db.collection('orders')
        .where('buyerId', '==', userId)
        .get();
      
      // Delete orders where user is seller
      const sellerOrdersSnapshot = await db.collection('orders')
        .where('sellerId', '==', userId)
        .get();
      
      console.log(`Found ${buyerOrdersSnapshot.size} buyer orders and ${sellerOrdersSnapshot.size} seller orders to delete`);
      
      const orderDeletePromises = [
        ...buyerOrdersSnapshot.docs.map(doc => db.collection('orders').doc(doc.id).delete()),
        ...sellerOrdersSnapshot.docs.map(doc => db.collection('orders').doc(doc.id).delete())
      ];
      
      await Promise.all(orderDeletePromises);
      console.log('Orders deleted successfully');
    } catch (ordersError) {
      console.error('Error deleting orders:', ordersError);
      // Continue with other deletions
    }
    
    // 7. Delete user's listings
    try {
      const listingsSnapshot = await db.collection('listings')
        .where('userId', '==', userId)
        .get();
      
      console.log(`Found ${listingsSnapshot.size} listings to delete`);
      
      const listingDeletePromises = listingsSnapshot.docs.map(doc => 
        db.collection('listings').doc(doc.id).delete()
      );
      
      await Promise.all(listingDeletePromises);
      console.log('Listings deleted successfully');
    } catch (listingsError) {
      console.error('Error deleting listings:', listingsError);
      // Continue with other deletions
    }
    
    // 8. Delete user profile
    try {
      await db.collection('users').doc(userId).delete();
      console.log('User profile deleted successfully');
    } catch (profileError) {
      console.error('Error deleting user profile:', profileError);
      // Continue with auth deletion
    }
    
    // 9. Delete user authentication
    try {
      await auth.deleteUser(userId);
      console.log('User authentication deleted successfully');
    } catch (authError) {
      console.error('Error deleting user authentication:', authError);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to delete user authentication. Please try again.' 
      });
    }
    
    return res.status(200).json({ success: true, message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Error in delete account process:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to delete account data. Please try again.' 
    });
  }
}