import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { parseListingUrl, getGameSlug } from '@/lib/listing-slug';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { path } = req.query;

    if (!path || typeof path !== 'string') {
      return res.status(400).json({ error: 'Path parameter is required' });
    }

    // Parse the URL to extract components
    const parsed = parseListingUrl(path);
    if (!parsed) {
      return res.status(400).json({ error: 'Invalid listing URL format' });
    }

    const { gameSlug, titleSlug, listingId: shortId } = parsed;

    // Initialize Firebase Admin
    const { admin, db } = getFirebaseAdmin();
    if (!admin || !db) {
      throw new Error('Firebase Admin not initialized');
    }

    // Query for listings that start with the short ID
    const listingsRef = db.collection('listings');
    const query = listingsRef
      .where('__name__', '>=', shortId)
      .where('__name__', '<', shortId + '\uf8ff')
      .limit(10);

    const snapshot = await query.get();
    
    if (snapshot.empty) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    // Find the exact match
    let foundListing = null;
    snapshot.forEach((doc) => {
      if (doc.id.startsWith(shortId)) {
        foundListing = {
          id: doc.id,
          ...doc.data()
        };
      }
    });

    if (!foundListing) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    // Validate game category matches
    const actualGameSlug = getGameSlug(foundListing.game);
    if (actualGameSlug !== gameSlug) {
      // Return the correct URL for redirect
      const { generateListingUrl } = await import('@/lib/listing-slug');
      const correctUrl = generateListingUrl(foundListing.title, foundListing.game, foundListing.id);
      
      return res.status(301).json({ 
        error: 'Incorrect game category',
        redirectUrl: correctUrl
      });
    }

    // Check if listing is active
    if (foundListing.status === 'archived' || foundListing.archivedAt) {
      return res.status(404).json({ error: 'Listing is no longer available' });
    }

    // Return the full listing data
    return res.status(200).json({
      success: true,
      listing: foundListing
    });

  } catch (error: any) {
    console.error('Error resolving listing slug:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}