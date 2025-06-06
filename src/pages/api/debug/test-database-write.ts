import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdminServices } from '@/lib/firebase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Set a timeout for the entire operation
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Operation timed out')), 25000); // 25 second timeout
  });

  try {
    console.log('Testing database write with admin credentials...');
    
    const operationPromise = async () => {
      // Get Firebase Admin services
      const { database } = await getFirebaseAdminServices();
      
      if (!database) {
        throw new Error('Admin database not initialized');
      }
      
      // Simple test write to verify connection
      const testRef = database.ref('debug/test-write');
      const timestamp = Date.now();
      
      await testRef.set({
        message: 'Test write successful',
        timestamp,
        testId: `test-${timestamp}`
      });
      
      console.log('Test write successful with admin SDK');
      
      return {
        success: true,
        message: 'Database write test successful',
        timestamp,
        testId: `test-${timestamp}`
      };
    };

    // Race between the operation and timeout
    const result = await Promise.race([operationPromise(), timeoutPromise]);
    
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error testing database write:', error);
    
    // Detailed error logging
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack
      });
    }
    
    return res.status(500).json({ 
      error: 'Failed to write to database',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now()
    });
  }
}