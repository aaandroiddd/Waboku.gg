import { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';

// Initialize Stripe
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
  console.log('[Admin Webhook Fix Trigger] Request received');

  // Verify admin secret
  const adminSecret = req.headers['x-admin-secret'];
  if (adminSecret !== process.env.ADMIN_SECRET) {
    console.error('[Admin Webhook Fix Trigger] Invalid admin secret');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { sessionId, signature } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: 'Session ID is required' });
  }

  try {
    // Retrieve the session from Stripe to get the necessary metadata
    console.log(`[Admin Webhook Fix Trigger] Retrieving session: ${sessionId}`);
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Check if this is a marketplace purchase session
    if (!session.metadata?.listingId || !session.metadata?.buyerId || !session.metadata?.sellerId) {
      return res.status(400).json({ 
        error: 'Invalid session',
        message: 'This session does not appear to be a marketplace purchase (missing required metadata)',
        sessionMetadata: session.metadata || {}
      });
    }

    // Prepare the request to the webhook-fix endpoint
    const webhookUrl = new URL('/api/stripe/webhook-fix', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000');
    
    // Create a mock event payload
    const mockEvent = {
      id: `evt_admin_${Date.now()}`,
      object: 'event',
      api_version: '2023-10-16',
      type: 'checkout.session.completed',
      data: {
        object: session
      }
    };

    // Convert the event to a buffer (similar to what Stripe would send)
    const eventBuffer = Buffer.from(JSON.stringify(mockEvent));
    
    // If a signature was provided, use it, otherwise generate one
    let stripeSignature = signature;
    if (!stripeSignature && process.env.STRIPE_WEBHOOK_SECRET) {
      // Generate a valid signature using the webhook secret
      // This is a simplified version and may not work with actual webhook verification
      // In a real scenario, Stripe generates this signature with specific algorithms
      const timestamp = Math.floor(Date.now() / 1000);
      const payload = `${timestamp}.${eventBuffer.toString()}`;
      stripeSignature = `t=${timestamp},v1=mock_signature_for_admin_use_only`;
    }

    // Make the request to the webhook-fix endpoint
    console.log('[Admin Webhook Fix Trigger] Calling webhook-fix endpoint');
    const webhookResponse = await fetch(webhookUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': stripeSignature || 'mock_signature_for_admin_use_only'
      },
      body: eventBuffer
    });

    const webhookResult = await webhookResponse.json();

    return res.status(200).json({
      success: true,
      message: 'Webhook fix triggered successfully',
      sessionId,
      webhookResponse: {
        status: webhookResponse.status,
        result: webhookResult
      },
      session: {
        id: session.id,
        metadata: session.metadata,
        amount_total: session.amount_total,
        payment_intent: session.payment_intent,
        customer: session.customer
      }
    });
  } catch (error) {
    console.error('[Admin Webhook Fix Trigger] Error:', error);
    return res.status(500).json({
      error: 'Failed to trigger webhook fix',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}