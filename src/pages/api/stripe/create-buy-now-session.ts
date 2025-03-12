import { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { getFirebaseServices } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { listingId, userId } = req.body;

    if (!listingId || !userId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const { db } = getFirebaseServices();
    const listingRef = doc(db, 'listings', listingId);
    const listingDoc = await getDoc(listingRef);

    if (!listingDoc.exists()) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    const listingData = listingDoc.data();

    // Check if the listing is still available
    if (listingData.status === 'sold' || listingData.status === 'archived') {
      return res.status(400).json({ error: 'Listing is no longer available' });
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: listingData.title,
              images: listingData.imageUrls ? [listingData.imageUrls[0]] : [],
              description: listingData.description || undefined,
            },
            unit_amount: Math.round(listingData.price * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/orders?success=true&session_id={CHECKOUT_SESSION_ID}&ensure_order=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/listings/${listingId}?canceled=true`,
      metadata: {
        listingId,
        buyerId: userId,
        sellerId: listingData.userId,
      },
      shipping_address_collection: {
        allowed_countries: ['US'],
      },
      customer_email: req.body.email,
    });

    res.status(200).json({ sessionId: session.id });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: 'Error creating checkout session' });
  }
}