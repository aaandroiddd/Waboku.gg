import { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify admin secret for security
  const adminSecret = req.headers['x-admin-secret'];
  if (adminSecret !== process.env.ADMIN_SECRET) {
    console.error('Invalid admin secret provided');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'Missing STRIPE_SECRET_KEY' });
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    });

    // Get webhook endpoints
    const webhookEndpoints = await stripe.webhookEndpoints.list();

    // Check if our webhook endpoint exists
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    const expectedWebhookUrl = `${appUrl}/api/stripe/webhook`;
    
    const matchingEndpoint = webhookEndpoints.data.find(
      endpoint => endpoint.url === expectedWebhookUrl
    );

    // Get recent events to check if they're being received
    const events = await stripe.events.list({ limit: 5 });

    return res.status(200).json({
      webhookEndpoints: webhookEndpoints.data.map(endpoint => ({
        id: endpoint.id,
        url: endpoint.url,
        status: endpoint.status,
        enabledEvents: endpoint.enabled_events,
        created: new Date(endpoint.created * 1000).toISOString(),
      })),
      expectedWebhookUrl,
      webhookConfigured: !!matchingEndpoint,
      recentEvents: events.data.map(event => ({
        id: event.id,
        type: event.type,
        created: new Date(event.created * 1000).toISOString(),
        apiVersion: event.api_version,
      })),
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ? 'Configured' : 'Missing',
    });
  } catch (error) {
    console.error('Error checking Stripe webhook:', error);
    return res.status(500).json({ 
      error: 'Failed to check Stripe webhook',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}