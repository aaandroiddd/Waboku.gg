import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseServices } from '@/lib/firebase';
import { collection, getDocs, query, where, orderBy, limit, getDoc, doc } from 'firebase/firestore';
import { getAuth } from 'firebase-admin/auth';
import { initAdmin } from '@/lib/firebase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Get reports API called');
    
    // Initialize Firebase Admin if needed
    initAdmin();
    
    // Get filter parameter (pending, resolved, all)
    const { filter = 'pending', limit: limitParam = '20' } = req.query;
    const limitNumber = parseInt(limitParam as string) || 20;
    
    console.log('Fetching reports with filter:', filter, 'limit:', limitNumber);
    
    // Authenticate the request
    let isAuthorized = false;
    let moderatorId = '';
    
    // Check for admin secret
    const adminSecret = req.headers['x-admin-secret'];
    if (adminSecret && process.env.ADMIN_SECRET && adminSecret === process.env.ADMIN_SECRET) {
      isAuthorized = true;
      console.log('Authorized via admin secret');
    } 
    // Check for Firebase auth token
    else if (req.headers.authorization?.startsWith('Bearer ')) {
      const token = req.headers.authorization.split('Bearer ')[1];
      try {
        const decodedToken = await getAuth().verifyIdToken(token);
        console.log('Token verified for user:', decodedToken.uid);
        
        // Check if user is a moderator
        const { db } = getFirebaseServices();
        if (!db) {
          throw new Error('Firebase services not initialized');
        }
        
        // Get user document to check if they're a moderator
        const userDoc = await getDoc(doc(db, 'users', decodedToken.uid));
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.isModerator || userData.isAdmin) {
            isAuthorized = true;
            moderatorId = decodedToken.uid;
            console.log('User authorized as moderator/admin:', moderatorId);
          }
        }
      } catch (error) {
        console.error('Error verifying auth token:', error);
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }
    
    if (!isAuthorized) {
      console.log('User not authorized');
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Fetch reports from Firestore
    const { db } = getFirebaseServices();
    if (!db) {
      console.error('Firebase services not initialized');
      throw new Error('Firebase services not initialized');
    }
    
    // Build query based on filter
    let reportsQuery;
    if (filter === 'all') {
      reportsQuery = query(
        collection(db, 'reports'),
        orderBy('reportedAt', 'desc'),
        limit(limitNumber)
      );
    } else {
      // Check if we need to use 'pending' as the status filter
      const statusFilter = filter === 'pending' ? 'pending' : filter;
      console.log(`Using status filter: ${statusFilter}`);
      
      reportsQuery = query(
        collection(db, 'reports'),
        where('status', '==', statusFilter),
        orderBy('reportedAt', 'desc'),
        limit(limitNumber)
      );
    }
    
    const reportsSnapshot = await getDocs(reportsQuery);
    console.log(`Found ${reportsSnapshot.size} reports`);
    
    // Process reports and fetch associated listings
    const reports = [];
    const listingIds = new Set();
    
    // First, collect all report data and listing IDs
    reportsSnapshot.forEach(doc => {
      const reportData = doc.data();
      reports.push({
        id: doc.id,
        ...reportData,
        reportedAt: reportData.reportedAt?.toDate?.() || null,
        moderatedAt: reportData.moderatedAt?.toDate?.() || null
      });
      
      if (reportData.listingId) {
        listingIds.add(reportData.listingId);
      }
    });
    
    // Fetch all listings in a single batch
    const listingsMap = {};
    if (listingIds.size > 0) {
      console.log(`Fetching ${listingIds.size} associated listings`);
      
      for (const listingId of listingIds) {
        try {
          const listingDocRef = doc(db, 'listings', listingId as string);
          const listingDocSnap = await getDoc(listingDocRef);
          
          if (listingDocSnap.exists()) {
            const listingData = listingDocSnap.data();
            listingsMap[listingId] = {
              ...listingData,
              id: listingId,
              createdAt: listingData.createdAt?.toDate?.() || null,
              expiresAt: listingData.expiresAt?.toDate?.() || null,
              archivedAt: listingData.archivedAt?.toDate?.() || null,
              moderatedAt: listingData.moderatedAt?.toDate?.() || null
            };
          } else {
            console.log(`Listing ${listingId} not found`);
          }
        } catch (error) {
          console.error(`Error fetching listing ${listingId}:`, error);
        }
      }
    }
    
    // Combine reports with their listings
    const reportedListings = reports.map(report => {
      // Log the report data to help with debugging
      console.log('Processing report:', {
        id: report.id,
        listingId: report.listingId,
        fields: Object.keys(report)
      });
      
      // If the listing exists in our map, combine it with the report data
      if (listingsMap[report.listingId]) {
        const listing = listingsMap[report.listingId];
        return {
          ...listing,
          reportId: report.id,
          reportReason: report.reason || '',
          reportDescription: report.description || '',
          reportedBy: report.reportedBy || '',
          reportedAt: report.reportedAt,
          reportStatus: report.status || 'pending',
          moderatedAt: report.moderatedAt,
          moderatedBy: report.moderatedBy,
          moderatorNotes: report.moderatorNotes,
          // Add fields from the screenshot
          reason: report.reason || '',
          status: report.status || 'pending'
        };
      }
      
      // If the listing doesn't exist, create a placeholder with report data
      // This handles cases where the listing might have been deleted
      return {
        id: report.listingId || '',
        title: report.listingTitle || 'Unknown Listing',
        description: 'Listing details not available',
        price: report.listingPrice || 0,
        game: report.listingGame || 'Unknown',
        imageUrls: report.listingImageUrl ? [report.listingImageUrl] : [],
        username: report.listingOwnerUsername || 'Unknown User',
        userId: report.listingOwnerId || '',
        reportId: report.id,
        reportReason: report.reason || '',
        reportDescription: report.description || '',
        reportedBy: report.reportedBy || '',
        reportedAt: report.reportedAt,
        reportStatus: report.status || 'pending',
        moderatedAt: report.moderatedAt,
        moderatedBy: report.moderatedBy,
        moderatorNotes: report.moderatorNotes,
        // Add fields from the screenshot
        reason: report.reason || '',
        status: report.status || 'pending',
        // Add listing fields from the report data
        listingId: report.listingId || '',
        listingTitle: report.listingTitle || 'Unknown Listing',
        listingPrice: report.listingPrice || 0,
        listingGame: report.listingGame || 'Unknown',
        listingImageUrl: report.listingImageUrl || '',
        listingOwnerId: report.listingOwnerId || '',
        listingOwnerUsername: report.listingOwnerUsername || 'Unknown User'
      };
    });
    
    console.log(`Returning ${reportedListings.length} reported listings`);
    
    return res.status(200).json({ 
      success: true, 
      reports: reportedListings,
      total: reportedListings.length
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    return res.status(500).json({ error: 'Failed to fetch reports' });
  }
}