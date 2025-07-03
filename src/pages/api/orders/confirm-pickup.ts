import { NextApiRequest, NextApiResponse } from 'next';
import { getFirebaseAdmin } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { orderId, userId, role } = req.body;

    if (!orderId || !userId || !role) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        details: 'orderId, userId, and role are required'
      });
    }

    if (role !== 'buyer' && role !== 'seller') {
      return res.status(400).json({ 
        error: 'Invalid role',
        details: 'Role must be either "buyer" or "seller"'
      });
    }

    console.log(`[confirm-pickup] Processing ${role} pickup confirmation for order:`, orderId, 'by user:', userId);

    const { db } = getFirebaseAdmin();

    // Get the order document
    const orderRef = db.collection('orders').doc(orderId);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
      console.error('[confirm-pickup] Order not found:', orderId);
      return res.status(404).json({ error: 'Order not found' });
    }

    const orderData = orderDoc.data();
    console.log('[confirm-pickup] Order data:', {
      id: orderId,
      status: orderData?.status,
      isPickup: orderData?.isPickup,
      buyerId: orderData?.buyerId,
      sellerId: orderData?.sellerId,
      buyerPickupConfirmed: orderData?.buyerPickupConfirmed,
      sellerPickupConfirmed: orderData?.sellerPickupConfirmed,
      pickupCompleted: orderData?.pickupCompleted
    });

    // Verify this is a pickup order
    if (!orderData?.isPickup) {
      console.error('[confirm-pickup] Order is not a pickup order:', orderId);
      return res.status(400).json({ error: 'This is not a pickup order' });
    }

    // Verify the user is authorized for this order
    if (role === 'buyer' && orderData.buyerId !== userId) {
      console.error('[confirm-pickup] User is not the buyer for this order:', { userId, buyerId: orderData.buyerId });
      return res.status(403).json({ error: 'You are not authorized to confirm pickup for this order' });
    }

    if (role === 'seller' && orderData.sellerId !== userId) {
      console.error('[confirm-pickup] User is not the seller for this order:', { userId, sellerId: orderData.sellerId });
      return res.status(403).json({ error: 'You are not authorized to confirm pickup for this order' });
    }

    // Check if pickup is already completed
    if (orderData.pickupCompleted) {
      console.log('[confirm-pickup] Pickup already completed for order:', orderId);
      return res.status(400).json({ error: 'Pickup has already been completed for this order' });
    }

    // Check if this role has already confirmed
    const confirmationField = role === 'buyer' ? 'buyerPickupConfirmed' : 'sellerPickupConfirmed';
    if (orderData[confirmationField]) {
      console.log(`[confirm-pickup] ${role} has already confirmed pickup for order:`, orderId);
      return res.status(400).json({ error: `${role.charAt(0).toUpperCase() + role.slice(1)} has already confirmed pickup` });
    }

    // Prepare the update data
    const updateData: any = {
      [confirmationField]: true,
      [`${confirmationField}At`]: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };

    // Check if both parties will have confirmed after this update
    const otherConfirmationField = role === 'buyer' ? 'sellerPickupConfirmed' : 'buyerPickupConfirmed';
    const otherPartyConfirmed = orderData[otherConfirmationField];

    if (otherPartyConfirmed) {
      // Both parties have now confirmed, complete the pickup
      updateData.pickupCompleted = true;
      updateData.pickupCompletedAt = FieldValue.serverTimestamp();
      updateData.status = 'completed';
      
      console.log('[confirm-pickup] Both parties confirmed, completing pickup for order:', orderId);
    } else {
      console.log(`[confirm-pickup] ${role} confirmed, waiting for ${role === 'buyer' ? 'seller' : 'buyer'} confirmation for order:`, orderId);
    }

    // Update the order
    await orderRef.update(updateData);

    // Prepare response message
    let message;
    if (otherPartyConfirmed) {
      message = 'Pickup confirmed! Both parties have confirmed pickup and the order is now completed.';
    } else {
      const waitingFor = role === 'buyer' ? 'seller' : 'buyer';
      message = `Pickup confirmed! Waiting for ${waitingFor} to also confirm pickup.`;
    }

    console.log('[confirm-pickup] Successfully updated order:', orderId, 'Message:', message);

    return res.status(200).json({
      success: true,
      message,
      orderCompleted: otherPartyConfirmed
    });

  } catch (error) {
    console.error('[confirm-pickup] Error confirming pickup:', error);
    return res.status(500).json({ 
      error: 'Failed to confirm pickup',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}