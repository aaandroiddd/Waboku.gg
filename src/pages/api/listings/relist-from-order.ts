import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin, verifyIdToken } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Relist API: Starting request processing');
    const { orderId, idToken } = req.body;

    console.log('Relist API: Request body received', {
      hasOrderId: !!orderId,
      hasIdToken: !!idToken,
      idTokenLength: idToken ? idToken.length : 0
    });

    if (!orderId) {
      console.log('Relist API: Missing order ID');
      return res.status(400).json({ error: 'Order ID is required' });
    }

    if (!idToken) {
      console.log('Relist API: Missing ID token');
      return res.status(401).json({ error: 'No authorization token provided' });
    }

    console.log('Relist API: Attempting to verify ID token');
    const decodedToken = await verifyIdToken(idToken);
    console.log('Relist API: Token verified successfully for user:', decodedToken.uid);
    const userId = decodedToken.uid;

    const { db } = getFirebaseAdmin();

    // Get the user's current profile to ensure we have the correct username and account tier
    const userDoc = await db.collection('users').doc(userId).get();
    let currentUsername = 'Anonymous';
    let accountTier = 'free'; // Default to free tier
    
    if (userDoc.exists) {
      const userData = userDoc.data();
      currentUsername = userData?.username || userData?.displayName || 'Anonymous';
      accountTier = userData?.accountTier || 'free';
      console.log('Relist API: Retrieved current username:', currentUsername, 'and account tier:', accountTier);
    } else {
      console.log('Relist API: User document not found, using defaults');
    }

    // Get the order to verify ownership and get listing data
    const orderDoc = await db.collection('orders').doc(orderId).get();
    
    if (!orderDoc.exists) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const orderData = orderDoc.data();

    // Verify that the current user is the seller of this order
    if (orderData.sellerId !== userId) {
      return res.status(403).json({ error: 'You can only relist your own items' });
    }

    // Verify that the order has a completed refund
    if (orderData.refundStatus !== 'completed') {
      return res.status(400).json({ error: 'Can only relist items from completed refunds' });
    }

    // Get the listing snapshot from the order
    const listingSnapshot = orderData.listingSnapshot;
    if (!listingSnapshot) {
      return res.status(400).json({ error: 'No listing information available to relist' });
    }

    // Try to get the original listing for more complete data
    let originalListing = null;
    try {
      if (orderData.listingId) {
        const originalListingDoc = await db.collection('listings').doc(orderData.listingId).get();
        if (originalListingDoc.exists) {
          originalListing = originalListingDoc.data();
          console.log('Relist API: Found original listing for more complete data');
        }
      }
    } catch (error) {
      console.log('Relist API: Could not fetch original listing, using snapshot only:', error.message);
    }

    // Use original listing data if available, otherwise fall back to snapshot
    const sourceData = originalListing || listingSnapshot;

    // Calculate expiration date based on account tier
    // Free tier: 48 hours, Premium tier: 720 hours (30 days)
    const tierDuration = accountTier === 'premium' ? 720 : 48;
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + tierDuration);

    // Handle image URLs properly - ensure we have valid image data
    let imageUrls = [];
    let imageUrl = '';

    if (sourceData.imageUrls && Array.isArray(sourceData.imageUrls)) {
      imageUrls = sourceData.imageUrls.filter(url => url && typeof url === 'string');
    } else if (sourceData.imageUrl && typeof sourceData.imageUrl === 'string') {
      imageUrls = [sourceData.imageUrl];
    }

    // Set the primary image URL
    if (imageUrls.length > 0) {
      imageUrl = imageUrls[0];
    }

    console.log('Relist API: Image handling:', {
      hasOriginalListing: !!originalListing,
      sourceImageUrls: sourceData.imageUrls,
      sourceImageUrl: sourceData.imageUrl,
      processedImageUrls: imageUrls,
      primaryImageUrl: imageUrl
    });

    // Create a new listing based on the source data - ensure it matches the exact structure of manually created listings
    const newListingData = {
      // Core listing information
      title: sourceData.title || '',
      description: sourceData.description || 'No description provided for this listing.',
      price: typeof sourceData.price === 'string' ? sourceData.price : String(sourceData.price || 0),
      game: sourceData.game || 'other',
      condition: sourceData.condition || 'near_mint',
      
      // Image handling - use processed image data
      imageUrl: imageUrl,
      imageUrls: imageUrls,
      
      // User and authentication fields - CRITICAL for dashboard visibility
      userId: userId, // This must match exactly what the dashboard queries for
      username: currentUsername, // Use current user's username
      
      // Status and timestamps - use server timestamps for consistency
      status: 'active',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt: expiresAt, // Set expiration based on account tier
      
      // Account and tier information - CRITICAL for listing visibility
      accountTier: accountTier,
      
      // Counters and metrics
      views: 0,
      favorites: 0,
      
      // Grading information
      isGraded: Boolean(sourceData.isGraded),
      gradeLevel: sourceData.gradeLevel ? Number(sourceData.gradeLevel) : null,
      gradingCompany: sourceData.gradingCompany || null,
      
      // Sale and quantity information
      finalSale: Boolean(sourceData.finalSale),
      quantity: typeof sourceData.quantity === 'number' ? sourceData.quantity : 1,
      offersOnly: Boolean(sourceData.offersOnly),
      
      // Location information
      city: sourceData.city || '',
      state: sourceData.state || '',
      
      // Additional card details (conditionally include only if they exist)
      ...(sourceData.cardNumber && { cardNumber: sourceData.cardNumber }),
      ...(sourceData.setName && { setName: sourceData.setName }),
      ...(sourceData.rarity && { rarity: sourceData.rarity }),
      ...(sourceData.language && { language: sourceData.language }),
      ...(sourceData.foil && { foil: sourceData.foil }),
      ...(sourceData.edition && { edition: sourceData.edition }),
      ...(sourceData.cardReference && { cardReference: sourceData.cardReference }),
      
      // Ensure all archive-related fields are explicitly null for active listings
      archivedAt: null,
      originalCreatedAt: null,
      previousStatus: null,
      previousExpiresAt: null,
      soldTo: null,
      expirationReason: null,
    };

    console.log('Relist API: Creating new listing with data:', {
      userId: newListingData.userId,
      username: newListingData.username,
      accountTier: newListingData.accountTier,
      status: newListingData.status,
      title: newListingData.title,
      price: newListingData.price,
      game: newListingData.game,
      hasImageUrls: newListingData.imageUrls?.length > 0,
      expiresAt: newListingData.expiresAt
    });

    // Create the new listing
    const newListingRef = await db.collection('listings').add(newListingData);

    console.log(`Successfully relisted item from order ${orderId} as new listing ${newListingRef.id}`);

    // Verify the listing was created correctly by reading it back
    const createdListingDoc = await db.collection('listings').doc(newListingRef.id).get();
    if (createdListingDoc.exists) {
      const createdData = createdListingDoc.data();
      console.log('Relist API: Verified created listing data:', {
        id: newListingRef.id,
        userId: createdData?.userId,
        username: createdData?.username,
        accountTier: createdData?.accountTier,
        status: createdData?.status,
        title: createdData?.title,
        createdAt: createdData?.createdAt,
        expiresAt: createdData?.expiresAt,
        archivedAt: createdData?.archivedAt,
        originalCreatedAt: createdData?.originalCreatedAt,
        previousStatus: createdData?.previousStatus,
        previousExpiresAt: createdData?.previousExpiresAt,
        soldTo: createdData?.soldTo,
        expirationReason: createdData?.expirationReason
      });
      
      // Additional verification: Check if this listing would be visible in a dashboard query
      console.log('Relist API: Dashboard visibility check:', {
        hasUserId: !!createdData?.userId,
        userIdMatches: createdData?.userId === userId,
        statusIsActive: createdData?.status === 'active',
        hasAccountTier: !!createdData?.accountTier,
        hasUsername: !!createdData?.username,
        allArchiveFieldsNull: (
          createdData?.archivedAt === null &&
          createdData?.originalCreatedAt === null &&
          createdData?.previousStatus === null &&
          createdData?.previousExpiresAt === null &&
          createdData?.soldTo === null &&
          createdData?.expirationReason === null
        )
      });
    } else {
      console.error('Relist API: Failed to verify created listing');
    }

    return res.status(200).json({ 
      success: true, 
      listingId: newListingRef.id,
      message: 'Item successfully relisted',
      debug: {
        userId: newListingData.userId,
        username: newListingData.username,
        accountTier: newListingData.accountTier,
        status: newListingData.status
      }
    });

  } catch (error) {
    console.error('Relist API: Error relisting item:', error);
    
    // Provide more specific error details for debugging
    if (error instanceof Error) {
      console.error('Relist API: Error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack?.split('\n').slice(0, 3).join('\n')
      });
      
      // Check for specific Firebase Admin errors
      if (error.message.includes('Firebase ID token') || 
          error.message.includes('Token used too early') ||
          error.message.includes('Token expired') ||
          error.message.includes('Invalid token')) {
        return res.status(401).json({ 
          error: 'Authentication failed',
          details: 'Invalid or expired authentication token. Please try logging out and back in.'
        });
      }
      
      if (error.message.includes('Missing or insufficient permissions')) {
        return res.status(403).json({ 
          error: 'Permission denied',
          details: 'You do not have permission to perform this action.'
        });
      }
    }
    
    return res.status(500).json({ 
      error: 'Failed to relist item',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}