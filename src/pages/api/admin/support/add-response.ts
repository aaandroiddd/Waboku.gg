import { NextApiRequest, NextApiResponse } from 'next';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { emailService } from '@/lib/email-service';

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
    // Check admin authorization
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized - No token provided' });
    }

    const token = authHeader.split('Bearer ')[1];
    
    // Verify admin token
    if (token !== process.env.NEXT_PUBLIC_ADMIN_SECRET) {
      return res.status(401).json({ error: 'Unauthorized - Invalid admin token' });
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

    // Get the ticket to verify it exists
    const ticketDoc = await db.collection('supportTickets').doc(ticketId).get();
    
    if (!ticketDoc.exists) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const ticketData = ticketDoc.data();

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

    // Add response to ticket
    await db.collection('supportTickets').doc(ticketId).update({
      responses: FieldValue.arrayUnion(responseData),
      updatedAt: new Date(),
      lastResponseAt: new Date(),
      status: 'in_progress' // Update status to in_progress when support responds
    });

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