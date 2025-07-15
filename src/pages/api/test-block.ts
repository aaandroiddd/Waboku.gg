import { NextApiRequest, NextApiResponse } from 'next'
import { getFirebaseAdmin } from '@/lib/firebase-admin'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    console.log('[Test Block API] Testing Firebase Admin initialization');
    
    // Test Firebase Admin initialization
    const { admin, auth, database } = getFirebaseAdmin()
    console.log('[Test Block API] Firebase Admin initialized successfully');
    
    // Test database connection
    const testRef = database.ref('test-connection')
    await testRef.set({ timestamp: Date.now(), test: true })
    console.log('[Test Block API] Database write test successful');
    
    // Clean up test data
    await testRef.remove()
    console.log('[Test Block API] Database cleanup successful');
    
    return res.status(200).json({ 
      success: true,
      message: 'Firebase Admin and database connection working properly'
    })
  } catch (error) {
    console.error('[Test Block API] Error:', error)
    console.error('[Test Block API] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined
    });
    return res.status(500).json({ 
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}