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
    console.log('=== GET TICKET API DEBUG START ===');
    console.log('Fetching ticket ID:', ticketId);
    
    const ticketDoc = await db.collection('supportTickets').doc(ticketId).get();
    
    if (!ticketDoc.exists) {
      console.log('Ticket not found in database:', ticketId);
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const ticketData = ticketDoc.data();
    console.log('Raw ticket data from Firestore:', {
      id: ticketDoc.id,
      status: ticketData?.status,
      updatedAt: ticketData?.updatedAt,
      lastModifiedBy: ticketData?.lastModifiedBy,
      lastModifiedAt: ticketData?.lastModifiedAt
    });
    
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

    // Fetch responses from the main ticket document (not subcollection)
    const responses = ticketData?.responses || [];
    
    // Sort responses by createdAt (convert timestamps to dates for sorting)
    const sortedResponses = responses.sort((a: any, b: any) => {
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
      return dateA.getTime() - dateB.getTime();
    });

    console.log('Fetched responses from main document:', {
      ticketId,
      responseCount: sortedResponses.length,
      latestResponseTime: sortedResponses.length > 0 ? 
        (sortedResponses[sortedResponses.length - 1].createdAt?.toDate?.() || sortedResponses[sortedResponses.length - 1].createdAt) : 
        'No responses'
    });

    // Process the ticket data and handle null values properly
    const ticket = {
      id: ticketDoc.id,
      ticketId: ticketDoc.id,
      ...ticketData,
      // Ensure assignment fields are properly handled
      assignedTo: ticketData?.assignedTo || null,
      assignedToName: ticketData?.assignedToName || null,
      assignedAt: ticketData?.assignedAt || null,
      responses: sortedResponses,
      timePriority,
      hoursSinceCreated
    };

    console.log('Fetched ticket assignment data:', {
      ticketId: ticket.ticketId,
      assignedTo: ticket.assignedTo,
      assignedToName: ticket.assignedToName,
      assignedAt: ticket.assignedAt
    });

    res.status(200).json({ ticket });
  } catch (error) {
    console.error('Error fetching ticket:', error);
    res.status(500).json({ error: 'Failed to fetch ticket' });
  }
}