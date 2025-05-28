import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { getAuth } from 'firebase-admin/auth';

// Helper function to handle report processing
async function processReport(
  reportDoc: any, 
  reportId: string,
  listingId: string, 
  action: 'dismiss' | 'remove', 
  notes: string | null, 
  rejectionReason: string | null, 
  moderatorId: string,
  db: any,
  admin: any,
  res: NextApiResponse
) {
  const reportData = reportDoc.data();
  listingId = listingId || reportData.listingId;
  console.log('Processing report for listing:', listingId);
  
  // Get the listing document
  const listingDoc = await db.collection('listings').doc(listingId).get();
  
  if (!listingDoc.exists) {
    console.log('Listing not found:', listingId);
    return res.status(404).json({ error: 'Listing not found' });
  }
  
  // Update the report status
  await db.collection('reports').doc(reportId).update({
    status: action === 'dismiss' ? 'dismissed' : 'actioned',
    moderatedBy: moderatorId,
    moderatedAt: admin.firestore.FieldValue.serverTimestamp(),
    moderatorNotes: notes || null,
    actionTaken: action
  });
  
  console.log('Report updated with status:', action === 'dismiss' ? 'dismissed' : 'actioned');
  
  // If the action is to remove the listing, update the listing status
  if (action === 'remove') {
    await db.collection('listings').doc(listingId).update({
      status: 'archived',
      archivedAt: admin.firestore.FieldValue.serverTimestamp(),
      archivedReason: 'reported',
      archivedBy: moderatorId,
      moderationDetails: {
        moderatorId,
        actionTaken: 'reject',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        notes: notes || null,
        rejectionReason: rejectionReason || 'reported_by_user'
      }
    });
    
    console.log('Listing archived due to report');
    
    // Send a notification to the listing owner
    const listingData = listingDoc.data();
    const ownerId = listingData?.userId;
    
    if (ownerId) {
      try {
        await db.collection('users').doc(ownerId).collection('notifications').doc(`report_${reportId}`).set({
          type: 'listing_removed',
          listingId,
          listingTitle: listingData.title,
          reason: rejectionReason || 'reported_by_user',
          message: 'Your listing has been removed due to a user report.',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
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
    
    const { reportId, action, notes, rejectionReason, listingId } = req.body;

    // Validate required fields
    if (!reportId || !action) {
      console.log('Missing required fields:', { reportId, action });
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Initialize Firebase Admin
    const { admin, db } = getFirebaseAdmin();
    if (!admin || !db) {
      throw new Error('Firebase Admin not initialized');
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
        
        // Get user document to check if they're a moderator
        const userDoc = await db.collection('users').doc(decodedToken.uid).get();
        
        if (userDoc.exists) {
          const userData = userDoc.data();
          console.log('User roles check in handle-report:', {
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
    
    // Get the report document
    const reportDoc = await db.collection('reports').doc(reportId).get();
    
    if (!reportDoc.exists) {
      console.log('Report not found with ID:', reportId);
      
      // Check if we have a listing ID in the request body
      if (listingId) {
        console.log('Trying to find report using listing ID:', listingId);
        
        // Try to find a pending report for this listing
        const querySnapshot = await db.collection('reports')
          .where('listingId', '==', listingId)
          .where('status', '==', 'pending')
          .limit(1)
          .get();
        
        if (!querySnapshot.empty) {
          // Found a report for this listing
          const foundReportDoc = querySnapshot.docs[0];
          const foundReportId = foundReportDoc.id;
          
          console.log('Found report with ID:', foundReportId, 'for listing:', listingId);
          
          // Process the report using our helper function
          return processReport(
            foundReportDoc,
            foundReportId,
            listingId,
            action,
            notes,
            rejectionReason,
            moderatorId,
            db,
            admin,
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
      reportId,
      reportDoc.data()?.listingId,
      action,
      notes,
      rejectionReason,
      moderatorId,
      db,
      admin,
      res
    );
  } catch (error: any) {
    console.error('Error handling report:', error);
    return res.status(500).json({ 
      error: 'Failed to handle report',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}