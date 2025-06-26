import { NextApiRequest, NextApiResponse } from 'next';
import { FieldValue } from 'firebase-admin/firestore';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { emailService } from '@/lib/email-service';
import { notificationService } from '@/lib/notification-service';

interface AddResponseData {
  ticketId: string;
  message: string;
}

// Generate a unique response ID
function generateResponseId(): string {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `${timestamp}${randomStr}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('=== ADMIN SUPPORT ADD RESPONSE API DEBUG START ===');
    
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
    const { ticketId, message }: AddResponseData = req.body;
    console.log('Request body:', { ticketId, messageLength: message?.length });

    if (!ticketId?.trim()) {
      console.error('Ticket ID is missing');
      return res.status(400).json({ error: 'Ticket ID is required' });
    }

    if (!message?.trim()) {
      console.error('Message is missing');
      return res.status(400).json({ error: 'Message is required' });
    }

    if (message.length < 5) {
      console.error('Message too short:', message.length);
      return res.status(400).json({ error: 'Message must be at least 5 characters long' });
    }

    // Get the ticket to verify it exists
    const ticketDoc = await db.collection('supportTickets').doc(ticketId).get();
    
    if (!ticketDoc.exists) {
      console.error('Ticket not found:', ticketId);
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const ticketData = ticketDoc.data();
    console.log('Found ticket:', { 
      ticketId, 
      currentStatus: ticketData?.status,
      currentResponsesCount: ticketData?.responses?.length || 0
    });

    // Create response data
    const responseData = {
      id: generateResponseId(),
      message: message.trim(),
      isFromSupport: true,
      authorName: 'Waboku.gg Support',
      authorEmail: 'support@waboku.gg',
      createdAt: new Date(),
      readByUser: false,
      readBySupport: true
    };

    console.log('Adding response:', { responseId: responseData.id, messageLength: responseData.message.length });

    // Add response to ticket
    try {
      await db.collection('supportTickets').doc(ticketId).update({
        responses: FieldValue.arrayUnion(responseData),
        updatedAt: new Date(),
        lastResponseAt: new Date(),
        status: 'in_progress' // Update status to in_progress when support responds
      });
      console.log('Successfully updated ticket with new response');
    } catch (updateError: any) {
      console.error('Failed to update ticket:', updateError);
      throw updateError;
    }

    // Create in-app notification for user
    try {
      await notificationService.createSupportResponseNotification(
        ticketData?.userId,
        ticketId,
        ticketData?.subject || 'Support Ticket',
        'Waboku.gg Support'
      );
      console.log('Successfully created support response notification');
    } catch (notificationError) {
      console.error('Failed to create support response notification:', notificationError);
      // Don't fail the request if notification fails
    }

    // Send email notification to user
    try {
      await emailService.sendSupportConfirmationEmail({
        ticketId,
        userName: ticketData?.userName || 'User',
        userEmail: ticketData?.userEmail || '',
        subject: `Re: ${ticketData?.subject || 'Support Ticket'}`,
        category: ticketData?.category || 'other',
        priority: ticketData?.priority || 'medium'
      });
    } catch (emailError) {
      console.error('Failed to send user notification email:', emailError);
      // Don't fail the request if email fails
    }

    res.status(200).json({
      success: true,
      response: {
        ...responseData,
        createdAt: responseData.createdAt.toISOString()
      },
      message: 'Response added successfully'
    });

  } catch (error) {
    console.error('Error adding admin support response:', error);
    res.status(500).json({ 
      error: 'Failed to add response. Please try again.' 
    });
  }
}