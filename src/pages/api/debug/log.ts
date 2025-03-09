import { NextApiRequest, NextApiResponse } from 'next';

type LogLevel = 'info' | 'warn' | 'error';

interface LogRequest {
  message: string;
  data?: any;
  level?: LogLevel;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, data, level = 'error' } = req.body as LogRequest;

    // Validate required fields
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Format the log message with timestamp and request ID
    const timestamp = new Date().toISOString();
    const requestId = req.headers['x-request-id'] || Math.random().toString(36).substring(2, 15);
    const logPrefix = `[${timestamp}][REQ:${requestId}][CLIENT LOG][${level.toUpperCase()}]`;
    
    // Log the message with appropriate level
    switch (level) {
      case 'info':
        console.info(`${logPrefix} ${message}`, data || '');
        break;
      case 'warn':
        console.warn(`${logPrefix} ${message}`, data || '');
        break;
      case 'error':
      default:
        console.error(`${logPrefix} ${message}`, data || '');
        break;
    }

    // For wanted posts related logs, add extra debugging
    if (message.includes('wanted post') || message.includes('wantedPosts')) {
      console.info(`${logPrefix} WANTED POST DEBUG: Firebase config status:`, {
        databaseURL: !!process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
        projectId: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
      });
    }

    return res.status(200).json({ success: true, requestId });
  } catch (error) {
    console.error('Error in debug log API:', error);
    return res.status(500).json({ error: 'Failed to log message' });
  }
}