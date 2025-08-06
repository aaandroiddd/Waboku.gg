import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const { db, auth } = getFirebaseAdmin();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check admin authorization
  const authHeader = req.headers.authorization;
  const adminSecret = authHeader?.replace('Bearer ', '');
  
  if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { userId, approve, reason } = req.body;

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'User ID is required' });
    }

    if (typeof approve !== 'boolean') {
      return res.status(400).json({ error: 'Approve parameter must be boolean' });
    }

    if (approve && (!reason || typeof reason !== 'string' || !reason.trim())) {
      return res.status(400).json({ error: 'Reason is required for approval' });
    }

    // Verify user exists
    try {
      await auth.getUser(userId);
    } catch (error) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get admin user info for logging
    let adminInfo = 'System';
    try {
      // In a real implementation, you might want to decode a JWT token to get admin info
      // For now, we'll use a generic identifier
      adminInfo = 'Admin Panel';
    } catch (error) {
      // Use default admin info
    }

    const userDocRef = db.collection('users').doc(userId);
    
    if (approve) {
      // Approve the user
      await userDocRef.set({
        stripeConnectEligible: true,
        stripeConnectApprovedBy: adminInfo,
        stripeConnectApprovedAt: FieldValue.serverTimestamp(),
        stripeConnectApprovalReason: reason.trim(),
        stripeConnectUpdatedAt: FieldValue.serverTimestamp()
      }, { merge: true });

      const now = new Date().toISOString();
      
      res.status(200).json({ 
        success: true, 
        message: 'User approved for Stripe Connect access',
        approvedBy: adminInfo,
        approvedAt: now
      });
    } else {
      // Revoke access
      await userDocRef.set({
        stripeConnectEligible: false,
        stripeConnectRevokedBy: adminInfo,
        stripeConnectRevokedAt: FieldValue.serverTimestamp(),
        stripeConnectRevokeReason: reason || 'Access revoked by moderator',
        stripeConnectUpdatedAt: FieldValue.serverTimestamp(),
        // Remove approval fields
        stripeConnectApprovedBy: FieldValue.delete(),
        stripeConnectApprovedAt: FieldValue.delete(),
        stripeConnectApprovalReason: FieldValue.delete()
      }, { merge: true });

      res.status(200).json({ 
        success: true, 
        message: 'User Stripe Connect access revoked'
      });
    }
  } catch (error) {
    console.error('Error updating user eligibility:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}