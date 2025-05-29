import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdminServices } from '@/lib/firebase-admin';
import { GAME_MAPPING, OTHER_GAME_MAPPING } from '@/lib/game-mappings';

interface CategoryStats {
  category: string;
  displayName: string;
  activeListings: number;
  archivedListings: number;
  totalListings: number;
  capacityUsed: number; // Percentage of 10M capacity used
  shortIdMappings: number;
  averagePrice: number;
  priceRange: { min: number; max: number };
  recentListings: number; // Last 7 days
}

interface OverallStats {
  totalActiveListings: number;
  totalArchivedListings: number;
  totalListings: number;
  totalUsers: number;
  totalOffers: number;
  totalOrders: number;
  totalReports: number;
  totalShortIdMappings: number;
  databaseSize: string;
  lastUpdated: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check admin authorization
  const adminSecret = req.headers.authorization?.replace('Bearer ', '');
  if (adminSecret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { db } = getFirebaseAdminServices();
    if (!db) {
      throw new Error('Database not initialized');
    }

    // Get all game categories
    const allCategories = { ...GAME_MAPPING, ...OTHER_GAME_MAPPING };
    const categoryStats: CategoryStats[] = [];

    // Calculate stats for each category
    for (const [displayName, categorySlug] of Object.entries(allCategories)) {
      try {
        // Active listings
        const activeQuery = await db.collection('listings')
          .where('game', '==', displayName)
          .where('status', '==', 'active')
          .get();

        // Archived listings
        const archivedQuery = await db.collection('listings')
          .where('game', '==', displayName)
          .where('status', '==', 'archived')
          .get();

        // Recent listings (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const recentQuery = await db.collection('listings')
          .where('game', '==', displayName)
          .where('createdAt', '>=', sevenDaysAgo)
          .get();

        // Calculate price statistics from active listings
        const activePrices: number[] = [];
        activeQuery.docs.forEach(doc => {
          const data = doc.data();
          if (data.price && typeof data.price === 'number' && data.price > 0) {
            activePrices.push(data.price);
          }
        });

        const averagePrice = activePrices.length > 0 
          ? activePrices.reduce((sum, price) => sum + price, 0) / activePrices.length 
          : 0;

        const priceRange = activePrices.length > 0 
          ? { min: Math.min(...activePrices), max: Math.max(...activePrices) }
          : { min: 0, max: 0 };

        const totalListings = activeQuery.size + archivedQuery.size;
        const capacityUsed = (totalListings / 10000000) * 100; // 10M capacity per category

        categoryStats.push({
          category: categorySlug,
          displayName,
          activeListings: activeQuery.size,
          archivedListings: archivedQuery.size,
          totalListings,
          capacityUsed,
          shortIdMappings: 0, // Will be calculated separately
          averagePrice,
          priceRange,
          recentListings: recentQuery.size
        });
      } catch (error) {
        console.error(`Error calculating stats for ${displayName}:`, error);
        // Add empty stats for this category
        categoryStats.push({
          category: categorySlug,
          displayName,
          activeListings: 0,
          archivedListings: 0,
          totalListings: 0,
          capacityUsed: 0,
          shortIdMappings: 0,
          averagePrice: 0,
          priceRange: { min: 0, max: 0 },
          recentListings: 0
        });
      }
    }

    // Calculate overall statistics
    const totalActiveListings = categoryStats.reduce((sum, cat) => sum + cat.activeListings, 0);
    const totalArchivedListings = categoryStats.reduce((sum, cat) => sum + cat.archivedListings, 0);
    const totalListings = totalActiveListings + totalArchivedListings;

    // Get additional statistics
    let totalUsers = 0;
    let totalOffers = 0;
    let totalOrders = 0;
    let totalReports = 0;
    let totalShortIdMappings = 0;

    try {
      const [usersQuery, offersQuery, ordersQuery, reportsQuery, shortIdQuery] = await Promise.all([
        db.collection('users').get(),
        db.collection('offers').get(),
        db.collection('orders').get(),
        db.collection('reports').get(),
        db.collection('shortIdMappings').get()
      ]);

      totalUsers = usersQuery.size;
      totalOffers = offersQuery.size;
      totalOrders = ordersQuery.size;
      totalReports = reportsQuery.size;
      totalShortIdMappings = shortIdQuery.size;
    } catch (error) {
      console.error('Error fetching additional statistics:', error);
    }

    // Update shortIdMappings count for each category (approximate)
    const avgMappingsPerCategory = totalShortIdMappings / categoryStats.length;
    categoryStats.forEach(cat => {
      cat.shortIdMappings = Math.round((cat.totalListings / totalListings) * totalShortIdMappings) || 0;
    });

    const overallStats: OverallStats = {
      totalActiveListings,
      totalArchivedListings,
      totalListings,
      totalUsers,
      totalOffers,
      totalOrders,
      totalReports,
      totalShortIdMappings,
      databaseSize: 'Calculating...', // Could be enhanced with actual size calculation
      lastUpdated: new Date().toISOString()
    };

    // Sort categories by total listings (descending)
    categoryStats.sort((a, b) => b.totalListings - a.totalListings);

    return res.status(200).json({
      success: true,
      overallStats,
      categoryStats,
      capacityInfo: {
        maxListingsPerCategory: 10000000,
        totalCapacity: 10000000 * Object.keys(allCategories).length,
        usedCapacity: totalListings,
        remainingCapacity: (10000000 * Object.keys(allCategories).length) - totalListings
      }
    });

  } catch (error) {
    console.error('Error fetching listing analytics:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}