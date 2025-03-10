import type { NextApiRequest, NextApiResponse } from 'next';

type LogLevel = 'info' | 'warn' | 'error';

interface LogRequest {
  message: string;
  data?: any;
  level?: LogLevel;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, data, level = 'info' } = req.body as LogRequest;

    // Format the log message
    const timestamp = new Date().toISOString();
    const formattedData = data ? JSON.stringify(data, null, 2) : '';
    
    // Log to console based on level
    switch (level) {
      case 'error':
        console.error(`[${timestamp}] ERROR: ${message}`, formattedData ? `\n${formattedData}` : '');
        break;
      case 'warn':
        console.warn(`[${timestamp}] WARN: ${message}`, formattedData ? `\n${formattedData}` : '');
        break;
      case 'info':
      default:
        console.log(`[${timestamp}] INFO: ${message}`, formattedData ? `\n${formattedData}` : '');
        break;
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error in log API:', error);
    return res.status(500).json({ error: 'Failed to log message' });
  }
}