import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseServices } from '@/lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp, setDoc, collection, query, where, limit, getDocs } from 'firebase/firestore';
import { getAuth } from 'firebase-admin/auth';
import { initAdmin } from '@/lib/firebase-admin';

// Helper function to handle report processing
async function processReport(
  reportDoc: any, 
  reportRef: any, 
  listingId: string, 
  action: 'dismiss' | 'remove', 
  notes: string | null, 
  rejectionReason: string | null, 
  moderatorId: string,
  db: any,
  res: NextApiResponse
) {
  const reportData = reportDoc.data();
  listingId = listingId || reportData.listingId;
  console.log('Processing report for listing:', listingId);
  
  // Get the listing document
  const listingRef = doc(db, 'listings', listingId);
  const listingDoc = await getDoc(listingRef);
  
  if (!listingDoc.exists()) {
    console.log('Listing not found:', listingId);
    return res.status(404).json({ error: 'Listing not found' });
  }
  
  // Update the report status
  await updateDoc(reportRef, {
    status: action === 'dismiss' ? 'dismissed' : 'actioned',
    moderatedBy: moderatorId,
    moderatedAt: serverTimestamp(),
    moderatorNotes: notes || null,
    actionTaken: action
  });
  
  console.log('Report updated with status:', action === 'dismiss' ? 'dismissed' : 'actioned');
  
  // If the action is to remove the listing, update the listing status
  if (action === 'remove') {
    await updateDoc(listingRef, {
      status: 'archived',
      archivedAt: serverTimestamp(),
      archivedReason: 'reported',
      archivedBy: moderatorId,
      moderationDetails: {
        moderatorId,
        actionTaken: 'reject',
        timestamp: serverTimestamp(),
        notes: notes || null,
        rejectionReason: rejectionReason || 'reported_by_user'
      }
    });
    
    console.log('Listing archived due to report');
    
    // Send a notification to the listing owner
    const listingData = listingDoc.data();
    const ownerId = listingData.userId;
    
    if (ownerId) {
      try {
        const notificationRef = doc(db, 'users', ownerId, 'notifications', `report_${reportDoc.id}`);
        await setDoc(notificationRef, {
          type: 'listing_removed',
          listingId,
          listingTitle: listingData.title,
          reason: rejectionReason || 'reported_by_user',
          message: 'Your listing has been removed due to a user report.',
          createdAt: serverTimestamp(),
          read: false
        });
        console.log('Notification sent to listing owner:', ownerId);
      } catch (notificationError) {
        console.error('Error sending notification to owner:', notificationError);
        // Continue even if notification fails
      }
    }
  }
  
  return res.status(200).json({ 
    success: true, 
    message: action === 'dismiss' ? 'Report dismissed' : 'Listing removed and report actioned' 
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Handle report API called');
    
    // Initialize Firebase Admin if needed
    initAdmin();
    
    const { reportId, action, notes, rejectionReason } = req.body;

    // Validate required fields
    if (!reportId || !action) {
      console.log('Missing required fields:', { reportId, action });
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Authenticate the request
    let isAuthorized = false;
    let moderatorId = 'system';
    
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
          // Check for moderator role in different possible formats
          if (userData.isModerator || 
              userData.isAdmin || 
              userData.roles === 'moderator' || 
              userData.roles === 'admin' || 
              (userData.roles && userData.roles[0] === 'moderator') ||
              (userData.roles && userData.roles.includes && userData.roles.includes('moderator'))) {
            isAuthorized = true;
            moderatorId = decodedToken.uid;
            console.log('User authorized as moderator/admin:', moderatorId, 'Role format:', userData.roles);
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
    
    // Get Firebase services
    const { db } = getFirebaseServices();
    if (!db) {
      console.error('Firebase services not initialized');
      throw new Error('Firebase services not initialized');
    }
    
    // Get the report document
    const reportRef = doc(db, 'reports', reportId);
    const reportDoc = await getDoc(reportRef);
    
    if (!reportDoc.exists()) {
      console.log('Report not found with ID:', reportId);
      
      // Check if we have a listing ID in the request body
      const { listingId } = req.body;
      if (listingId) {
        console.log('Trying to find report using listing ID:', listingId);
        
        // Try to find a pending report for this listing
        const reportsCollection = collection(db, 'reports');
        const q = query(
          reportsCollection,
          where('listingId', '==', listingId),
          where('status', '==', 'pending'),
          limit(1)
        );
        
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          // Found a report for this listing
          const foundReportDoc = querySnapshot.docs[0];
          const foundReportRef = doc(db, 'reports', foundReportDoc.id);
          
          console.log('Found report with ID:', foundReportDoc.id, 'for listing:', listingId);
          
          // Process the report using our helper function
          return processReport(
            foundReportDoc,
            foundReportRef,
            listingId,
            action,
            notes,
            rejectionReason,
            moderatorId,
            db,
            res
          );
        } else {
          console.log('No pending reports found for listing:', listingId);
        }
      }
      
      return res.status(404).json({ error: 'Report not found' });
    }
    
    // If we found the report directly, process it
    return processReport(
      reportDoc,
      reportRef,
      reportDoc.data().listingId,
      action,
      notes,
      rejectionReason,
      moderatorId,
      db,
      res
    );
  } catch (error) {
    console.error('Error handling report:', error);
    return res.status(500).json({ error: 'Failed to handle report' });
  }
}