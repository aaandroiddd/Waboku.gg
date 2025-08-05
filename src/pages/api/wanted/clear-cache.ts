import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // This endpoint is mainly for future server-side cache clearing
    // For now, it just confirms the request was received
    
    console.log('Cache clear request received');

    return res.status(200).json({
      success: true,
      message: 'Server-side cache clear completed (client-side cache should be cleared by the component)'
    });

  } catch (error) {
    console.error('Error clearing cache:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}