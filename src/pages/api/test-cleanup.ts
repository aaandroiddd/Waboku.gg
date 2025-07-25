import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('[TestCleanup] Starting test cleanup request...');
    
    // Get the authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization token required' });
    }

    const token = authHeader.split('Bearer ')[1];
    console.log('[TestCleanup] Token received, length:', token ? token.length : 0);
    
    // Simple token validation without Firebase Admin
    if (!token || token.length < 100) {
      return res.status(401).json({ error: 'Invalid token format' });
    }
    
    // Mock cleanup response for testing
    return res.status(200).json({
      success: true,
      cleaned: 0,
      errors: [],
      message: 'Test cleanup completed - no orphaned threads found',
      debug: {
        tokenLength: token.length,
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV
      }
    });

  } catch (error: any) {
    console.error('[TestCleanup] Unexpected error:', error.message);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}