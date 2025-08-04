import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;

    return res.status(200).json({
      success: true,
      config: {
        hasSiteKey: !!siteKey,
        hasSecretKey: !!secretKey,
        siteKeyLength: siteKey ? siteKey.length : 0,
        secretKeyLength: secretKey ? secretKey.length : 0,
        siteKeyPrefix: siteKey ? siteKey.substring(0, 10) + '...' : 'not set',
        // Don't expose the actual keys for security
      }
    });

  } catch (error) {
    console.error('Error checking reCAPTCHA config:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}