import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('=== ADMIN SUPPORT GET ALL TICKETS API DEBUG START ===');
    
    // Initialize Firebase Admin
    const { db, auth } = getFirebaseAdmin();

    // Check admin authorization
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized - No token provided' });
    }

    const token = authHeader.split('Bearer ')[1];
    console.log('Token length:', token.length);
    
    // Verify the token and check admin status
    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(token);
      console.log('Token verified for user:', decodedToken.uid);
      console.log('User admin status:', decodedToken.admin);
    } catch (tokenError: any) {
      console.error('Token verification failed:', tokenError.message);
      return res.status(401).json({ error: 'Invalid authentication token' });
    }

    // Check if user is admin
    if (!decodedToken.admin) {
      console.error('User is not admin:', decodedToken.uid);
      return res.status(403).json({ error: 'Access denied - Admin privileges required' });
    }

    // Get all support tickets
    const ticketsSnapshot = await db
      .collection('supportTickets')
      .orderBy('priorityLevel', 'desc')
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

      // Check if there are unread responses from users
      const hasUnreadFromUser = ticket.responses.some((response: any) => 
        !response.isFromSupport && !response.readBySupport
      );

      return {
        ...ticket,
        hasUnreadFromUser
      };
    });

    res.status(200).json({
      success: true,
      tickets
    });

  } catch (error) {
    console.error('Error fetching all support tickets:', error);
    res.status(500).json({ 
      error: 'Failed to fetch support tickets. Please try again.' 
    });
  }
}