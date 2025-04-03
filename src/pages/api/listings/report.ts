import { NextApiRequest, NextApiResponse } from 'next';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { initAdmin, getFirebaseAdmin } from '@/lib/firebase-admin';
import { getAuth } from 'firebase-admin/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Report API called');
    const { listingId, reason, description, reportedBy } = req.body;

    // Validate required fields
    if (!listingId || !reason || !description || !reportedBy) {
      console.log('Missing required fields:', { listingId, reason, description, reportedBy });
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Initialize Firebase Admin first
    console.log('Initializing Firebase Admin...');
    const { admin, db: adminDb } = getFirebaseAdmin();
    if (!admin || !adminDb) {
      console.error('Firebase Admin not initialized');
      return res.status(500).json({ error: 'Firebase Admin not initialized' });
    }
    console.log('Firebase Admin initialized successfully');

    // Verify the user is authenticated
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('Missing or invalid authorization header');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      // Verify the token using Firebase Admin
      decodedToken = await getAuth().verifyIdToken(token);
      console.log('Token verified for user:', decodedToken.uid);
      
      // Verify that the reportedBy matches the authenticated user
      if (decodedToken.uid !== reportedBy) {
        console.error('User ID mismatch:', { tokenUid: decodedToken.uid, reportedBy });
        return res.status(403).json({ error: 'User ID mismatch' });
      }
    } catch (error) {
      console.error('Error verifying token:', error);
      return res.status(401).json({ error: 'Invalid authentication token' });
    }

    // Use Firestore from Firebase Admin instead of client SDK
    console.log('Checking if listing exists...');
    const listingRef = adminDb.collection('listings').doc(listingId);
    const listingDoc = await listingRef.get();
    
    if (!listingDoc.exists) {
      console.log('Listing not found:', listingId);
      return res.status(404).json({ error: 'Listing not found' });
    }

    // Get listing data
    const listingData = listingDoc.data();
    console.log('Listing found:', { title: listingData?.title, id: listingId });

    // Create a unique ID for the report
    const reportId = `${listingId}_${reportedBy}_${Date.now()}`;
    
    // Create the report document
    console.log('Creating report document...');
    const reportRef = adminDb.collection('reports').doc(reportId);
    await reportRef.set({
      listingId,
      listingTitle: listingData?.title || 'Unknown Listing',
      reason,
      description,
      reportedBy,
      reportedAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'pending', // pending, reviewed, resolved
      listingOwnerId: listingData?.userId,
      listingOwnerUsername: listingData?.username || 'Unknown User',
      moderationAction: null, // Will be set when a moderator takes action
      moderatorNotes: null,
      moderatedBy: null,
      moderatedAt: null,
      // Add image URLs for easier moderation
      listingImageUrl: listingData?.imageUrls && listingData?.imageUrls.length > 0 ? 
        listingData.imageUrls[0] : null,
      // Add game and price for context
      listingGame: listingData?.game || 'Unknown',
      listingPrice: listingData?.price || 0,
    });

    console.log('Report document created with ID:', reportId);

    // Update the listing to indicate it has been reported
    // This doesn't change the visibility of the listing yet
    await listingRef.update({
      hasBeenReported: true,
      reportCount: (listingData?.reportCount || 0) + 1,
      lastReportedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('Listing updated with report information');

    return res.status(200).json({ success: true, message: 'Report submitted successfully' });
  } catch (error: any) {
    console.error('Error submitting report:', error);
    return res.status(500).json({ error: 'Failed to submit report', details: error.message });
  }
}