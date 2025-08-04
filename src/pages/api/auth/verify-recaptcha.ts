import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { token, action } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, message: 'reCAPTCHA token is required' });
    }

    if (!process.env.RECAPTCHA_SECRET_KEY) {
      console.error('RECAPTCHA_SECRET_KEY environment variable is not set');
      return res.status(500).json({ success: false, message: 'reCAPTCHA is not configured on the server' });
    }

    // Verify the reCAPTCHA token with Google
    const verificationResponse = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        secret: process.env.RECAPTCHA_SECRET_KEY,
        response: token,
        remoteip: req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '',
      }),
    });

    const verificationResult = await verificationResponse.json();

    if (!verificationResult.success) {
      console.error('reCAPTCHA verification failed:', verificationResult);
      
      // Provide more specific error messages based on error codes
      const errorCodes = verificationResult['error-codes'] || [];
      let errorMessage = 'reCAPTCHA verification failed';
      
      if (errorCodes.includes('invalid-input-secret')) {
        errorMessage = 'Invalid reCAPTCHA secret key configuration';
      } else if (errorCodes.includes('invalid-input-response')) {
        errorMessage = 'Invalid reCAPTCHA response token';
      } else if (errorCodes.includes('bad-request')) {
        errorMessage = 'Malformed reCAPTCHA request';
      } else if (errorCodes.includes('timeout-or-duplicate')) {
        errorMessage = 'reCAPTCHA token has expired or been used already';
      } else if (errorCodes.length > 0) {
        errorMessage = `reCAPTCHA verification failed: ${errorCodes.join(', ')}`;
      }
      
      return res.status(400).json({ 
        success: false, 
        message: errorMessage,
        errors: errorCodes
      });
    }

    // Check the score for reCAPTCHA v3 (if applicable)
    if (verificationResult.score !== undefined) {
      const minScore = 0.5; // Adjust this threshold as needed
      if (verificationResult.score < minScore) {
        console.warn(`reCAPTCHA score too low: ${verificationResult.score}`);
        return res.status(400).json({ 
          success: false, 
          message: 'reCAPTCHA verification failed due to low score' 
        });
      }
    }

    // Verify the action matches (for reCAPTCHA v3)
    if (verificationResult.action && verificationResult.action !== action) {
      console.warn(`reCAPTCHA action mismatch: expected ${action}, got ${verificationResult.action}`);
      return res.status(400).json({ 
        success: false, 
        message: 'reCAPTCHA action verification failed' 
      });
    }

    return res.status(200).json({ 
      success: true, 
      message: 'reCAPTCHA verification successful',
      score: verificationResult.score 
    });

  } catch (error) {
    console.error('Error verifying reCAPTCHA:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error during reCAPTCHA verification' 
    });
  }
}