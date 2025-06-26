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

    // Check if user is admin or moderator
    const userDoc = await db.collection('users').doc(decodedToken.uid).get();
    const userData = userDoc.data();
    
    const isAdmin = userData?.isAdmin === true;
    const isModerator = userData?.isModerator === true;
    const hasModeratorRole = Array.isArray(userData?.roles) && userData.roles.includes('moderator');
    
    if (!isAdmin && !isModerator && !hasModeratorRole) {
      console.error('User is not admin or moderator:', decodedToken.uid, {
        isAdmin,
        isModerator,
        hasModeratorRole,
        roles: userData?.roles
      });
      return res.status(403).json({ error: 'Access denied - Admin privileges required' });
    }
    
    console.log('User has admin/moderator access:', decodedToken.uid, {
      isAdmin,
      isModerator,
      hasModeratorRole
    });

    // Get all support tickets - using simple query to avoid index issues
    let ticketsSnapshot;
    try {
      // Try with ordering first
      ticketsSnapshot = await db
        .collection('supportTickets')
        .orderBy('createdAt', 'desc')
        .get();
    } catch (indexError: any) {
      console.log('Falling back to simple query due to index error:', indexError.message);
      // Fallback to simple query without ordering
      ticketsSnapshot = await db
        .collection('supportTickets')
        .get();
    }

    const tickets = ticketsSnapshot.docs.map(doc => {
      const data = doc.data();
      
      // Convert Firestore timestamps to Date objects
      const ticket = {
        ...data,
        ticketId: doc.id, // Ensure we have the document ID
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

    // Sort tickets: priority first (critical=4, high=3, medium=2, low=1), then by creation date
    const sortedTickets = tickets.sort((a, b) => {
      // First sort by priority level (higher priority first)
      const priorityA = a.priorityLevel || 0;
      const priorityB = b.priorityLevel || 0;
      if (priorityA !== priorityB) {
        return priorityB - priorityA;
      }
      
      // Then sort by creation date (newest first)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    console.log(`Successfully fetched ${sortedTickets.length} support tickets`);
    
    // Log some ticket details for debugging
    if (sortedTickets.length > 0) {
      console.log('Sample ticket data:', {
        firstTicket: {
          ticketId: sortedTickets[0].ticketId,
          status: sortedTickets[0].status,
          responsesCount: sortedTickets[0].responses?.length || 0,
          hasUnreadFromUser: sortedTickets[0].hasUnreadFromUser
        }
      });
    }

    res.status(200).json({
      success: true,
      tickets: sortedTickets
    });

  } catch (error) {
    console.error('Error fetching all support tickets:', error);
    res.status(500).json({ 
      error: 'Failed to fetch support tickets. Please try again.' 
    });
  }
}