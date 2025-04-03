import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseServices } from '@/lib/firebase';
import { collection, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth, getIdToken } from 'firebase/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { listingId, reason, description, reportedBy } = req.body;

    // Validate required fields
    if (!listingId || !reason || !description || !reportedBy) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get Firebase services
    const { db, auth } = getFirebaseServices();
    if (!db || !auth) {
      return res.status(500).json({ error: 'Firebase services not initialized' });
    }

    // Verify the user is authenticated
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split('Bearer ')[1];
    try {
      // Verify the token
      await getAuth().verifyIdToken(token);
    } catch (error) {
      console.error('Error verifying token:', error);
      return res.status(401).json({ error: 'Invalid authentication token' });
    }

    // Check if the listing exists
    const listingRef = doc(db, 'listings', listingId);
    const listingDoc = await getDoc(listingRef);
    
    if (!listingDoc.exists()) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    // Get listing data
    const listingData = listingDoc.data();

    // Create a unique ID for the report
    const reportId = `${listingId}_${reportedBy}_${Date.now()}`;
    
    // Create the report document
    const reportRef = doc(db, 'reports', reportId);
    await setDoc(reportRef, {
      listingId,
      listingTitle: listingData.title || 'Unknown Listing',
      reason,
      description,
      reportedBy,
      reportedAt: serverTimestamp(),
      status: 'pending', // pending, reviewed, resolved
      listingOwnerId: listingData.userId,
      listingOwnerUsername: listingData.username || 'Unknown User',
      moderationAction: null, // Will be set when a moderator takes action
      moderatorNotes: null,
      moderatedBy: null,
      moderatedAt: null,
    });

    // Update the listing to indicate it has been reported
    // This doesn't change the visibility of the listing yet
    await setDoc(listingRef, {
      hasBeenReported: true,
      reportCount: (listingData.reportCount || 0) + 1,
      lastReportedAt: serverTimestamp(),
    }, { merge: true });

    return res.status(200).json({ success: true, message: 'Report submitted successfully' });
  } catch (error: any) {
    console.error('Error submitting report:', error);
    return res.status(500).json({ error: 'Failed to submit report', details: error.message });
  }
}