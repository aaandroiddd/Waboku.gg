import { NextApiRequest, NextApiResponse } from 'next';
import { securityMonitor } from '@/lib/security-monitor';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      message: 'Method not allowed' 
    });
  }

  try {
    const { email } = req.body;
    
    // Get client IP address
    const ip = req.headers['x-forwarded-for'] as string || 
              req.headers['x-real-ip'] as string || 
              req.connection.remoteAddress || 
              req.socket.remoteAddress || 
              'unknown';

    const userAgent = req.headers['user-agent'];

    // Check if reCAPTCHA should be required
    const recaptchaCheck = await securityMonitor.shouldRequireRecaptcha(email, ip);
    
    // For sign-in, also check if device is recognized
    let isRecognizedDevice = false;
    if (email) {
      isRecognizedDevice = await securityMonitor.isRecognizedDevice(email, userAgent, ip);
    }

    // Require reCAPTCHA if:
    // 1. Security monitor says it's required, OR
    // 2. Device is not recognized (for sign-in)
    const shouldRequire = recaptchaCheck.required || (!isRecognizedDevice && email);

    return res.status(200).json({
      success: true,
      required: shouldRequire,
      reason: recaptchaCheck.reason || ((!isRecognizedDevice && email) ? 'Unrecognized device' : undefined),
      isRecognizedDevice
    });

  } catch (error) {
    console.error('Error checking reCAPTCHA requirement:', error);
    
    // Default to requiring reCAPTCHA on error for security
    return res.status(200).json({
      success: true,
      required: true,
      reason: 'Security check failed'
    });
  }
}