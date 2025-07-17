import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('[Admin Verify] Starting verification process');

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[Admin Verify] Missing or invalid authorization header');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.split(' ')[1];
    console.log('[Admin Verify] Token received, length:', token.length);

    // Check if it's the admin secret
    const adminSecret = process.env.ADMIN_SECRET;
    if (!adminSecret) {
      console.error('[Admin Verify] ADMIN_SECRET environment variable not set');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    if (token === adminSecret) {
      console.log('[Admin Verify] Admin secret matched');
      return res.status(200).json({ 
        success: true, 
        isAdmin: true, 
        isModerator: false,
        method: 'admin_secret'
      });
    }

    console.log('[Admin Verify] Admin secret did not match');
    return res.status(401).json({ error: 'Invalid admin secret' });

  } catch (error: any) {
    console.error('[Admin Verify] General error:', {
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 3).join('\n')
    });
    return res.status(500).json({ error: 'Internal server error' });
  }
}