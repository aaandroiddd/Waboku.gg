import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const now = new Date();
    
    // Get current time in various formats
    const timeInfo = {
      serverTime: now.toISOString(),
      serverTimeReadable: now.toString(),
      serverTimeUTC: now.toUTCString(),
      serverTimestamp: now.getTime(),
      
      // Test specific dates mentioned in the issue
      july21: new Date('2024-07-21T00:00:00Z').toISOString(),
      july27: new Date('2024-07-27T00:00:00Z').toISOString(),
      
      // Calculate if July 21 + 7 days is in the future
      july21Plus7Days: new Date(new Date('2024-07-21T00:00:00Z').getTime() + (7 * 24 * 60 * 60 * 1000)).toISOString(),
      isJuly21Plus7DaysInFuture: now < new Date(new Date('2024-07-21T00:00:00Z').getTime() + (7 * 24 * 60 * 60 * 1000)),
      
      // Show the actual calculation
      july21Timestamp: new Date('2024-07-21T00:00:00Z').getTime(),
      july21Plus7DaysTimestamp: new Date('2024-07-21T00:00:00Z').getTime() + (7 * 24 * 60 * 60 * 1000),
      currentTimestamp: now.getTime(),
      
      // Environment info
      nodeEnv: process.env.NODE_ENV,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    };

    return res.status(200).json({
      message: "Current time and date calculation test",
      timeInfo
    });
  } catch (error: any) {
    return res.status(500).json({
      error: 'Failed to get time info',
      details: error.message
    });
  }
}