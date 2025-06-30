import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { step, data } = req.body;
    
    console.log(`[Save Flow Debug] Step: ${step}`, data);
    
    // Log the current state for debugging
    const debugInfo = {
      step,
      timestamp: new Date().toISOString(),
      data,
      headers: {
        'user-agent': req.headers['user-agent'],
        'referer': req.headers.referer
      }
    };
    
    return res.status(200).json({
      success: true,
      debugInfo
    });
  } catch (error) {
    console.error('[Save Flow Debug] Error:', error);
    return res.status(500).json({
      error: 'Debug logging failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}