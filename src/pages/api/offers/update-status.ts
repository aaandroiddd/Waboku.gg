import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { emailService } from '@/lib/email-service';

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
    
    // Initialize Firebase Admin
    console.log('Initializing Firebase Admin...');
    let firebaseAdminInstance;
    try {
      firebaseAdminInstance = getFirebaseAdmin();
      console.log('Firebase Admin initialized successfully');
    } catch (adminInitError: any) {
      console.error('Firebase Admin initialization error:', {
        message: adminInitError.message,
        code: adminInitError.code
      });
      return res.status(500).json({ 
        error: 'Failed to initialize Firebase Admin',
        details: adminInitError.message
      });
    }
    
    // Get Auth and Firestore instances
    console.log('Getting Auth and Firestore instances...');
    let auth;
    let db;
    
    try {
      auth = getAuth();
      db = getFirestore();
      console.log('Successfully got Auth and Firestore instances');
    } catch (instanceError: any) {
      console.error('Error getting Auth or Firestore instance:', {
        message: instanceError.message,
        code: instanceError.code
      });
      return res.status(500).json({
        error: 'Failed to initialize Firebase services',
        details: instanceError.message
      });
    }
    
    // Verify the token and get the user
    console.log('Verifying token...');
    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(token);
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
    const offerRef = db.collection('offers').doc(offerId);
    const offerSnap = await offerRef.get();

    if (!offerSnap.exists) {
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
      updatedAt: FieldValue.serverTimestamp()
    };
    
    await offerRef.update(updateData);

    console.log(`Successfully updated offer ${offerId} status to ${status}`);
    
    // Send notifications and emails for status changes
    if (status === 'accepted' || status === 'declined' || status === 'countered') {
      try {
        // Get buyer and seller information
        const buyerData = await getAuth(admin).getUser(offerData.buyerId);
        const sellerData = await getAuth(admin).getUser(offerData.sellerId);
        
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://waboku.gg';
        
        if (status === 'accepted') {
          // Create notification for buyer
          try {
            console.log('Creating offer accepted notification for buyer:', offerData.buyerId);
            const notificationResponse = await fetch(`${baseUrl}/api/notifications/create`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                userId: offerData.buyerId,
                type: 'offer_accepted',
                title: '✅ Offer Accepted!',
                message: `${sellerData.displayName || 'The seller'} accepted your $${offerData.amount.toFixed(2)} offer on "${offerData.listingSnapshot?.title || 'Unknown Item'}"`,
                data: {
                  offerId: offerId,
                  listingId: offerData.listingId,
                  actionUrl: `/dashboard/orders`
                }
              })
            });
            
            if (notificationResponse.ok) {
              const result = await notificationResponse.json();
              console.log('Offer accepted notification created successfully:', result.notificationId);
            } else {
              const errorData = await notificationResponse.json();
              console.error('Failed to create offer accepted notification:', errorData);
            }
          } catch (notificationError) {
            console.error('Error creating offer accepted notification:', notificationError);
          }

          // Send offer accepted email to buyer
          await emailService.sendOfferAcceptedEmail({
            userName: buyerData.displayName || 'User',
            userEmail: buyerData.email || '',
            sellerName: sellerData.displayName || 'Seller',
            listingTitle: offerData.listingSnapshot?.title || 'Unknown Item',
            offerAmount: offerData.amount,
            actionUrl: `${baseUrl}/dashboard/orders`
          });
          console.log('Offer accepted email sent to buyer:', buyerData.email);
        } else if (status === 'declined') {
          // Create notification for buyer
          try {
            console.log('Creating offer declined notification for buyer:', offerData.buyerId);
            const notificationResponse = await fetch(`${baseUrl}/api/notifications/create`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                userId: offerData.buyerId,
                type: 'offer_declined',
                title: '❌ Offer Declined',
                message: `${sellerData.displayName || 'The seller'} declined your $${offerData.amount.toFixed(2)} offer on "${offerData.listingSnapshot?.title || 'Unknown Item'}"`,
                data: {
                  offerId: offerId,
                  listingId: offerData.listingId,
                  actionUrl: `/dashboard/offers`
                }
              })
            });
            
            if (notificationResponse.ok) {
              const result = await notificationResponse.json();
              console.log('Offer declined notification created successfully:', result.notificationId);
            } else {
              const errorData = await notificationResponse.json();
              console.error('Failed to create offer declined notification:', errorData);
            }
          } catch (notificationError) {
            console.error('Error creating offer declined notification:', notificationError);
          }

          // Send offer declined email to buyer
          await emailService.sendOfferDeclinedEmail({
            userName: buyerData.displayName || 'User',
            userEmail: buyerData.email || '',
            sellerName: sellerData.displayName || 'Seller',
            listingTitle: offerData.listingSnapshot?.title || 'Unknown Item',
            offerAmount: offerData.amount,
            actionUrl: `${baseUrl}/listings`
          });
          console.log('Offer declined email sent to buyer:', buyerData.email);
        } else if (status === 'countered') {
          // Create notification for buyer
          try {
            console.log('Creating counter offer notification for buyer:', offerData.buyerId);
            const notificationResponse = await fetch(`${baseUrl}/api/notifications/create`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                userId: offerData.buyerId,
                type: 'offer',
                title: '🔄 Counter Offer Received',
                message: `${sellerData.displayName || 'The seller'} made a counter offer of $${offerData.counterOffer?.toFixed(2) || 'N/A'} on "${offerData.listingSnapshot?.title || 'Unknown Item'}"`,
                data: {
                  offerId: offerId,
                  listingId: offerData.listingId,
                  actionUrl: `/dashboard/offers`
                }
              })
            });
            
            if (notificationResponse.ok) {
              const result = await notificationResponse.json();
              console.log('Counter offer notification created successfully:', result.notificationId);
            } else {
              const errorData = await notificationResponse.json();
              console.error('Failed to create counter offer notification:', errorData);
            }
          } catch (notificationError) {
            console.error('Error creating counter offer notification:', notificationError);
          }

          // Send counter offer email to buyer
          if (offerData.counterOffer) {
            await emailService.sendOfferCounterEmail({
              userName: buyerData.displayName || 'User',
              userEmail: buyerData.email || '',
              sellerName: sellerData.displayName || 'Seller',
              listingTitle: offerData.listingSnapshot?.title || 'Unknown Item',
              originalOfferAmount: offerData.amount,
              counterOfferAmount: offerData.counterOffer,
              actionUrl: `${baseUrl}/dashboard/offers`
            });
            console.log('Counter offer email sent to buyer:', buyerData.email);
          }
        }
      } catch (emailError) {
        console.error('Error sending offer status email:', emailError);
        // Don't fail the API call if email fails
      }
    }
    
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