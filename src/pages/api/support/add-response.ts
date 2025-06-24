import { NextApiRequest, NextApiResponse } from 'next';
import { FieldValue } from 'firebase-admin/firestore';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { emailService } from '@/lib/email-service';

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
    // Initialize Firebase Admin
    const { db, auth } = getFirebaseAdmin();

    // Get the authorization token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized - No token provided' });
    }

    const token = authHeader.split('Bearer ')[1];
    
    // Verify the token
    const decodedToken = await auth.verifyIdToken(token);
    const userId = decodedToken.uid;
    const userEmail = decodedToken.email;

    if (!userId || !userEmail) {
      return res.status(401).json({ error: 'Unauthorized - Invalid token' });
    }

    // Validate request body
    const { ticketId, message }: AddResponseData = req.body;

    if (!ticketId?.trim()) {
      return res.status(400).json({ error: 'Ticket ID is required' });
    }

    if (!message?.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (message.length < 5) {
      return res.status(400).json({ error: 'Message must be at least 5 characters long' });
    }

    // Get the ticket to verify ownership and status
    const ticketDoc = await db.collection('supportTickets').doc(ticketId).get();
    
    if (!ticketDoc.exists) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const ticketData = ticketDoc.data();
    
    if (ticketData?.userId !== userId) {
      return res.status(403).json({ error: 'Access denied - Not your ticket' });
    }

    if (ticketData?.status === 'closed') {
      return res.status(400).json({ error: 'Cannot add response to closed ticket' });
    }

    // Get user information
    const userRecord = await auth.getUser(userId);
    const userName = userRecord.displayName || userEmail.split('@')[0];

    // Create response data
    const responseData = {
      id: generateResponseId(),
      message: message.trim(),
      isFromSupport: false,
      authorName: userName,
      authorEmail: userEmail,
      createdAt: new Date(),
      readBySupport: false
    };

    // Add response to ticket
    await db.collection('supportTickets').doc(ticketId).update({
      responses: FieldValue.arrayUnion(responseData),
      updatedAt: new Date(),
      lastResponseAt: new Date(),
      status: 'open' // Reopen ticket if it was resolved
    });

    // Send email notification to support team
    try {
      await emailService.sendSupportTicketEmail({
        ticketId,
        userName,
        userEmail,
        subject: `Re: ${ticketData?.subject || 'Support Ticket'}`,
        category: ticketData?.category || 'other',
        priority: ticketData?.priority || 'medium',
        description: `User Response:\n\n${message.trim()}\n\n--- Original Ticket ---\n${ticketData?.description || ''}`,
        createdAt: new Date()
      });
    } catch (emailError) {
      console.error('Failed to send support notification email:', emailError);
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
    console.error('Error adding support ticket response:', error);
    
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ error: 'Token expired. Please sign in again.' });
    }
    
    if (error.code === 'auth/invalid-id-token') {
      return res.status(401).json({ error: 'Invalid token. Please sign in again.' });
    }

    res.status(500).json({ 
      error: 'Failed to add response. Please try again.' 
    });
  }
}