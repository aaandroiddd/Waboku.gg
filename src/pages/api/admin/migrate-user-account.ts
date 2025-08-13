import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { getDatabase } from 'firebase-admin/database';

interface MigrationRequest {
  currentUserId: string;
  newEmail: string;
  adminKey: string;
}

interface MigrationResult {
  success: boolean;
  newUserId?: string;
  migratedData?: {
    profile: boolean;
    listings: number;
    orders: number;
    messages: number;
    reviews: number;
    offers: number;
    favorites: number;
    wantedPosts: number;
  };
  errors?: string[];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MigrationResult>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, errors: ['Method not allowed'] });
  }

  try {
    const { currentUserId, newEmail, adminKey }: MigrationRequest = req.body;

    // Verify admin access
    if (adminKey !== process.env.ADMIN_SECRET) {
      return res.status(401).json({ success: false, errors: ['Unauthorized'] });
    }

    if (!currentUserId || !newEmail) {
      return res.status(400).json({ 
        success: false, 
        errors: ['Current user ID and new email are required'] 
      });
    }

    const errors: string[] = [];
    const migratedData = {
      profile: false,
      listings: 0,
      orders: 0,
      messages: 0,
      reviews: 0,
      offers: 0,
      favorites: 0,
      wantedPosts: 0
    };

    // Initialize Firebase Admin
    const { auth: adminAuth, db: adminDb } = getFirebaseAdmin();

    // Step 1: Get current user data
    const currentUserDoc = await adminDb.collection('users').doc(currentUserId).get();
    if (!currentUserDoc.exists) {
      return res.status(404).json({ 
        success: false, 
        errors: ['Current user not found'] 
      });
    }

    const currentUserData = currentUserDoc.data();

    // Step 2: Create new Firebase Auth user
    let newUserId: string;
    try {
      const newUserRecord = await adminAuth.createUser({
        email: newEmail,
        emailVerified: true,
        displayName: currentUserData?.displayName || currentUserData?.username,
      });
      newUserId = newUserRecord.uid;
    } catch (error: any) {
      return res.status(400).json({ 
        success: false, 
        errors: [`Failed to create new user: ${error.message}`] 
      });
    }

    // Step 3: Migrate user profile
    try {
      const newUserData = {
        ...currentUserData,
        email: newEmail,
        authMethods: ['password'], // New account will use email/password
        migratedFrom: currentUserId,
        migratedAt: new Date().toISOString(),
      };
      
      await adminDb.collection('users').doc(newUserId).set(newUserData);
      migratedData.profile = true;
    } catch (error: any) {
      errors.push(`Profile migration failed: ${error.message}`);
    }

    // Step 4: Migrate listings
    try {
      const listingsSnapshot = await adminDb
        .collection('listings')
        .where('userId', '==', currentUserId)
        .get();

      const batch = adminDb.batch();
      listingsSnapshot.docs.forEach(doc => {
        const listingData = doc.data();
        batch.update(doc.ref, { 
          userId: newUserId,
          migratedFrom: currentUserId 
        });
      });
      
      await batch.commit();
      migratedData.listings = listingsSnapshot.size;
    } catch (error: any) {
      errors.push(`Listings migration failed: ${error.message}`);
    }

    // Step 5: Migrate orders (as buyer and seller)
    try {
      const ordersSnapshot = await adminDb
        .collection('orders')
        .where('buyerId', '==', currentUserId)
        .get();

      const sellerOrdersSnapshot = await adminDb
        .collection('orders')
        .where('sellerId', '==', currentUserId)
        .get();

      const batch = adminDb.batch();
      
      ordersSnapshot.docs.forEach(doc => {
        batch.update(doc.ref, { buyerId: newUserId });
      });
      
      sellerOrdersSnapshot.docs.forEach(doc => {
        batch.update(doc.ref, { sellerId: newUserId });
      });
      
      await batch.commit();
      migratedData.orders = ordersSnapshot.size + sellerOrdersSnapshot.size;
    } catch (error: any) {
      errors.push(`Orders migration failed: ${error.message}`);
    }

    // Step 6: Migrate reviews
    try {
      const reviewsSnapshot = await adminDb
        .collection('reviews')
        .where('userId', '==', currentUserId)
        .get();

      const sellerReviewsSnapshot = await adminDb
        .collection('reviews')
        .where('sellerId', '==', currentUserId)
        .get();

      const batch = adminDb.batch();
      
      reviewsSnapshot.docs.forEach(doc => {
        batch.update(doc.ref, { userId: newUserId });
      });
      
      sellerReviewsSnapshot.docs.forEach(doc => {
        batch.update(doc.ref, { sellerId: newUserId });
      });
      
      await batch.commit();
      migratedData.reviews = reviewsSnapshot.size + sellerReviewsSnapshot.size;
    } catch (error: any) {
      errors.push(`Reviews migration failed: ${error.message}`);
    }

    // Step 7: Migrate offers
    try {
      const offersSnapshot = await adminDb
        .collection('offers')
        .where('buyerId', '==', currentUserId)
        .get();

      const sellerOffersSnapshot = await adminDb
        .collection('offers')
        .where('sellerId', '==', currentUserId)
        .get();

      const batch = adminDb.batch();
      
      offersSnapshot.docs.forEach(doc => {
        batch.update(doc.ref, { buyerId: newUserId });
      });
      
      sellerOffersSnapshot.docs.forEach(doc => {
        batch.update(doc.ref, { sellerId: newUserId });
      });
      
      await batch.commit();
      migratedData.offers = offersSnapshot.size + sellerOffersSnapshot.size;
    } catch (error: any) {
      errors.push(`Offers migration failed: ${error.message}`);
    }

    // Step 8: Migrate favorites
    try {
      const favoritesSnapshot = await adminDb
        .collection('favorites')
        .where('userId', '==', currentUserId)
        .get();

      const batch = adminDb.batch();
      favoritesSnapshot.docs.forEach(doc => {
        batch.update(doc.ref, { userId: newUserId });
      });
      
      await batch.commit();
      migratedData.favorites = favoritesSnapshot.size;
    } catch (error: any) {
      errors.push(`Favorites migration failed: ${error.message}`);
    }

    // Step 9: Migrate wanted posts
    try {
      const wantedPostsSnapshot = await adminDb
        .collection('wantedPosts')
        .where('userId', '==', currentUserId)
        .get();

      const batch = adminDb.batch();
      wantedPostsSnapshot.docs.forEach(doc => {
        batch.update(doc.ref, { userId: newUserId });
      });
      
      await batch.commit();
      migratedData.wantedPosts = wantedPostsSnapshot.size;
    } catch (error: any) {
      errors.push(`Wanted posts migration failed: ${error.message}`);
    }

    // Step 10: Migrate message threads (Realtime Database)
    try {
      const rtdb = getDatabase();
      
      // Get user's message threads
      const userThreadsRef = rtdb.ref(`users/${currentUserId}/messageThreads`);
      const userThreadsSnapshot = await userThreadsRef.once('value');
      const userThreads = userThreadsSnapshot.val() || {};

      // Migrate user thread references
      if (Object.keys(userThreads).length > 0) {
        await rtdb.ref(`users/${newUserId}/messageThreads`).set(userThreads);
        
        // Update thread participants
        for (const chatId of Object.keys(userThreads)) {
          const threadRef = rtdb.ref(`messageThreads/${chatId}`);
          const threadSnapshot = await threadRef.once('value');
          const threadData = threadSnapshot.val();
          
          if (threadData && threadData.participants) {
            const updatedParticipants = threadData.participants.map((p: string) => 
              p === currentUserId ? newUserId : p
            );
            await threadRef.child('participants').set(updatedParticipants);
          }

          // Update messages in the thread
          const messagesRef = rtdb.ref(`messageThreads/${chatId}/messages`);
          const messagesSnapshot = await messagesRef.once('value');
          const messages = messagesSnapshot.val() || {};
          
          for (const messageId of Object.keys(messages)) {
            if (messages[messageId].senderId === currentUserId) {
              await messagesRef.child(`${messageId}/senderId`).set(newUserId);
            }
          }
        }
        
        migratedData.messages = Object.keys(userThreads).length;
      }
    } catch (error: any) {
      errors.push(`Messages migration failed: ${error.message}`);
    }

    // Step 11: Create migration log
    try {
      await adminDb.collection('migrations').add({
        fromUserId: currentUserId,
        toUserId: newUserId,
        fromEmail: currentUserData?.email,
        toEmail: newEmail,
        migratedData,
        errors,
        timestamp: new Date().toISOString(),
        status: errors.length === 0 ? 'completed' : 'partial'
      });
    } catch (error: any) {
      console.error('Failed to create migration log:', error);
    }

    return res.status(200).json({
      success: errors.length === 0,
      newUserId,
      migratedData,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error: any) {
    console.error('Migration error:', error);
    return res.status(500).json({
      success: false,
      errors: [`Migration failed: ${error.message}`]
    });
  }
}