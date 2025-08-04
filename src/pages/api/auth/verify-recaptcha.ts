import { NextApiRequest, NextApiResponse } from 'next';

interface RecaptchaVerificationResponse {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  'error-codes'?: string[];
  score?: number;
  action?: string;
}

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

  const { token, action } = req.body;

  if (!token) {
    return res.status(400).json({ 
      success: false, 
      message: 'reCAPTCHA token is required' 
    });
  }

  const secretKey = process.env.RECAPTCHA_SECRET_KEY;
  if (!secretKey) {
    console.error('reCAPTCHA secret key is not configured');
    return res.status(500).json({ 
      success: false, 
      message: 'reCAPTCHA is not properly configured' 
    });
  }

  try {
    // Verify the reCAPTCHA token with Google
    const verificationUrl = 'https://www.google.com/recaptcha/api/siteverify';
    const verificationData = new URLSearchParams({
      secret: secretKey,
      response: token,
      remoteip: req.headers['x-forwarded-for'] as string || 
                req.headers['x-real-ip'] as string || 
                req.connection.remoteAddress || 
                req.socket.remoteAddress || 
                'unknown'
    });

    const verificationResponse = await fetch(verificationUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: verificationData.toString(),
    });

    if (!verificationResponse.ok) {
      throw new Error(`HTTP error! status: ${verificationResponse.status}`);
    }

    const verificationResult: RecaptchaVerificationResponse = await verificationResponse.json();

    console.log('reCAPTCHA verification result:', {
      success: verificationResult.success,
      hostname: verificationResult.hostname,
      errorCodes: verificationResult['error-codes'],
      action: action || 'not-specified'
    });

    if (!verificationResult.success) {
      const errorCodes = verificationResult['error-codes'] || [];
      let errorMessage = 'reCAPTCHA verification failed';

      // Provide more specific error messages based on error codes
      if (errorCodes.includes('missing-input-secret')) {
        errorMessage = 'reCAPTCHA secret key is missing';
      } else if (errorCodes.includes('invalid-input-secret')) {
        errorMessage = 'reCAPTCHA secret key is invalid';
      } else if (errorCodes.includes('missing-input-response')) {
        errorMessage = 'reCAPTCHA response is missing';
      } else if (errorCodes.includes('invalid-input-response')) {
        errorMessage = 'reCAPTCHA response is invalid or expired';
      } else if (errorCodes.includes('bad-request')) {
        errorMessage = 'reCAPTCHA request is malformed';
      } else if (errorCodes.includes('timeout-or-duplicate')) {
        errorMessage = 'reCAPTCHA response has timed out or been used already';
      }

      return res.status(400).json({
        success: false,
        message: errorMessage,
        errorCodes
      });
    }

    // For reCAPTCHA v3, check the score (if available)
    if (verificationResult.score !== undefined) {
      const minScore = 0.5; // Adjust this threshold as needed
      if (verificationResult.score < minScore) {
        console.warn(`reCAPTCHA score too low: ${verificationResult.score} (minimum: ${minScore})`);
        return res.status(400).json({
          success: false,
          message: 'reCAPTCHA verification failed due to low confidence score',
          score: verificationResult.score
        });
      }
    }

    // Verification successful
    return res.status(200).json({
      success: true,
      message: 'reCAPTCHA verification successful',
      score: verificationResult.score,
      hostname: verificationResult.hostname
    });

  } catch (error) {
    console.error('Error verifying reCAPTCHA:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Internal server error during reCAPTCHA verification'
    });
  }
}