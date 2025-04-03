import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseServices } from '@/lib/firebase';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { getAuth } from 'firebase-admin/auth';
import { initAdmin } from '@/lib/firebase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Initialize Firebase Admin if needed
    initAdmin();
    
    // Get filter parameter (pending, resolved, all)
    const { filter = 'pending', limit: limitParam = '20' } = req.query;
    const limitNumber = parseInt(limitParam as string) || 20;
    
    // Authenticate the request
    let isAuthorized = false;
    let moderatorId = '';
    
    // Check for admin secret
    const adminSecret = req.headers['x-admin-secret'];
    if (adminSecret && process.env.ADMIN_SECRET && adminSecret === process.env.ADMIN_SECRET) {
      isAuthorized = true;
    } 
    // Check for Firebase auth token
    else if (req.headers.authorization?.startsWith('Bearer ')) {
      const token = req.headers.authorization.split('Bearer ')[1];
      try {
        const decodedToken = await getAuth().verifyIdToken(token);
        
        // Check if user is a moderator
        const { db } = getFirebaseServices();
        if (!db) {
          throw new Error('Firebase services not initialized');
        }
        
        // Get user document to check if they're a moderator
        const userDoc = await getDocs(query(
          collection(db, 'users'),
          where('uid', '==', decodedToken.uid)
        ));
        
        if (!userDoc.empty) {
          const userData = userDoc.docs[0].data();
          if (userData.isModerator || userData.isAdmin) {
            isAuthorized = true;
            moderatorId = decodedToken.uid;
          }
        }
      } catch (error) {
        console.error('Error verifying auth token:', error);
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }
    
    if (!isAuthorized) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Fetch reports from Firestore
    const { db } = getFirebaseServices();
    if (!db) {
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
      reportsQuery = query(
        collection(db, 'reports'),
        where('status', '==', filter),
        orderBy('reportedAt', 'desc'),
        limit(limitNumber)
      );
    }
    
    const reportsSnapshot = await getDocs(reportsQuery);
    
    // Process reports and fetch associated listings
    const reports = [];
    const listingIds = new Set();
    
    // First, collect all report data and listing IDs
    reportsSnapshot.forEach(doc => {
      const reportData = doc.data();
      reports.push({
        id: doc.id,
        ...reportData,
        reportedAt: reportData.reportedAt?.toDate?.() || null
      });
      
      if (reportData.listingId) {
        listingIds.add(reportData.listingId);
      }
    });
    
    // Fetch all listings in a single batch
    const listingsMap = {};
    if (listingIds.size > 0) {
      const listingPromises = Array.from(listingIds).map(async (listingId) => {
        try {
          const listingDoc = await getDocs(query(
            collection(db, 'listings'),
            where('id', '==', listingId)
          ));
          
          if (!listingDoc.empty) {
            const listingData = listingDoc.docs[0].data();
            listingsMap[listingId] = {
              ...listingData,
              id: listingId,
              createdAt: listingData.createdAt?.toDate?.() || null,
              expiresAt: listingData.expiresAt?.toDate?.() || null,
              archivedAt: listingData.archivedAt?.toDate?.() || null,
              moderatedAt: listingData.moderatedAt?.toDate?.() || null
            };
          }
        } catch (error) {
          console.error(`Error fetching listing ${listingId}:`, error);
        }
      });
      
      await Promise.all(listingPromises);
    }
    
    // Combine reports with their listings
    const reportedListings = reports.map(report => {
      const listing = listingsMap[report.listingId] || null;
      
      if (listing) {
        return {
          ...listing,
          reportId: report.id,
          reportReason: report.reason,
          reportDescription: report.description,
          reportedBy: report.reportedBy,
          reportedAt: report.reportedAt,
          reportStatus: report.status
        };
      }
      
      return null;
    }).filter(Boolean); // Remove null entries
    
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