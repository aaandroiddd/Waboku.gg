import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, data, level = 'error' } = req.body;

    // Log the message with appropriate level
    switch (level) {
      case 'info':
        console.info(`[CLIENT LOG] ${message}`, data);
        break;
      case 'warn':
        console.warn(`[CLIENT LOG] ${message}`, data);
        break;
      case 'error':
      default:
        console.error(`[CLIENT LOG] ${message}`, data);
        break;
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error in debug log API:', error);
    return res.status(500).json({ error: 'Failed to log message' });
  }
}