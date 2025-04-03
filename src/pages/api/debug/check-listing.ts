import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseServices } from '@/lib/firebase';
import { doc, getDoc, collection, getDocs, limit, query } from 'firebase/firestore';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { GAME_NAME_MAPPING } from '@/lib/game-mappings';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Check if we're in admin mode to check collections
    const adminMode = req.query.admin === 'true';
    const adminSecret = req.headers['x-admin-secret'];
    
    if (adminMode) {
      if (adminSecret !== process.env.ADMIN_SECRET) {
        console.error('Invalid admin secret provided');
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      // Initialize Firebase Admin
      getFirebaseAdmin();
      const firestoreDb = getFirestore();

      // Check if the orders collection exists and list all collections
      const collections = await firestoreDb.listCollections();
      const collectionNames = collections.map(col => col.id);

      // Check if orders collection exists
      const ordersExists = collectionNames.includes('orders');

      // Try to get a count of orders
      let orderCount = 0;
      let orders = [];
      if (ordersExists) {
        const ordersSnapshot = await firestoreDb.collection('orders').limit(10).get();
        orderCount = ordersSnapshot.size;
        orders = ordersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() ? doc.data().createdAt.toDate().toISOString() : doc.data().createdAt,
        }));
      }

      // Try to create a test document to verify write permissions
      let writeTest = { success: false, error: null };
      try {
        const testRef = firestoreDb.collection('_test_connection').doc('test');
        await testRef.set({ timestamp: new Date() });
        writeTest.success = true;
        await testRef.delete();
      } catch (writeError) {
        writeTest.error = writeError instanceof Error ? writeError.message : String(writeError);
      }

      return res.status(200).json({
        collections: collectionNames,
        ordersCollectionExists: ordersExists,
        orderCount,
        orders,
        writeTest,
        timestamp: new Date().toISOString()
      });
    }
    
    // Regular listing check mode
    const { id } = req.query;
    
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Listing ID is required' });
    }
    
    // Initialize Firebase
    const { db } = await getFirebaseServices();
    if (!db) {
      return res.status(500).json({ error: 'Firebase database not initialized' });
    }
    
    // Get the listing document
    const listingRef = doc(db, 'listings', id);
    const listingSnap = await getDoc(listingRef);
    
    if (!listingSnap.exists()) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    
    // Get the listing data
    const data = listingSnap.data();
    
    // Format dates for better readability
    const formattedData = {
      ...data,
      id: listingSnap.id,
      createdAt: data.createdAt?.toDate?.() ? data.createdAt.toDate().toISOString() : data.createdAt,
      expiresAt: data.expiresAt?.toDate?.() ? data.expiresAt.toDate().toISOString() : data.expiresAt,
      archivedAt: data.archivedAt?.toDate?.() ? data.archivedAt.toDate().toISOString() : data.archivedAt,
      updatedAt: data.updatedAt?.toDate?.() ? data.updatedAt.toDate().toISOString() : data.updatedAt,
    };
    
    // Check game matching if game parameter is provided
    const { game } = req.query;
    let gameMatchingInfo = null;
    
    if (game && typeof game === 'string') {
      const listingGameLower = (data.game?.toLowerCase() || '').trim();
      const matchesGame = GAME_NAME_MAPPING[game]?.some(name => 
        listingGameLower === name.toLowerCase().trim()
      ) || false;
      
      gameMatchingInfo = {
        listingGame: data.game,
        listingGameLower,
        selectedGame: game,
        mappedNames: GAME_NAME_MAPPING[game],
        matches: matchesGame
      };
    }
    
    // Return the listing data with game matching info if available
    return res.status(200).json({
      listing: formattedData,
      gameMatching: gameMatchingInfo,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error checking listing:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}