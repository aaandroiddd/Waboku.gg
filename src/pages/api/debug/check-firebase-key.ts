import type { NextApiRequest, NextApiResponse } from 'next';

type ResponseData = {
  success: boolean;
  message: string;
  details?: any;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  try {
    console.log('[check-firebase-key] Checking FIREBASE_PRIVATE_KEY format');
    
    // Get the private key
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    
    if (!privateKey) {
      return res.status(500).json({
        success: false,
        message: 'FIREBASE_PRIVATE_KEY is not set',
        details: {
          exists: false
        }
      });
    }
    
    // Check key format
    const keyInfo = {
      length: privateKey.length,
      hasEscapedNewlines: privateKey.includes('\\n'),
      hasQuotes: privateKey.startsWith('"') && privateKey.endsWith('"'),
      hasSingleQuotes: privateKey.startsWith("'") && privateKey.endsWith("'"),
      containsBeginMarker: privateKey.includes('-----BEGIN PRIVATE KEY-----'),
      containsEndMarker: privateKey.includes('-----END PRIVATE KEY-----'),
      lineCount: privateKey.split('\n').length,
    };
    
    console.log('[check-firebase-key] Key format:', keyInfo);
    
    // Process the key as we would in firebase-admin.ts
    let processedKey = privateKey;
    
    // Remove surrounding quotes if present
    if ((processedKey.startsWith('"') && processedKey.endsWith('"')) ||
        (processedKey.startsWith("'") && processedKey.endsWith("'"))) {
      processedKey = processedKey.substring(1, processedKey.length - 1);
    }
    
    // Replace escaped newlines with actual newlines
    if (processedKey.includes('\\n')) {
      processedKey = processedKey.replace(/\\n/g, '\n');
    }
    
    // Check if the processed key has the correct format
    const processedKeyInfo = {
      length: processedKey.length,
      containsBeginMarker: processedKey.includes('-----BEGIN PRIVATE KEY-----'),
      containsEndMarker: processedKey.includes('-----END PRIVATE KEY-----'),
      lineCount: processedKey.split('\n').length,
      startsWithMarker: processedKey.trim().startsWith('-----BEGIN PRIVATE KEY-----'),
      endsWithMarker: processedKey.trim().endsWith('-----END PRIVATE KEY-----') || 
                      processedKey.trim().endsWith('-----END PRIVATE KEY-----\n'),
    };
    
    console.log('[check-firebase-key] Processed key format:', processedKeyInfo);
    
    // Determine if the key format is valid
    const isValid = processedKeyInfo.containsBeginMarker && 
                    processedKeyInfo.containsEndMarker && 
                    processedKeyInfo.lineCount >= 3;
    
    // Provide guidance on how to fix the key if needed
    let fixInstructions = '';
    if (!isValid) {
      fixInstructions = 'The FIREBASE_PRIVATE_KEY environment variable needs to be updated. ' +
        'It should be a properly formatted private key in PEM format with BEGIN and END markers. ' +
        'Make sure to include all newlines (\\n) and do not add extra quotes around the key.';
    }
    
    return res.status(200).json({
      success: true,
      message: isValid ? 
        'FIREBASE_PRIVATE_KEY format appears valid after processing' : 
        'FIREBASE_PRIVATE_KEY format appears invalid and needs to be fixed',
      details: {
        originalKeyInfo: keyInfo,
        processedKeyInfo,
        isValid,
        fixInstructions: fixInstructions || undefined
      }
    });
  } catch (error: any) {
    console.error('[check-firebase-key] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error checking FIREBASE_PRIVATE_KEY',
      details: {
        error: error.message
      }
    });
  }
}