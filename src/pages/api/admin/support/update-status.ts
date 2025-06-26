import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { notificationService } from '@/lib/notification-service';

interface UpdateStatusData {
  ticketId: string;
  status: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('=== ADMIN SUPPORT UPDATE STATUS API DEBUG START ===');
    console.log('Request body:', req.body);
    
    // Initialize Firebase Admin
    const { db, auth } = getFirebaseAdmin();

    // Check admin authorization
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized - No token provided' });
    }

    const token = authHeader.split('Bearer ')[1];
    
    // Verify the token and check admin status
    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(token);
      console.log('Token verified for admin user:', decodedToken.uid);
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
      console.error('User is not admin or moderator:', decodedToken.uid);
      return res.status(403).json({ error: 'Access denied - Admin privileges required' });
    }

    // Validate request body
    const { ticketId, status }: UpdateStatusData = req.body;

    if (!ticketId?.trim()) {
      return res.status(400).json({ error: 'Ticket ID is required' });
    }

    if (!status?.trim()) {
      return res.status(400).json({ error: 'Status is required' });
    }

    // Validate status
    const validStatuses = ['open', 'in_progress', 'resolved', 'closed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    console.log('Attempting to update ticket:', ticketId, 'to status:', status);

    // Get the ticket to verify it exists
    const ticketRef = db.collection('supportTickets').doc(ticketId);
    const ticketDoc = await ticketRef.get();
    
    if (!ticketDoc.exists) {
      console.error('Ticket not found:', ticketId);
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const currentTicketData = ticketDoc.data();
    console.log('Current ticket data:', {
      id: ticketId,
      currentStatus: currentTicketData?.status,
      createdAt: currentTicketData?.createdAt,
      updatedAt: currentTicketData?.updatedAt
    });

    // Update the ticket status with proper timestamp
    const updateData = {
      status,
      updatedAt: new Date(),
      lastModifiedBy: decodedToken.uid,
      lastModifiedAt: new Date()
    };

    console.log('Updating with data:', updateData);

    try {
      await ticketRef.update(updateData);
      console.log('Firestore update operation completed');
    } catch (updateError: any) {
      console.error('Firestore update failed:', {
        error: updateError.message,
        code: updateError.code,
        details: updateError.details
      });
      throw updateError;
    }

    // Verify the update was successful
    const updatedTicketDoc = await ticketRef.get();
    const updatedData = updatedTicketDoc.data();
    
    console.log('Verified updated data:', {
      id: ticketId,
      newStatus: updatedData?.status,
      updatedAt: updatedData?.updatedAt,
      lastModifiedBy: updatedData?.lastModifiedBy
    });

    // Create notification for status changes that matter to users
    if (status === 'closed' || status === 'resolved') {
      try {
        await notificationService.createSupportTicketNotification(
          currentTicketData?.userId,
          ticketId,
          currentTicketData?.subject || 'Support Ticket',
          'closed'
        );
        console.log('Successfully created support ticket status notification');
      } catch (notificationError) {
        console.error('Failed to create support ticket status notification:', notificationError);
        // Don't fail the request if notification fails
      }
    }

    // Double-check by querying the collection
    const collectionQuery = await db.collection('supportTickets').where('__name__', '==', ticketId).get();
    if (!collectionQuery.empty) {
      const docFromCollection = collectionQuery.docs[0].data();
      console.log('Status from collection query:', docFromCollection?.status);
    } else {
      console.log('Document not found in collection query');
    }

    res.status(200).json({
      success: true,
      message: 'Ticket status updated successfully',
      ticket: {
        id: ticketId,
        status: updatedData?.status,
        updatedAt: updatedData?.updatedAt,
        lastModifiedBy: updatedData?.lastModifiedBy
      }
    });

  } catch (error: any) {
    console.error('Error updating ticket status:', {
      message: error.message,
      code: error.code,
      stack: error.stack?.split('\n').slice(0, 5).join('\n')
    });
    res.status(500).json({ 
      error: 'Failed to update ticket status. Please try again.',
      details: error.message
    });
  }
}