import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { verifyAuthToken } from '@/lib/auth-utils';
import * as admin from 'firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { notificationService } from '@/lib/notification-service';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('POST /api/offers/create-secure START');
  
  if (req.method !== 'POST') {
    console.log('Method not allowed:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // SECURITY FIX: Verify authentication token
    const authResult = await verifyAuthToken(req);
    if (!authResult.success) {
      console.error('Authentication failed:', authResult.error);
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const userId = authResult.uid!;
    console.log(`Authenticated user: ${userId}`);

    // Get the request body
    const { listingId, sellerId, amount, listingSnapshot, shippingAddress, isPickup, requiresShippingInfo } = req.body;
    console.log('Request body:', { 
      listingId, 
      sellerId, 
      amount, 
      listingSnapshot: listingSnapshot ? {
        title: listingSnapshot.title,
        price: listingSnapshot.price,
        hasImage: !!listingSnapshot.imageUrl
      } : null,
      hasShippingAddress: !!shippingAddress,
      isPickup: !!isPickup,
      requiresShippingInfo: !!requiresShippingInfo
    });

    // SECURITY FIX: Validate required fields
    if (!listingId || !sellerId || amount === undefined || amount === null) {
      console.error('Missing required fields in request body:', { 
        hasListingId: !!listingId, 
        hasSellerId: !!sellerId, 
        amount: amount 
      });
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!listingSnapshot) {
      console.error('Missing listingSnapshot in request body');
      return res.status(400).json({ error: 'Missing listing snapshot data' });
    }

    // SECURITY FIX: Validate offer amount
    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      console.error('Invalid amount value:', amount);
      return res.status(400).json({ error: 'Offer amount must be a positive number' });
    }

    // SECURITY FIX: Validate amount is reasonable (not too high)
    if (numericAmount > 50000) {
      console.error('Amount too high:', numericAmount);
      return res.status(400).json({ error: 'Offer amount exceeds maximum allowed' });
    }

    // SECURITY FIX: Prevent users from making offers on their own listings
    if (userId === sellerId) {
      console.error('User attempted to make an offer on their own listing');
      return res.status(400).json({ error: 'You cannot make an offer on your own listing' });
    }

    // Initialize Firebase Admin
    const firebaseAdminInstance = getFirebaseAdmin();
    const auth = getAuth();
    const db = getFirestore();
    
    // SECURITY FIX: Verify the listing exists and get its actual price
    console.log(`Verifying listing ${listingId} exists and getting actual price`);
    const listingDoc = await db.collection('listings').doc(listingId).get();
    
    if (!listingDoc.exists) {
      console.error(`Listing ${listingId} not found`);
      return res.status(404).json({ error: 'Listing not found' });
    }
    
    const listingData = listingDoc.data()!;
    
    // SECURITY FIX: Verify the seller ID matches the listing
    if (listingData.userId !== sellerId) {
      console.error(`Seller ID mismatch: listing owner ${listingData.userId} vs provided ${sellerId}`);
      return res.status(400).json({ error: 'Invalid seller ID' });
    }
    
    // SECURITY FIX: Verify listing is active
    if (listingData.status !== 'active') {
      console.error(`Listing ${listingId} is not active: ${listingData.status}`);
      return res.status(400).json({ error: 'Listing is not available for offers' });
    }
    
    // SECURITY FIX: Validate offer amount against listing price
    const listingPrice = typeof listingData.price === 'string' ? parseFloat(listingData.price) : listingData.price;
    
    if (numericAmount > listingPrice * 2) {
      console.error(`Offer amount ${numericAmount} is too high compared to listing price ${listingPrice}`);
      return res.status(400).json({ error: 'Offer amount is unreasonably high' });
    }
    
    // Check if the user already has an active offer for this listing
    try {
      console.log(`Checking for existing offers from buyer ${userId} for listing ${listingId}`);
      const existingOffersQuery = await db.collection('offers')
        .where('buyerId', '==', userId)
        .where('listingId', '==', listingId)
        .where('status', '==', 'pending')
        .get();
      
      if (!existingOffersQuery.empty) {
        console.log(`Found existing pending offer from buyer ${userId} for listing ${listingId}`);
        return res.status(400).json({ 
          error: 'You already have an active offer for this listing',
          message: 'You can only have one active offer per listing at a time'
        });
      }
    } catch (checkError: any) {
      console.error('Error checking for existing offers:', checkError);
      // Continue with offer creation even if check fails
    }
    
    // SECURITY FIX: Use verified listing data instead of client-provided snapshot
    const verifiedListingSnapshot = {
      title: listingData.title || 'Unknown Listing',
      price: listingPrice || 0,
      imageUrl: listingData.imageUrls && listingData.imageUrls.length > 0 ? listingData.imageUrls[0] : '',
    };
    
    const offerData = {
      listingId,
      buyerId: userId,
      sellerId,
      amount: numericAmount,
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
      listingSnapshot: verifiedListingSnapshot, // Use verified data
      shippingAddress: shippingAddress || null,
      isPickup: isPickup || false,
      requiresShippingInfo: requiresShippingInfo || false,
      shippingInfoProvided: false
    };
    
    console.log('Creating offer with verified data...');
    const offerRef = await db.collection('offers').add(offerData);
    console.log(`Successfully created offer with ID: ${offerRef.id}`);

    // Create notification for the seller
    try {
      console.log('Creating offer notification for seller:', sellerId);
      const buyerData = await auth.getUser(userId);
      const buyerName = buyerData.displayName || 'Someone';
      
      const notificationResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/notifications/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: sellerId,
          type: 'offer',
          title: '💰 New Offer Received',
          message: `${buyerName} made an offer of $${numericAmount.toFixed(2)} on "${verifiedListingSnapshot.title}"`,
          data: {
            offerId: offerRef.id,
            listingId: listingId,
            actionUrl: `/dashboard/offers`
          }
        })
      });
      
      if (notificationResponse.ok) {
        const result = await notificationResponse.json();
        console.log('Offer notification created successfully:', result.notificationId);
      } else {
        const errorData = await notificationResponse.json();
        console.error('Failed to create offer notification:', errorData);
      }
    } catch (notificationError) {
      console.error('Error creating offer notification:', notificationError);
    }

    // Send email notification for new offer
    try {
      console.log('Sending offer received email to seller:', sellerId);
      const sellerData = await auth.getUser(sellerId);
      const buyerData = await auth.getUser(userId);
      
      if (sellerData.email) {
        const { emailService } = require('@/lib/email-service');
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://waboku.gg';
        
        await emailService.sendOfferReceivedEmail({
          userName: sellerData.displayName || 'User',
          userEmail: sellerData.email,
          buyerName: buyerData.displayName || 'Someone',
          listingTitle: verifiedListingSnapshot.title,
          offerAmount: numericAmount,
          listingPrice: listingPrice,
          actionUrl: `${baseUrl}/dashboard/offers`
        });
        console.log('Offer received email sent successfully to:', sellerData.email);
      }
    } catch (emailError) {
      console.error('Error sending offer received email:', emailError);
    }

    return res.status(201).json({ 
      success: true, 
      offerId: offerRef.id,
      message: 'Offer created successfully' 
    });
    
  } catch (error: any) {
    console.error('Unhandled error creating offer:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code
    });
    
    return res.status(500).json({ 
      error: 'Failed to create offer',
      details: error.message
    });
  } finally {
    console.log('POST /api/offers/create-secure END');
  }
}