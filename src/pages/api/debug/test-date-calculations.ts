import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const now = new Date();
    
    // Test various date scenarios
    const testCases = [
      {
        name: "July 21st archived",
        archivedAt: new Date('2024-07-21T00:00:00Z'),
      },
      {
        name: "July 20th archived", 
        archivedAt: new Date('2024-07-20T00:00:00Z'),
      },
      {
        name: "July 19th archived",
        archivedAt: new Date('2024-07-19T00:00:00Z'),
      },
      {
        name: "July 27th archived (today)",
        archivedAt: new Date('2024-07-27T00:00:00Z'),
      }
    ];

    const results = testCases.map(testCase => {
      const expiresAt = new Date(testCase.archivedAt.getTime() + (7 * 24 * 60 * 60 * 1000));
      const isExpired = now > expiresAt;
      const timeUntilExpiry = expiresAt.getTime() - now.getTime();
      
      return {
        ...testCase,
        archivedAtISO: testCase.archivedAt.toISOString(),
        expiresAtISO: expiresAt.toISOString(),
        currentTimeISO: now.toISOString(),
        isExpired,
        timeUntilExpiryHours: Math.round(timeUntilExpiry / (1000 * 60 * 60)),
        timeUntilExpiryDays: Math.round(timeUntilExpiry / (1000 * 60 * 60 * 24))
      };
    });

    return res.status(200).json({
      message: "Date calculation test results",
      currentTime: now.toISOString(),
      currentTimeReadable: now.toString(),
      testResults: results
    });
  } catch (error: any) {
    return res.status(500).json({
      error: 'Failed to test date calculations',
      details: error.message
    });
  }
}