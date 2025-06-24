import { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps, cert } from 'firebase-admin/app';

// Initialize Firebase Admin if not already initialized
if (!getApps().length) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey,
    }),
  });
}

const db = getFirestore();
const auth = getAuth();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get the authorization token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized - No token provided' });
    }

    const token = authHeader.split('Bearer ')[1];
    
    // Verify the token
    const decodedToken = await auth.verifyIdToken(token);
    const userId = decodedToken.uid;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized - Invalid token' });
    }

    // Get user's support tickets
    const ticketsSnapshot = await db
      .collection('supportTickets')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();

    const tickets = ticketsSnapshot.docs.map(doc => {
      const data = doc.data();
      
      // Convert Firestore timestamps to Date objects
      const ticket = {
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        lastResponseAt: data.lastResponseAt?.toDate() || null,
        responses: (data.responses || []).map((response: any) => ({
          ...response,
          createdAt: response.createdAt?.toDate() || new Date()
        }))
      };

      // Check if there are unread responses from support
      const hasUnreadResponses = ticket.responses.some((response: any) => 
        response.isFromSupport && !response.readByUser
      );

      return {
        ...ticket,
        hasUnreadResponses
      };
    });

    res.status(200).json({
      success: true,
      tickets
    });

  } catch (error) {
    console.error('Error fetching support tickets:', error);
    
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ error: 'Token expired. Please sign in again.' });
    }
    
    if (error.code === 'auth/invalid-id-token') {
      return res.status(401).json({ error: 'Invalid token. Please sign in again.' });
    }

    res.status(500).json({ 
      error: 'Failed to fetch support tickets. Please try again.' 
    });
  }
}