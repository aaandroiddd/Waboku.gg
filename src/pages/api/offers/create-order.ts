import { NextApiRequest, NextApiResponse } from 'next';
import { initializeFirebaseAdmin } from '@/lib/firebase-admin';
import { serverTimestamp } from 'firebase/firestore';

// Import email service for sending order confirmation emails
import { emailService } from '@/lib/email-service';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Initialize Firebase Admin
    const { admin, db } = initializeFirebaseAdmin();
    
    // Get the authorization token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('Missing or invalid authorization header');
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    const token = authHeader.split('Bearer ')[1];
    
    // Verify the token and get the user
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(token);
      console.log('Token verified for user:', decodedToken.uid);
    } catch (error: any) {
      console.error('Error verifying token:', error);
      return res.status(401).json({ message: 'Invalid authentication token' });
    }
    
    const userId = decodedToken.uid;
    
    // Get request body
    const { offerId, markAsSold } = req.body;
    
    if (!offerId) {
      return res.status(400).json({ message: 'Missing required field: offerId' });
    }
    
    console.log(`Processing order creation for offer ${offerId}, markAsSold=${markAsSold}`);
    
    // Get the offer document
    const offerRef = db.collection('offers').doc(offerId);
    const offerDoc = await offerRef.get();
    
    if (!offerDoc.exists) {
      return res.status(404).json({ message: 'Offer not found' });
    }
    
    const offerData = offerDoc.data();
    
    // Verify the user is the seller
    if (offerData?.sellerId !== userId) {
      return res.status(403).json({ message: 'Only the seller can create an order from an offer' });
    }
    
    // Verify the offer is accepted
    if (offerData?.status !== 'accepted') {
      return res.status(400).json({ message: 'Only accepted offers can be converted to orders' });
    }
    
    // Check if the seller has a Stripe Connect account
    const sellerDoc = await db.collection('users').doc(userId).get();
    const sellerData = sellerDoc.data();
    
    const hasStripeAccount = sellerData?.stripeConnectStatus === 'active' && 
                            sellerData?.stripeConnectAccountId ? true : false;
    
    // Generate a unique ID for the order (similar to Stripe format)
    const generateOrderId = () => {
      const prefix = 'pi_';
      const timestamp = Date.now().toString().substring(0, 10);
      const randomChars = Math.random().toString(36).substring(2, 10).toUpperCase();
      return `${prefix}${timestamp}${randomChars}`;
    };
    
    const customOrderId = generateOrderId();
    console.log(`Generated custom order ID: ${customOrderId}`);
    
    // Use shipping address from offer if available, otherwise use placeholder
    let shippingAddress;
    let isPickup = false;
    
    if (offerData.isPickup) {
      isPickup = true;
      shippingAddress = {
        name: 'Local Pickup',
        line1: 'To be arranged with seller',
        city: 'N/A',
        state: 'N/A',
        postal_code: 'N/A',
        country: 'N/A'
      };
    } else if (offerData.shippingAddress) {
      shippingAddress = offerData.shippingAddress;
    } else {
      // Fallback to placeholder
      shippingAddress = {
        name: 'To be provided by buyer',
        line1: 'Address pending',
        city: 'TBD',
        state: 'TBD',
        postal_code: 'TBD',
        country: 'TBD'
      };
    }
    
    // Create the order
    const orderData = {
      id: customOrderId, // Use the custom ID
      listingId: offerData.listingId,
      buyerId: offerData.buyerId,
      sellerId: offerData.sellerId,
      amount: offerData.amount,
      status: 'pending',
      shippingAddress: shippingAddress,
      isPickup: isPickup,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      listingSnapshot: offerData.listingSnapshot || {
        title: 'Unknown Listing',
        price: offerData.amount || 0,
        imageUrl: ''
      },
      offerPrice: offerData.amount, // Store the accepted offer price
      originalListingPrice: offerData.listingSnapshot?.price || offerData.amount, // Store the original listing price
      offerId: offerId, // Reference to the original offer
      sellerHasStripeAccount: hasStripeAccount, // Flag to indicate if the seller has a Stripe Connect account
      paymentRequired: !isPickup && hasStripeAccount, // Payment is required for shipping orders if seller has Stripe
      requiresShippingInfo: offerData.requiresShippingInfo || (!isPickup) // Flag to indicate if shipping info is required
    };
    
    // Create the order document with the custom ID
    console.log('Creating order document via server-side API with custom ID...');
    const orderRef = db.collection('orders').doc(customOrderId);
    await orderRef.set(orderData);
    const orderId = customOrderId;
    console.log('Order created with custom ID:', orderId);
    
    // Create references in user-specific subcollections for both buyer and seller
    console.log('Creating user-specific order references...');
    
    // Create buyer's order reference
    await db.collection('users').doc(offerData.buyerId).collection('orders').doc(orderId).set({
      orderId: orderId,
      role: 'buyer',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log(`Created buyer's order reference for user ${offerData.buyerId}`);
    
    // Create seller's order reference
    await db.collection('users').doc(offerData.sellerId).collection('orders').doc(orderId).set({
      orderId: orderId,
      role: 'seller',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log(`Created seller's order reference for user ${offerData.sellerId}`);
    
    // Mark the offer as cleared
    console.log('Marking offer as cleared...');
    await offerRef.update({
      cleared: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // If markAsSold is true, update the listing status to sold
    if (markAsSold) {
      console.log('Marking listing as sold...');
      const listingRef = db.collection('listings').doc(offerData.listingId);
      await listingRef.update({
        status: 'sold',
        soldTo: offerData.buyerId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    // Send order confirmation emails to both buyer and seller
    try {
      // Fetch buyer and seller user data
      const buyerUser = await admin.auth().getUser(offerData.buyerId);
      const sellerUser = await admin.auth().getUser(offerData.sellerId);

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://waboku.gg';
      const orderUrl = `${baseUrl}/dashboard/orders/${orderId}`;

      // Email to buyer
      if (buyerUser.email) {
        await emailService.sendOrderConfirmationEmail({
          userName: buyerUser.displayName || 'Buyer',
          userEmail: buyerUser.email,
          orderId: orderId,
          listingTitle: orderData.listingSnapshot?.title || 'Unknown Listing',
          listingImage: orderData.listingSnapshot?.imageUrl || '',
          amount: orderData.amount,
          role: 'buyer',
          actionUrl: orderUrl,
          sellerName: sellerUser.displayName || 'Seller',
          shippingAddress: orderData.shippingAddress,
          isPickup: orderData.isPickup,
        });
        console.log(`Order confirmation email sent to buyer: ${buyerUser.email}`);
      }

      // Email to seller
      if (sellerUser.email) {
        await emailService.sendOrderConfirmationEmail({
          userName: sellerUser.displayName || 'Seller',
          userEmail: sellerUser.email,
          orderId: orderId,
          listingTitle: orderData.listingSnapshot?.title || 'Unknown Listing',
          listingImage: orderData.listingSnapshot?.imageUrl || '',
          amount: orderData.amount,
          role: 'seller',
          actionUrl: orderUrl,
          buyerName: buyerUser.displayName || 'Buyer',
          shippingAddress: orderData.shippingAddress,
          isPickup: orderData.isPickup,
        });
        console.log(`Order confirmation email sent to seller: ${sellerUser.email}`);
      }
    } catch (emailError) {
      console.error('Error sending order confirmation emails:', emailError);
    }
    
    return res.status(200).json({ 
      success: true, 
      message: 'Order created successfully',
      orderId: orderId
    });
  } catch (error: any) {
    console.error('Error in create-order API:', error);
    return res.status(500).json({ 
      message: 'Failed to create order', 
      error: error.message 
    });
  }
}