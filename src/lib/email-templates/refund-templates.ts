import { getBaseEmailTemplate, EmailTemplateData } from './base-template';

export interface RefundRequestedData extends EmailTemplateData {
  buyerName: string;
  orderNumber: string;
  listingTitle: string;
  refundReason: string;
  orderAmount: string;
  requestDate: string;
}

export interface RefundApprovedData extends EmailTemplateData {
  buyerName: string;
  orderNumber: string;
  refundAmount: string;
  listingTitle: string;
  isPartialRefund: boolean;
  sellerNotes?: string;
  processingTime: string;
}

export interface RefundDeniedData extends EmailTemplateData {
  buyerName: string;
  orderNumber: string;
  listingTitle: string;
  denialReason: string;
  contactSupport: boolean;
}

export interface RefundProcessedData extends EmailTemplateData {
  sellerName: string;
  orderNumber: string;
  refundAmount: string;
  listingTitle: string;
  isPartialRefund: boolean;
  buyerName: string;
}

export function getRefundRequestedTemplate(data: RefundRequestedData): string {
  const content = `
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 0; margin: -20px -20px 30px -20px;">
      <div style="text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600;">
          Refund Request Submitted
        </h1>
        <p style="color: rgba(255, 255, 255, 0.9); margin: 10px 0 0 0; font-size: 16px;">
          Your refund request has been received
        </p>
      </div>
    </div>

    <div style="background: #f8fafc; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
      <h2 style="color: #1e293b; margin: 0 0 16px 0; font-size: 20px; font-weight: 600;">
        Request Details
      </h2>
      <div style="background: white; border-radius: 8px; padding: 20px; border-left: 4px solid #3b82f6;">
        <div style="margin-bottom: 12px;">
          <span style="color: #64748b; font-weight: 500;">Order Number:</span>
          <span style="color: #1e293b; font-weight: 600; margin-left: 8px;">#${data.orderNumber}</span>
        </div>
        <div style="margin-bottom: 12px;">
          <span style="color: #64748b; font-weight: 500;">Item:</span>
          <span style="color: #1e293b; margin-left: 8px;">${data.listingTitle}</span>
        </div>
        <div style="margin-bottom: 12px;">
          <span style="color: #64748b; font-weight: 500;">Order Amount:</span>
          <span style="color: #1e293b; font-weight: 600; margin-left: 8px;">$${data.orderAmount}</span>
        </div>
        <div style="margin-bottom: 12px;">
          <span style="color: #64748b; font-weight: 500;">Request Date:</span>
          <span style="color: #1e293b; margin-left: 8px;">${data.requestDate}</span>
        </div>
        <div>
          <span style="color: #64748b; font-weight: 500;">Reason:</span>
          <div style="color: #1e293b; margin-top: 8px; padding: 12px; background: #f1f5f9; border-radius: 6px;">
            ${data.refundReason}
          </div>
        </div>
      </div>
    </div>

    <div style="background: #dbeafe; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <h3 style="color: #1e40af; margin: 0 0 12px 0; font-size: 18px; font-weight: 600;">
        What happens next?
      </h3>
      <ul style="color: #1e40af; margin: 0; padding-left: 20px;">
        <li style="margin-bottom: 8px;">The seller will review your refund request</li>
        <li style="margin-bottom: 8px;">You'll receive an email notification with their decision</li>
        <li style="margin-bottom: 8px;">If approved, the refund will be processed through Stripe</li>
        <li>Refunds typically take 5-10 business days to appear in your account</li>
      </ul>
    </div>

    <p style="color: #64748b; line-height: 1.6; margin-bottom: 24px;">
      Hi ${data.buyerName},
    </p>
    
    <p style="color: #64748b; line-height: 1.6; margin-bottom: 24px;">
      We've received your refund request for order #${data.orderNumber}. The seller has been notified and will review your request.
    </p>

    <p style="color: #64748b; line-height: 1.6; margin-bottom: 24px;">
      If you have any questions about your refund request, please don't hesitate to contact our support team.
    </p>
  `;

  return getBaseEmailTemplate({
    ...data,
    content,
    preheader: `Refund request submitted for order #${data.orderNumber}`,
  });
}

export function getRefundApprovedTemplate(data: RefundApprovedData): string {
  const content = `
    <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 0; margin: -20px -20px 30px -20px;">
      <div style="text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600;">
          Refund Approved
        </h1>
        <p style="color: rgba(255, 255, 255, 0.9); margin: 10px 0 0 0; font-size: 16px;">
          Your refund has been processed
        </p>
      </div>
    </div>

    <div style="background: #f0fdf4; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
      <h2 style="color: #166534; margin: 0 0 16px 0; font-size: 20px; font-weight: 600;">
        Refund Details
      </h2>
      <div style="background: white; border-radius: 8px; padding: 20px; border-left: 4px solid #10b981;">
        <div style="margin-bottom: 12px;">
          <span style="color: #64748b; font-weight: 500;">Order Number:</span>
          <span style="color: #1e293b; font-weight: 600; margin-left: 8px;">#${data.orderNumber}</span>
        </div>
        <div style="margin-bottom: 12px;">
          <span style="color: #64748b; font-weight: 500;">Item:</span>
          <span style="color: #1e293b; margin-left: 8px;">${data.listingTitle}</span>
        </div>
        <div style="margin-bottom: 12px;">
          <span style="color: #64748b; font-weight: 500;">Refund Amount:</span>
          <span style="color: #10b981; font-weight: 600; font-size: 18px; margin-left: 8px;">$${data.refundAmount}</span>
        </div>
        <div style="margin-bottom: 12px;">
          <span style="color: #64748b; font-weight: 500;">Refund Type:</span>
          <span style="color: #1e293b; margin-left: 8px;">${data.isPartialRefund ? 'Partial Refund' : 'Full Refund'}</span>
        </div>
        ${data.sellerNotes ? `
        <div>
          <span style="color: #64748b; font-weight: 500;">Seller Notes:</span>
          <div style="color: #1e293b; margin-top: 8px; padding: 12px; background: #f1f5f9; border-radius: 6px;">
            ${data.sellerNotes}
          </div>
        </div>
        ` : ''}
      </div>
    </div>

    <div style="background: #dbeafe; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <h3 style="color: #1e40af; margin: 0 0 12px 0; font-size: 18px; font-weight: 600;">
        Processing Timeline
      </h3>
      <p style="color: #1e40af; margin: 0; line-height: 1.6;">
        Your refund has been processed through Stripe and will typically appear in your original payment method within ${data.processingTime}.
      </p>
    </div>

    <p style="color: #64748b; line-height: 1.6; margin-bottom: 24px;">
      Hi ${data.buyerName},
    </p>
    
    <p style="color: #64748b; line-height: 1.6; margin-bottom: 24px;">
      Great news! Your refund request for order #${data.orderNumber} has been approved and processed.
    </p>

    <p style="color: #64748b; line-height: 1.6; margin-bottom: 24px;">
      The ${data.isPartialRefund ? 'partial ' : ''}refund of $${data.refundAmount} has been issued to your original payment method. You should see the credit appear within ${data.processingTime}.
    </p>

    <p style="color: #64748b; line-height: 1.6; margin-bottom: 24px;">
      If you don't see the refund after this timeframe, please contact your bank or card issuer, as processing times can vary.
    </p>
  `;

  return getBaseEmailTemplate({
    ...data,
    content,
    preheader: `Your refund of $${data.refundAmount} has been processed`,
  });
}

export function getRefundDeniedTemplate(data: RefundDeniedData): string {
  const content = `
    <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 40px 0; margin: -20px -20px 30px -20px;">
      <div style="text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600;">
          Refund Request Update
        </h1>
        <p style="color: rgba(255, 255, 255, 0.9); margin: 10px 0 0 0; font-size: 16px;">
          Your refund request has been reviewed
        </p>
      </div>
    </div>

    <div style="background: #fef2f2; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
      <h2 style="color: #991b1b; margin: 0 0 16px 0; font-size: 20px; font-weight: 600;">
        Request Details
      </h2>
      <div style="background: white; border-radius: 8px; padding: 20px; border-left: 4px solid #ef4444;">
        <div style="margin-bottom: 12px;">
          <span style="color: #64748b; font-weight: 500;">Order Number:</span>
          <span style="color: #1e293b; font-weight: 600; margin-left: 8px;">#${data.orderNumber}</span>
        </div>
        <div style="margin-bottom: 12px;">
          <span style="color: #64748b; font-weight: 500;">Item:</span>
          <span style="color: #1e293b; margin-left: 8px;">${data.listingTitle}</span>
        </div>
        <div>
          <span style="color: #64748b; font-weight: 500;">Reason for Denial:</span>
          <div style="color: #1e293b; margin-top: 8px; padding: 12px; background: #f1f5f9; border-radius: 6px;">
            ${data.denialReason}
          </div>
        </div>
      </div>
    </div>

    ${data.contactSupport ? `
    <div style="background: #dbeafe; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <h3 style="color: #1e40af; margin: 0 0 12px 0; font-size: 18px; font-weight: 600;">
        Need Help?
      </h3>
      <p style="color: #1e40af; margin: 0; line-height: 1.6;">
        If you believe this decision was made in error or have additional information to support your refund request, please contact our support team. We're here to help resolve any issues.
      </p>
    </div>
    ` : ''}

    <p style="color: #64748b; line-height: 1.6; margin-bottom: 24px;">
      Hi ${data.buyerName},
    </p>
    
    <p style="color: #64748b; line-height: 1.6; margin-bottom: 24px;">
      We wanted to update you on your refund request for order #${data.orderNumber}. After review, the seller has declined your refund request.
    </p>

    <p style="color: #64748b; line-height: 1.6; margin-bottom: 24px;">
      We understand this may be disappointing. If you have any questions about this decision or believe there may be additional circumstances to consider, please don't hesitate to reach out to our support team.
    </p>
  `;

  return getBaseEmailTemplate({
    ...data,
    content,
    preheader: `Update on your refund request for order #${data.orderNumber}`,
  });
}

export function getRefundProcessedTemplate(data: RefundProcessedData): string {
  const content = `
    <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 40px 0; margin: -20px -20px 30px -20px;">
      <div style="text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600;">
          Refund Processed
        </h1>
        <p style="color: rgba(255, 255, 255, 0.9); margin: 10px 0 0 0; font-size: 16px;">
          A refund has been issued for your sale
        </p>
      </div>
    </div>

    <div style="background: #f8fafc; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
      <h2 style="color: #1e293b; margin: 0 0 16px 0; font-size: 20px; font-weight: 600;">
        Refund Details
      </h2>
      <div style="background: white; border-radius: 8px; padding: 20px; border-left: 4px solid #3b82f6;">
        <div style="margin-bottom: 12px;">
          <span style="color: #64748b; font-weight: 500;">Order Number:</span>
          <span style="color: #1e293b; font-weight: 600; margin-left: 8px;">#${data.orderNumber}</span>
        </div>
        <div style="margin-bottom: 12px;">
          <span style="color: #64748b; font-weight: 500;">Item:</span>
          <span style="color: #1e293b; margin-left: 8px;">${data.listingTitle}</span>
        </div>
        <div style="margin-bottom: 12px;">
          <span style="color: #64748b; font-weight: 500;">Buyer:</span>
          <span style="color: #1e293b; margin-left: 8px;">${data.buyerName}</span>
        </div>
        <div style="margin-bottom: 12px;">
          <span style="color: #64748b; font-weight: 500;">Refund Amount:</span>
          <span style="color: #ef4444; font-weight: 600; font-size: 18px; margin-left: 8px;">-$${data.refundAmount}</span>
        </div>
        <div>
          <span style="color: #64748b; font-weight: 500;">Refund Type:</span>
          <span style="color: #1e293b; margin-left: 8px;">${data.isPartialRefund ? 'Partial Refund' : 'Full Refund'}</span>
        </div>
      </div>
    </div>

    <div style="background: #fef3c7; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <h3 style="color: #92400e; margin: 0 0 12px 0; font-size: 18px; font-weight: 600;">
        Payment Impact
      </h3>
      <p style="color: #92400e; margin: 0; line-height: 1.6;">
        The refund amount will be deducted from your next payout or charged to your connected payment method if no pending payouts are available.
      </p>
    </div>

    <p style="color: #64748b; line-height: 1.6; margin-bottom: 24px;">
      Hi ${data.sellerName},
    </p>
    
    <p style="color: #64748b; line-height: 1.6; margin-bottom: 24px;">
      This is to notify you that a ${data.isPartialRefund ? 'partial ' : ''}refund of $${data.refundAmount} has been processed for order #${data.orderNumber}.
    </p>

    <p style="color: #64748b; line-height: 1.6; margin-bottom: 24px;">
      The refund has been issued to the buyer's original payment method. You can view the full details of this transaction in your seller dashboard.
    </p>

    <p style="color: #64748b; line-height: 1.6; margin-bottom: 24px;">
      If you have any questions about this refund, please contact our support team.
    </p>
  `;

  return getBaseEmailTemplate({
    ...data,
    content,
    preheader: `Refund of $${data.refundAmount} processed for order #${data.orderNumber}`,
  });
}