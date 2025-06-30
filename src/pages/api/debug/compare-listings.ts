import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify admin access
    const adminSecret = req.headers['x-admin-secret'] as string;
    if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { db } = getFirebaseAdmin();
    const listingsRef = db.collection('listings');
    
    // Get all listings (no complex queries to avoid index requirements)
    const allListingsQuery = await listingsRef.orderBy('createdAt', 'desc').limit(100).get();
    
    // Get only active listings
    const activeListingsQuery = await listingsRef.where('status', '==', 'active').orderBy('createdAt', 'desc').limit(50).get();

    const allListings = allListingsQuery.docs.map(doc => ({
      id: doc.id,
      title: doc.data().title,
      status: doc.data().status,
      isMockListing: doc.data().isMockListing || false,
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || 'No date',
      game: doc.data().game,
      price: doc.data().price
    }));

    const activeListings = activeListingsQuery.docs.map(doc => ({
      id: doc.id,
      title: doc.data().title,
      status: doc.data().status,
      isMockListing: doc.data().isMockListing || false,
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || 'No date',
      game: doc.data().game,
      price: doc.data().price
    }));

    // Filter mock and real listings from the all listings data
    const mockListings = allListings.filter(listing => listing.isMockListing).slice(0, 20);
    const realListings = allListings.filter(listing => !listing.isMockListing).slice(0, 20);

    // Count by status
    const statusCounts = {
      active: 0,
      inactive: 0,
      archived: 0,
      other: 0
    };

    allListings.forEach(listing => {
      if (listing.status === 'active') statusCounts.active++;
      else if (listing.status === 'inactive') statusCounts.inactive++;
      else if (listing.status === 'archived') statusCounts.archived++;
      else statusCounts.other++;
    });

    // Count mock vs real
    const mockVsReal = {
      mock: allListings.filter(l => l.isMockListing).length,
      real: allListings.filter(l => !l.isMockListing).length
    };

    // Additional analysis for /listings/ page issue
    const activeRealListings = activeListings.filter(listing => !listing.isMockListing);
    const activeMockListings = activeListings.filter(listing => listing.isMockListing);

    res.status(200).json({
      summary: {
        totalListings: allListings.length,
        activeListings: activeListings.length,
        mockListings: mockListings.length,
        realListings: realListings.length,
        activeRealListings: activeRealListings.length,
        activeMockListings: activeMockListings.length,
        statusCounts,
        mockVsReal
      },
      samples: {
        allListings: allListings.slice(0, 10),
        activeListings: activeListings.slice(0, 10),
        mockListings: mockListings.slice(0, 5),
        realListings: realListings.slice(0, 5),
        activeRealListings: activeRealListings.slice(0, 5),
        activeMockListings: activeMockListings.slice(0, 5)
      },
      analysis: {
        message: "This shows the breakdown of listings. If /listings/ only shows mock listings, check if real listings have status='active'",
        possibleIssues: [
          "Real listings might not have status='active'",
          "Real listings might be filtered out by other criteria",
          "Pagination logic might be excluding real listings",
          "Cache issues might be showing stale data"
        ]
      }
    });

  } catch (error: any) {
    console.error('Error comparing listings:', error);
    res.status(500).json({ 
      error: 'Failed to compare listings',
      details: error.message 
    });
  }
}