import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseServices } from '@/lib/firebase';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase-admin/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('POST /api/offers/update-status START');
  
  if (req.method !== 'POST') {
    console.log('Method not allowed:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get the authorization token from the request headers
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('No valid authorization header found');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split('Bearer ')[1];
    
    // Verify the token and get the user
    console.log('Verifying token...');
    const { admin } = getFirebaseServices();
    let decodedToken;
    try {
      decodedToken = await getAuth(admin).verifyIdToken(token);
      console.log('Token verified successfully');
    } catch (tokenError: any) {
      console.error('Token verification error:', {
        message: tokenError.message,
        code: tokenError.code
      });
      return res.status(401).json({ 
        error: 'Invalid authentication token',
        details: tokenError.message
      });
    }
    
    const userId = decodedToken.uid;
    console.log(`Authenticated user: ${userId}`);

    // Get the request body
    const { offerId, status } = req.body;
    console.log('Request body:', { offerId, status });

    // Validate the request body
    if (!offerId || !status) {
      console.error('Missing required fields in request body');
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate the status
    if (!['accepted', 'declined', 'expired', 'countered'].includes(status)) {
      console.error('Invalid status value:', status);
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Get the offer
    console.log(`Getting offer with ID: ${offerId}`);
    const { db } = getFirebaseServices();
    const offerRef = doc(db, 'offers', offerId);
    const offerSnap = await getDoc(offerRef);

    if (!offerSnap.exists()) {
      console.error(`Offer with ID ${offerId} not found`);
      return res.status(404).json({ error: 'Offer not found' });
    }

    const offerData = offerSnap.data();
    console.log('Offer data:', {
      sellerId: offerData.sellerId,
      buyerId: offerData.buyerId,
      currentStatus: offerData.status,
      newStatus: status
    });

    // Verify that the user is authorized to update the offer
    let isAuthorized = false;
    
    if (status === 'accepted' || status === 'declined' || status === 'expired') {
      // For these statuses, user must be the seller
      isAuthorized = offerData.sellerId === userId;
      if (!isAuthorized) {
        console.error(`User ${userId} is not the seller (${offerData.sellerId}) of this offer`);
      }
    } else if (status === 'countered') {
      // For counter offers, user must be the seller
      isAuthorized = offerData.sellerId === userId;
      if (!isAuthorized) {
        console.error(`User ${userId} is not the seller (${offerData.sellerId}) of this offer`);
      }
    }
    
    if (!isAuthorized) {
      return res.status(403).json({ error: 'You are not authorized to update this offer' });
    }

    // Update the offer status
    console.log(`Updating offer ${offerId} status to ${status}`);
    
    // If the offer is being accepted, check if it requires shipping info
    const updateData: any = {
      status,
      updatedAt: serverTimestamp()
    };
    
    await updateDoc(offerRef, updateData);

    console.log(`Successfully updated offer ${offerId} status to ${status}`);
    
    // Prepare success message based on status
    let successMessage = '';
    let description = '';
    
    if (status === 'accepted') {
      successMessage = 'Offer accepted successfully';
      description = 'The buyer has been notified of your acceptance';
    } else if (status === 'declined') {
      successMessage = 'Offer declined successfully';
      description = 'The offer has been removed from your dashboard';
    } else if (status === 'expired') {
      successMessage = 'Offer marked as expired';
    } else if (status === 'countered') {
      successMessage = 'Counter offer sent successfully';
      description = 'The buyer has been notified of your counter offer';
    }

    return res.status(200).json({ 
      success: true, 
      message: successMessage,
      description: description
    });
  } catch (error: any) {
    console.error('Error updating offer status:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    return res.status(500).json({ 
      error: 'Failed to update offer status',
      details: error.message
    });
  } finally {
    console.log('POST /api/offers/update-status END');
  }
}