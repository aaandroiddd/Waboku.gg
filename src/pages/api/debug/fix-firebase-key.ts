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
    // Get the private key
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;
    
    // Create a safe version of the key for logging
    const safeKey = privateKey ? 
      `${privateKey.substring(0, 20)}...${privateKey.substring(privateKey.length - 20)}` : 
      'undefined';
    
    // Check key format
    const keyInfo = {
      exists: !!privateKey,
      length: privateKey ? privateKey.length : 0,
      hasEscapedNewlines: privateKey ? privateKey.includes('\\n') : false,
      hasQuotes: privateKey ? (privateKey.startsWith('"') && privateKey.endsWith('"')) : false,
      hasSingleQuotes: privateKey ? (privateKey.startsWith("'") && privateKey.endsWith("'")) : false,
      containsBeginMarker: privateKey ? privateKey.includes('-----BEGIN PRIVATE KEY-----') : false,
      containsEndMarker: privateKey ? privateKey.includes('-----END PRIVATE KEY-----') : false,
      lineCount: privateKey ? privateKey.split('\n').length : 0,
      safeKeyPreview: safeKey
    };
    
    console.log('[fix-firebase-key] Current key info:', keyInfo);
    
    // Create a fixed version of the key
    let fixedKey = privateKey || '';
    
    // Step 1: Remove surrounding quotes if present
    if ((fixedKey.startsWith('"') && fixedKey.endsWith('"')) ||
        (fixedKey.startsWith("'") && fixedKey.endsWith("'"))) {
      fixedKey = fixedKey.substring(1, fixedKey.length - 1);
    }
    
    // Step 2: Replace escaped newlines with actual newlines
    if (fixedKey.includes('\\n')) {
      fixedKey = fixedKey.replace(/\\n/g, '\n');
    }
    
    // Create a safe version of the fixed key for logging
    const safeFixedKey = fixedKey ? 
      `${fixedKey.substring(0, 20)}...${fixedKey.substring(fixedKey.length - 20)}` : 
      'undefined';
    
    // Check fixed key format
    const fixedKeyInfo = {
      length: fixedKey.length,
      hasEscapedNewlines: fixedKey.includes('\\n'),
      hasQuotes: fixedKey.startsWith('"') && fixedKey.endsWith('"'),
      hasSingleQuotes: fixedKey.startsWith("'") && fixedKey.endsWith("'"),
      containsBeginMarker: fixedKey.includes('-----BEGIN PRIVATE KEY-----'),
      containsEndMarker: fixedKey.includes('-----END PRIVATE KEY-----'),
      lineCount: fixedKey.split('\n').length,
      safeKeyPreview: safeFixedKey
    };
    
    console.log('[fix-firebase-key] Fixed key info:', fixedKeyInfo);
    
    // Provide instructions for fixing the key
    const instructions = `
To fix the FIREBASE_PRIVATE_KEY issue, please update the environment variable with a properly formatted private key:

1. The key should be in PEM format with BEGIN and END markers
2. Make sure all newlines are properly included (as \\n in the environment variable)
3. Do not add extra quotes around the key

Example format (with ... representing the actual key content):
-----BEGIN PRIVATE KEY-----
...
...
-----END PRIVATE KEY-----

When setting this as an environment variable, it would look like:
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n...\\n-----END PRIVATE KEY-----\\n"
`;
    
    return res.status(200).json({
      success: true,
      message: 'Firebase private key diagnostic information',
      details: {
        originalKeyInfo: keyInfo,
        fixedKeyInfo,
        instructions
      }
    });
  } catch (error: any) {
    console.error('[fix-firebase-key] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error analyzing FIREBASE_PRIVATE_KEY',
      details: {
        error: error.message
      }
    });
  }
}