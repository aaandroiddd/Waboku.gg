import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { getAuth } from 'firebase-admin/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Get reports API called');
    
    // Get filter parameter (pending, resolved, all)
    const { filter = 'pending', limit: limitParam = '20' } = req.query;
    const limitNumber = parseInt(limitParam as string) || 20;
    
    console.log('Fetching reports with filter:', filter, 'limit:', limitNumber);
    
    // Initialize Firebase Admin
    const { admin, db } = getFirebaseAdmin();
    if (!admin || !db) {
      throw new Error('Firebase Admin not initialized');
    }
    
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
        
        // Get user document to check if they're a moderator
        const userDoc = await db.collection('users').doc(decodedToken.uid).get();
        
        if (userDoc.exists) {
          const userData = userDoc.data();
          console.log('User roles check in get-reports:', {
            uid: decodedToken.uid,
            roles: userData?.roles,
            rolesType: typeof userData?.roles,
            isArray: Array.isArray(userData?.roles),
            hasRoles: !!userData?.roles
          });
          
          // Handle different role formats
          let isAdmin = false;
          let isModerator = false;
          
          // Direct boolean flags
          if (userData?.isAdmin === true) {
            isAdmin = true;
          }
          if (userData?.isModerator === true) {
            isModerator = true;
          }
          
          // String role
          if (typeof userData?.roles === 'string') {
            if (userData.roles === 'admin') isAdmin = true;
            if (userData.roles === 'moderator') isModerator = true;
          }
          
          // Array of roles
          if (Array.isArray(userData?.roles)) {
            for (const role of userData.roles) {
              if (role === 'admin') isAdmin = true;
              if (role === 'moderator') isModerator = true;
            }
          }
          
          if (isAdmin || isModerator) {
            isAuthorized = true;
            moderatorId = decodedToken.uid;
            console.log('User authorized as moderator/admin:', moderatorId);
          } else {
            console.log('User not authorized as moderator. User data:', JSON.stringify(userData));
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
    
    // Fetch reports from Firestore using Firebase Admin
    console.log('Fetching reports from Firestore...');
    
    let reportsSnapshot;
    
    // Build query based on filter - use simple approach first
    if (filter === 'all') {
      reportsSnapshot = await db.collection('reports')
        .orderBy('reportedAt', 'desc')
        .limit(limitNumber)
        .get();
    } else {
      // For specific status, try with where clause
      const statusFilter = filter === 'pending' ? 'pending' : filter;
      console.log(`Using status filter: ${statusFilter}`);
      
      try {
        reportsSnapshot = await db.collection('reports')
          .where('status', '==', statusFilter)
          .limit(limitNumber)
          .get();
        console.log(`Query with where clause succeeded, found ${reportsSnapshot.size} reports`);
      } catch (whereError) {
        console.warn('Where query failed, falling back to get all:', whereError);
        // Fall back to getting all reports and filtering in memory
        reportsSnapshot = await db.collection('reports')
          .limit(limitNumber * 2) // Get more to account for filtering
          .get();
      }
    }
    
    console.log(`Found ${reportsSnapshot.size} reports in collection`);
    
    // Check if we have any reports
    if (reportsSnapshot.empty) {
      console.log('No reports found in the collection');
      return res.status(200).json({ 
        success: true, 
        reports: [],
        total: 0,
        message: 'No reports found'
      });
    }
    
    // Process reports
    const reports = [];
    const listingIds = new Set();
    
    reportsSnapshot.forEach(doc => {
      const reportData = doc.data();
      
      // If we're filtering and the query didn't work, filter here
      if (filter !== 'all' && filter !== 'pending') {
        if (reportData.status !== filter) {
          return; // Skip this report
        }
      } else if (filter === 'pending' && reportData.status && reportData.status !== 'pending') {
        return; // Skip non-pending reports
      }
      
      const report = {
        id: doc.id,
        ...reportData,
        reportedAt: reportData.reportedAt ? reportData.reportedAt.toDate() : null,
        moderatedAt: reportData.moderatedAt ? reportData.moderatedAt.toDate() : null
      };
      
      reports.push(report);
      
      if (reportData.listingId) {
        listingIds.add(reportData.listingId);
      }
    });
    
    console.log(`Processing ${reports.length} reports after filtering`);
    
    // Fetch associated listings
    const listingsMap = {};
    if (listingIds.size > 0) {
      console.log(`Fetching ${listingIds.size} associated listings`);
      
      for (const listingId of listingIds) {
        try {
          const listingDoc = await db.collection('listings').doc(listingId as string).get();
          
          if (listingDoc.exists) {
            const listingData = listingDoc.data();
            listingsMap[listingId] = {
              ...listingData,
              id: listingId,
              createdAt: listingData?.createdAt ? listingData.createdAt.toDate() : null,
              expiresAt: listingData?.expiresAt ? listingData.expiresAt.toDate() : null,
              archivedAt: listingData?.archivedAt ? listingData.archivedAt.toDate() : null,
              moderatedAt: listingData?.moderatedAt ? listingData.moderatedAt.toDate() : null
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
      console.log('Processing report:', {
        id: report.id,
        listingId: report.listingId,
        status: report.status
      });
      
      // If the listing exists, combine it with the report data
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
          reason: report.reason || '',
          status: report.status || 'pending'
        };
      }
      
      // If the listing doesn't exist, create a placeholder with report data
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
        reason: report.reason || '',
        status: report.status || 'pending',
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
    
  } catch (error: any) {
    console.error('Error fetching reports:', error);
    
    return res.status(500).json({ 
      error: 'Failed to fetch reports',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}