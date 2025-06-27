import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { ticketId } = req.query;
    
    if (!ticketId || typeof ticketId !== 'string') {
      return res.status(400).json({ error: 'Ticket ID is required' });
    }

    // Verify authorization
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization header required' });
    }

    const token = authHeader.split(' ')[1];
    const { auth, db } = getFirebaseAdmin();

    // Check if token is admin secret
    const isAdminSecret = token === process.env.ADMIN_SECRET;
    let isAuthorized = false;

    if (isAdminSecret) {
      isAuthorized = true;
    } else {
      try {
        // Verify Firebase ID token
        const decodedToken = await auth.verifyIdToken(token);
        const userDoc = await db.collection('users').doc(decodedToken.uid).get();
        
        if (userDoc.exists) {
          const userData = userDoc.data();
          isAuthorized = userData?.isAdmin === true || userData?.isModerator === true;
        }
      } catch (error) {
        console.error('Token verification failed:', error);
        return res.status(401).json({ error: 'Invalid token' });
      }
    }

    if (!isAuthorized) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Fetch the ticket
    const ticketDoc = await db.collection('supportTickets').doc(ticketId).get();
    
    if (!ticketDoc.exists) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const ticketData = ticketDoc.data();
    
    // Calculate time-based priority for non-closed tickets
    let timePriority = undefined;
    let hoursSinceCreated = undefined;
    
    if (ticketData?.status !== 'closed' && ticketData?.status !== 'resolved') {
      const createdAt = ticketData?.createdAt?.toDate() || new Date();
      const now = new Date();
      hoursSinceCreated = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60));
      
      if (hoursSinceCreated < 24) {
        timePriority = 'good';
      } else if (hoursSinceCreated < 48) {
        timePriority = 'warning';
      } else {
        timePriority = 'bad';
      }
    }

    // Fetch responses
    const responsesSnapshot = await db
      .collection('supportTickets')
      .doc(ticketId)
      .collection('responses')
      .orderBy('createdAt', 'asc')
      .get();

    const responses = responsesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    const ticket = {
      id: ticketDoc.id,
      ticketId: ticketDoc.id,
      ...ticketData,
      responses,
      timePriority,
      hoursSinceCreated
    };

    res.status(200).json({ ticket });
  } catch (error) {
    console.error('Error fetching ticket:', error);
    res.status(500).json({ error: 'Failed to fetch ticket' });
  }
}