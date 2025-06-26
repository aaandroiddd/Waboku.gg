import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { emailService } from '@/lib/email-service';

interface SupportTicketData {
  subject: string;
  category: string;
  priority: string;
  description: string;
}

// Generate a unique ticket ID - shorter and more readable
function generateTicketId(): string {
  // Use a simple counter-based approach with random suffix
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2); // Last 2 digits of year
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const randomSuffix = Math.floor(Math.random() * 999).toString().padStart(3, '0');
  
  return `${year}${month}${day}${randomSuffix}`;
}

// Get priority level for sorting
function getPriorityLevel(priority: string): number {
  switch (priority) {
    case 'critical': return 4;
    case 'high': return 3;
    case 'medium': return 2;
    case 'low': return 1;
    default: return 2;
  }
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
    const { subject, category, priority, description }: SupportTicketData = req.body;

    if (!subject?.trim()) {
      return res.status(400).json({ error: 'Subject is required' });
    }

    if (!category) {
      return res.status(400).json({ error: 'Category is required' });
    }

    if (!description?.trim()) {
      return res.status(400).json({ error: 'Description is required' });
    }

    if (description.length < 10) {
      return res.status(400).json({ error: 'Description must be at least 10 characters long' });
    }

    // Validate category
    const validCategories = [
      'account', 'billing', 'orders', 'listings', 'technical', 
      'refunds', 'safety', 'feature', 'other'
    ];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    // Validate priority
    const validPriorities = ['low', 'medium', 'high', 'critical'];
    if (!validPriorities.includes(priority)) {
      return res.status(400).json({ error: 'Invalid priority' });
    }

    // Get user information
    const userRecord = await auth.getUser(userId);
    const userName = userRecord.displayName || userEmail.split('@')[0];

    // Generate ticket ID
    const ticketId = generateTicketId();

    // Create ticket data
    const ticketData = {
      ticketId,
      userId,
      userEmail,
      userName,
      subject: subject.trim(),
      category,
      priority,
      priorityLevel: getPriorityLevel(priority),
      description: description.trim(),
      status: 'open',
      createdAt: new Date(),
      updatedAt: new Date(),
      responses: [],
      metadata: {
        userAgent: req.headers['user-agent'] || '',
        ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress || '',
        timestamp: new Date().toISOString()
      }
    };

    // Save ticket to Firestore
    await db.collection('supportTickets').doc(ticketId).set(ticketData);

    // Send email notification to support team
    try {
      await emailService.sendSupportTicketEmail({
        ticketId,
        userName,
        userEmail,
        subject: subject.trim(),
        category,
        priority,
        description: description.trim(),
        createdAt: new Date()
      });
    } catch (emailError) {
      console.error('Failed to send support ticket email:', emailError);
      // Don't fail the request if email fails
    }

    // Send confirmation email to user
    try {
      await emailService.sendSupportConfirmationEmail({
        ticketId,
        userName,
        userEmail,
        subject: subject.trim(),
        category,
        priority
      });
    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError);
      // Don't fail the request if email fails
    }

    res.status(200).json({
      success: true,
      ticketId,
      message: 'Support ticket created successfully'
    });

  } catch (error) {
    console.error('Error creating support ticket:', error);
    
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ error: 'Token expired. Please sign in again.' });
    }
    
    if (error.code === 'auth/invalid-id-token') {
      return res.status(401).json({ error: 'Invalid token. Please sign in again.' });
    }

    res.status(500).json({ 
      error: 'Failed to create support ticket. Please try again.' 
    });
  }
}