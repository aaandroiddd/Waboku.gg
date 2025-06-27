import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('=== ADMIN SUPPORT GET ALL TICKETS API DEBUG START ===');
    
    // Get query parameters for sorting and filtering
    const { sortBy = 'createdAt', sortOrder = 'desc', assignedTo, status } = req.query;
    
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
        assignedAt: data.assignedAt?.toDate() || null,
        responses: (data.responses || []).map((response: any) => ({
          ...response,
          createdAt: response.createdAt?.toDate() || new Date()
        }))
      };

      // Check if there are unread responses from users
      const hasUnreadFromUser = ticket.responses.some((response: any) => 
        !response.isFromSupport && !response.readBySupport
      );

      // Calculate time since creation for priority indication
      const now = new Date();
      const createdAt = new Date(ticket.createdAt);
      const hoursSinceCreated = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
      
      let timePriority = 'good'; // under 24 hours
      if (hoursSinceCreated >= 48) {
        timePriority = 'bad'; // over 48 hours
      } else if (hoursSinceCreated >= 24) {
        timePriority = 'warning'; // 24-48 hours
      }

      // Only apply time priority to non-closed/resolved tickets
      const shouldShowTimePriority = ticket.status !== 'closed' && ticket.status !== 'resolved';

      return {
        ...ticket,
        hasUnreadFromUser,
        timePriority: shouldShowTimePriority ? timePriority : null,
        hoursSinceCreated
      };
    });

    // Apply client-side filtering (since Firestore queries are limited)
    let filteredTickets = tickets;

    if (assignedTo && assignedTo !== 'all') {
      if (assignedTo === 'unassigned') {
        filteredTickets = filteredTickets.filter(ticket => !ticket.assignedTo);
      } else {
        filteredTickets = filteredTickets.filter(ticket => ticket.assignedTo === assignedTo);
      }
    }

    if (status && status !== 'all') {
      filteredTickets = filteredTickets.filter(ticket => ticket.status === status);
    }

    // Apply sorting
    const sortedTickets = filteredTickets.sort((a, b) => {
      switch (sortBy) {
        case 'createdAt':
          const dateA = new Date(a.createdAt).getTime();
          const dateB = new Date(b.createdAt).getTime();
          return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
        
        case 'updatedAt':
          const updatedA = new Date(a.updatedAt).getTime();
          const updatedB = new Date(b.updatedAt).getTime();
          return sortOrder === 'asc' ? updatedA - updatedB : updatedB - updatedA;
        
        case 'priority':
          const priorityA = a.priorityLevel || 0;
          const priorityB = b.priorityLevel || 0;
          if (priorityA !== priorityB) {
            return sortOrder === 'asc' ? priorityA - priorityB : priorityB - priorityA;
          }
          // Secondary sort by creation date
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        
        case 'status':
          const statusOrder = { 'open': 1, 'in_progress': 2, 'resolved': 3, 'closed': 4 };
          const statusA = statusOrder[a.status] || 5;
          const statusB = statusOrder[b.status] || 5;
          if (statusA !== statusB) {
            return sortOrder === 'asc' ? statusA - statusB : statusB - statusA;
          }
          // Secondary sort by creation date
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        
        case 'timeAge':
          const ageA = a.hoursSinceCreated || 0;
          const ageB = b.hoursSinceCreated || 0;
          return sortOrder === 'asc' ? ageA - ageB : ageB - ageA;
        
        default:
          // Default sort: priority first, then by creation date
          const defaultPriorityA = a.priorityLevel || 0;
          const defaultPriorityB = b.priorityLevel || 0;
          if (defaultPriorityA !== defaultPriorityB) {
            return defaultPriorityB - defaultPriorityA;
          }
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    console.log(`Successfully fetched ${sortedTickets.length} support tickets`);
    
    // Log some ticket details for debugging
    if (sortedTickets.length > 0) {
      console.log('Sample ticket data:', {
        firstTicket: {
          ticketId: sortedTickets[0].ticketId,
          status: sortedTickets[0].status,
          responsesCount: sortedTickets[0].responses?.length || 0,
          hasUnreadFromUser: sortedTickets[0].hasUnreadFromUser,
          assignedTo: sortedTickets[0].assignedTo,
          timePriority: sortedTickets[0].timePriority
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