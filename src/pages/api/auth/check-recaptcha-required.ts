import { NextApiRequest, NextApiResponse } from 'next';

// Simple in-memory store for failed attempts (in production, use Redis or database)
const failedAttempts = new Map<string, { count: number; lastAttempt: number; blocked: boolean }>();

// Clean up old entries every hour
setInterval(() => {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  
  for (const [key, data] of failedAttempts.entries()) {
    if (now - data.lastAttempt > oneHour) {
      failedAttempts.delete(key);
    }
  }
}, 60 * 60 * 1000);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    // Get client IP for rate limiting
    const clientIP = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || 
                     req.headers['x-real-ip'] as string || 
                     req.socket.remoteAddress || 
                     'unknown';

    // Create keys for tracking attempts
    const emailKey = `email:${email.toLowerCase()}`;
    const ipKey = `ip:${clientIP}`;

    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    const oneHour = 60 * 60 * 1000;

    // Check failed attempts for this email
    const emailAttempts = failedAttempts.get(emailKey);
    const ipAttempts = failedAttempts.get(ipKey);

    let required = false;
    let reason = '';

    // Require reCAPTCHA if there have been multiple failed attempts from this email
    if (emailAttempts && emailAttempts.count >= 3) {
      required = true;
      reason = 'Multiple failed sign-in attempts detected for this email';
    }

    // Require reCAPTCHA if there have been multiple failed attempts from this IP
    if (ipAttempts && ipAttempts.count >= 5) {
      required = true;
      reason = 'Multiple failed sign-in attempts detected from this device';
    }

    // Check for suspicious patterns (many attempts in short time)
    if (emailAttempts && emailAttempts.count >= 2 && (now - emailAttempts.lastAttempt) < fiveMinutes) {
      required = true;
      reason = 'Rapid sign-in attempts detected';
    }

    // For new devices/IPs with no history, we might want to require reCAPTCHA
    // This is optional and can be enabled based on security requirements
    const isNewDevice = !ipAttempts;
    const requireForNewDevices = false; // Set to true if you want to require reCAPTCHA for all new devices

    if (requireForNewDevices && isNewDevice) {
      required = true;
      reason = 'Security verification required for new device';
    }

    return res.status(200).json({
      success: true,
      required,
      reason,
      // Optional: provide additional context for debugging
      debug: process.env.NODE_ENV === 'development' ? {
        emailAttempts: emailAttempts?.count || 0,
        ipAttempts: ipAttempts?.count || 0,
        isNewDevice,
        clientIP: clientIP === 'unknown' ? 'unknown' : 'hidden'
      } : undefined
    });

  } catch (error) {
    console.error('Error checking reCAPTCHA requirement:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      // Default to requiring reCAPTCHA on error for security
      required: true,
      reason: 'Security verification required'
    });
  }
}

// Helper function to record a failed authentication attempt
export function recordFailedAttempt(email: string, clientIP: string) {
  const now = Date.now();
  const emailKey = `email:${email.toLowerCase()}`;
  const ipKey = `ip:${clientIP}`;

  // Update email-based tracking
  const emailAttempts = failedAttempts.get(emailKey) || { count: 0, lastAttempt: 0, blocked: false };
  emailAttempts.count += 1;
  emailAttempts.lastAttempt = now;
  failedAttempts.set(emailKey, emailAttempts);

  // Update IP-based tracking
  const ipAttempts = failedAttempts.get(ipKey) || { count: 0, lastAttempt: 0, blocked: false };
  ipAttempts.count += 1;
  ipAttempts.lastAttempt = now;
  failedAttempts.set(ipKey, ipAttempts);

  console.log(`Recorded failed attempt for email: ${email}, IP: ${clientIP}`);
}

// Helper function to clear failed attempts on successful login
export function clearFailedAttempts(email: string, clientIP: string) {
  const emailKey = `email:${email.toLowerCase()}`;
  const ipKey = `ip:${clientIP}`;

  failedAttempts.delete(emailKey);
  failedAttempts.delete(ipKey);

  console.log(`Cleared failed attempts for email: ${email}, IP: ${clientIP}`);
}