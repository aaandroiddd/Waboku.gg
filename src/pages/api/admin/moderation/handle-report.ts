import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseServices } from '@/lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase-admin/auth';
import { initAdmin } from '@/lib/firebase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Initialize Firebase Admin if needed
    initAdmin();
    
    const { reportId, action, notes, rejectionReason } = req.body;

    // Validate required fields
    if (!reportId || !action) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Authenticate the request
    let isAuthorized = false;
    let moderatorId = 'system';
    
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
        const userDoc = await getDoc(doc(db, 'users', decodedToken.uid));
        
        if (!userDoc.empty) {
          const userData = userDoc.data();
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
    
    // Get Firebase services
    const { db } = getFirebaseServices();
    if (!db) {
      throw new Error('Firebase services not initialized');
    }
    
    // Get the report document
    const reportRef = doc(db, 'reports', reportId);
    const reportDoc = await getDoc(reportRef);
    
    if (!reportDoc.exists()) {
      return res.status(404).json({ error: 'Report not found' });
    }
    
    const reportData = reportDoc.data();
    const listingId = reportData.listingId;
    
    // Get the listing document
    const listingRef = doc(db, 'listings', listingId);
    const listingDoc = await getDoc(listingRef);
    
    if (!listingDoc.exists()) {
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
      
      // Send a notification to the listing owner
      const listingData = listingDoc.data();
      const ownerId = listingData.userId;
      
      if (ownerId) {
        const notificationRef = doc(db, 'users', ownerId, 'notifications', `report_${reportId}`);
        await updateDoc(notificationRef, {
          type: 'listing_removed',
          listingId,
          listingTitle: listingData.title,
          reason: rejectionReason || 'reported_by_user',
          message: 'Your listing has been removed due to a user report.',
          createdAt: serverTimestamp(),
          read: false
        });
      }
    }
    
    return res.status(200).json({ 
      success: true, 
      message: action === 'dismiss' ? 'Report dismissed' : 'Listing removed and report actioned' 
    });
  } catch (error) {
    console.error('Error handling report:', error);
    return res.status(500).json({ error: 'Failed to handle report' });
  }
}