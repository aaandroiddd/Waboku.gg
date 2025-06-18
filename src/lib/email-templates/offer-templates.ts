import { getBaseEmailTemplate } from './base-template';

export interface OfferReceivedData {
  userName: string;
  userEmail: string;
  buyerName: string;
  listingTitle: string;
  offerAmount: number;
  listingPrice: number;
  actionUrl: string;
}

export interface OfferAcceptedData {
  userName: string;
  userEmail: string;
  sellerName: string;
  listingTitle: string;
  offerAmount: number;
  actionUrl: string;
}

export interface OfferDeclinedData {
  userName: string;
  userEmail: string;
  sellerName: string;
  listingTitle: string;
  offerAmount: number;
  actionUrl: string;
}

export interface OfferCounterData {
  userName: string;
  userEmail: string;
  sellerName: string;
  listingTitle: string;
  originalOfferAmount: number;
  counterOfferAmount: number;
  actionUrl: string;
}

export function getOfferReceivedTemplate(data: OfferReceivedData): { subject: string; html: string; text: string } {
  const subject = `💰 New Offer: $${data.offerAmount.toFixed(2)} on "${data.listingTitle}"`;
  
  const content = `
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; width: 80px; height: 80px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 32px; margin-bottom: 16px;">
        💰
      </div>
      <h1 style="color: #1e293b; font-size: 28px; font-weight: 700; margin: 0; line-height: 1.2;">
        New Offer Received!
      </h1>
    </div>

    <div style="background: #f8fafc; border-radius: 12px; padding: 24px; margin-bottom: 32px; border-left: 4px solid #10b981;">
      <h2 style="color: #1e293b; font-size: 20px; font-weight: 600; margin: 0 0 16px 0;">
        Offer Details
      </h2>
      <div style="display: grid; gap: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
          <span style="color: #64748b; font-weight: 500;">Buyer:</span>
          <span style="color: #1e293b; font-weight: 600;">${data.buyerName}</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
          <span style="color: #64748b; font-weight: 500;">Listing:</span>
          <span style="color: #1e293b; font-weight: 600;">${data.listingTitle}</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
          <span style="color: #64748b; font-weight: 500;">Your Price:</span>
          <span style="color: #1e293b; font-weight: 600;">$${data.listingPrice.toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0;">
          <span style="color: #64748b; font-weight: 500;">Offer Amount:</span>
          <span style="color: #10b981; font-weight: 700; font-size: 18px;">$${data.offerAmount.toFixed(2)}</span>
        </div>
      </div>
    </div>

    <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 32px;">
      Hi ${data.userName},<br><br>
      Great news! ${data.buyerName} has made an offer on your listing "${data.listingTitle}". 
      You can review the offer details above and decide whether to accept, decline, or make a counter-offer.
    </p>

    <div style="text-align: center; margin-bottom: 32px;">
      <a href="${data.actionUrl}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3); transition: all 0.2s ease;">
        Review Offer
      </a>
    </div>

    <div style="background: #fef3c7; border-radius: 8px; padding: 16px; margin-bottom: 24px; border-left: 4px solid #f59e0b;">
      <p style="color: #92400e; font-size: 14px; margin: 0; font-weight: 500;">
        💡 <strong>Tip:</strong> Offers expire after 7 days. Make sure to respond promptly to keep potential buyers engaged!
      </p>
    </div>
  `;

  const textContent = `
New Offer Received!

Hi ${data.userName},

${data.buyerName} has made an offer on your listing "${data.listingTitle}".

Offer Details:
- Buyer: ${data.buyerName}
- Listing: ${data.listingTitle}
- Your Price: $${data.listingPrice.toFixed(2)}
- Offer Amount: $${data.offerAmount.toFixed(2)}

You can review and respond to this offer by visiting: ${data.actionUrl}

Remember: Offers expire after 7 days, so make sure to respond promptly!

Best regards,
The Waboku.gg Team
  `;

  const html = getBaseEmailTemplate({
    content,
    actionUrl: data.actionUrl,
    actionText: 'Review Offer'
  });

  return { subject, html, text: textContent };
}

export function getOfferAcceptedTemplate(data: OfferAcceptedData): { subject: string; html: string; text: string } {
  const subject = `✅ Offer Accepted: "${data.listingTitle}" for $${data.offerAmount.toFixed(2)}`;
  
  const content = `
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; width: 80px; height: 80px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 32px; margin-bottom: 16px;">
        ✅
      </div>
      <h1 style="color: #1e293b; font-size: 28px; font-weight: 700; margin: 0; line-height: 1.2;">
        Offer Accepted!
      </h1>
    </div>

    <div style="background: #f0fdf4; border-radius: 12px; padding: 24px; margin-bottom: 32px; border-left: 4px solid #10b981;">
      <h2 style="color: #1e293b; font-size: 20px; font-weight: 600; margin: 0 0 16px 0;">
        Purchase Details
      </h2>
      <div style="display: grid; gap: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #dcfce7;">
          <span style="color: #166534; font-weight: 500;">Seller:</span>
          <span style="color: #1e293b; font-weight: 600;">${data.sellerName}</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #dcfce7;">
          <span style="color: #166534; font-weight: 500;">Item:</span>
          <span style="color: #1e293b; font-weight: 600;">${data.listingTitle}</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0;">
          <span style="color: #166534; font-weight: 500;">Final Price:</span>
          <span style="color: #10b981; font-weight: 700; font-size: 18px;">$${data.offerAmount.toFixed(2)}</span>
        </div>
      </div>
    </div>

    <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 32px;">
      Hi ${data.userName},<br><br>
      Congratulations! ${data.sellerName} has accepted your offer of $${data.offerAmount.toFixed(2)} for "${data.listingTitle}". 
      You can now proceed with the payment to complete your purchase.
    </p>

    <div style="text-align: center; margin-bottom: 32px;">
      <a href="${data.actionUrl}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3); transition: all 0.2s ease;">
        Complete Purchase
      </a>
    </div>

    <div style="background: #dbeafe; border-radius: 8px; padding: 16px; margin-bottom: 24px; border-left: 4px solid #3b82f6;">
      <p style="color: #1e40af; font-size: 14px; margin: 0; font-weight: 500;">
        🚀 <strong>Next Steps:</strong> Complete your payment within 24 hours to secure your purchase. The seller will be notified once payment is received.
      </p>
    </div>
  `;

  const textContent = `
Offer Accepted!

Hi ${data.userName},

Great news! ${data.sellerName} has accepted your offer of $${data.offerAmount.toFixed(2)} for "${data.listingTitle}".

Purchase Details:
- Seller: ${data.sellerName}
- Item: ${data.listingTitle}
- Final Price: $${data.offerAmount.toFixed(2)}

Complete your purchase by visiting: ${data.actionUrl}

Please complete your payment within 24 hours to secure your purchase.

Best regards,
The Waboku.gg Team
  `;

  const html = getBaseEmailTemplate({
    content,
    actionUrl: data.actionUrl,
    actionText: 'Complete Purchase'
  });

  return { subject, html, text: textContent };
}

export function getOfferDeclinedTemplate(data: OfferDeclinedData): { subject: string; html: string; text: string } {
  const subject = `❌ Offer Declined: "${data.listingTitle}"`;
  
  const content = `
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; width: 80px; height: 80px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 32px; margin-bottom: 16px;">
        ❌
      </div>
      <h1 style="color: #1e293b; font-size: 28px; font-weight: 700; margin: 0; line-height: 1.2;">
        Offer Declined
      </h1>
    </div>

    <div style="background: #fef2f2; border-radius: 12px; padding: 24px; margin-bottom: 32px; border-left: 4px solid #ef4444;">
      <h2 style="color: #1e293b; font-size: 20px; font-weight: 600; margin: 0 0 16px 0;">
        Offer Details
      </h2>
      <div style="display: grid; gap: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #fecaca;">
          <span style="color: #991b1b; font-weight: 500;">Seller:</span>
          <span style="color: #1e293b; font-weight: 600;">${data.sellerName}</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #fecaca;">
          <span style="color: #991b1b; font-weight: 500;">Item:</span>
          <span style="color: #1e293b; font-weight: 600;">${data.listingTitle}</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0;">
          <span style="color: #991b1b; font-weight: 500;">Your Offer:</span>
          <span style="color: #ef4444; font-weight: 700; font-size: 18px;">$${data.offerAmount.toFixed(2)}</span>
        </div>
      </div>
    </div>

    <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 32px;">
      Hi ${data.userName},<br><br>
      Unfortunately, ${data.sellerName} has declined your offer of $${data.offerAmount.toFixed(2)} for "${data.listingTitle}". 
      Don't worry - there are plenty of other great items available on our marketplace!
    </p>

    <div style="text-align: center; margin-bottom: 32px;">
      <a href="${data.actionUrl}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3); transition: all 0.2s ease;">
        Browse More Items
      </a>
    </div>

    <div style="background: #f0f9ff; border-radius: 8px; padding: 16px; margin-bottom: 24px; border-left: 4px solid #3b82f6;">
      <p style="color: #1e40af; font-size: 14px; margin: 0; font-weight: 500;">
        💡 <strong>Tip:</strong> Try browsing similar items or setting up a wanted post to let sellers know what you're looking for!
      </p>
    </div>
  `;

  const textContent = `
Offer Declined

Hi ${data.userName},

${data.sellerName} has declined your offer of $${data.offerAmount.toFixed(2)} for "${data.listingTitle}".

Offer Details:
- Seller: ${data.sellerName}
- Item: ${data.listingTitle}
- Your Offer: $${data.offerAmount.toFixed(2)}

Don't worry - there are plenty of other great items available! Browse more items: ${data.actionUrl}

Tip: Try browsing similar items or setting up a wanted post to let sellers know what you're looking for!

Best regards,
The Waboku.gg Team
  `;

  const html = getBaseEmailTemplate({
    content,
    actionUrl: data.actionUrl,
    actionText: 'Browse More Items'
  });

  return { subject, html, text: textContent };
}

export function getOfferCounterTemplate(data: OfferCounterData): { subject: string; html: string; text: string } {
  const subject = `🔄 Counter Offer: $${data.counterOfferAmount.toFixed(2)} for "${data.listingTitle}"`;
  
  const content = `
    <div style="text-align: center; margin-bottom: 32px;">
      <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; width: 80px; height: 80px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 32px; margin-bottom: 16px;">
        🔄
      </div>
      <h1 style="color: #1e293b; font-size: 28px; font-weight: 700; margin: 0; line-height: 1.2;">
        Counter Offer Received!
      </h1>
    </div>

    <div style="background: #fffbeb; border-radius: 12px; padding: 24px; margin-bottom: 32px; border-left: 4px solid #f59e0b;">
      <h2 style="color: #1e293b; font-size: 20px; font-weight: 600; margin: 0 0 16px 0;">
        Counter Offer Details
      </h2>
      <div style="display: grid; gap: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #fef3c7;">
          <span style="color: #92400e; font-weight: 500;">Seller:</span>
          <span style="color: #1e293b; font-weight: 600;">${data.sellerName}</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #fef3c7;">
          <span style="color: #92400e; font-weight: 500;">Item:</span>
          <span style="color: #1e293b; font-weight: 600;">${data.listingTitle}</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #fef3c7;">
          <span style="color: #92400e; font-weight: 500;">Your Original Offer:</span>
          <span style="color: #64748b; font-weight: 600;">$${data.originalOfferAmount.toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0;">
          <span style="color: #92400e; font-weight: 500;">Counter Offer:</span>
          <span style="color: #f59e0b; font-weight: 700; font-size: 18px;">$${data.counterOfferAmount.toFixed(2)}</span>
        </div>
      </div>
    </div>

    <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 32px;">
      Hi ${data.userName},<br><br>
      ${data.sellerName} has made a counter offer of $${data.counterOfferAmount.toFixed(2)} for "${data.listingTitle}". 
      This is in response to your original offer of $${data.originalOfferAmount.toFixed(2)}. You can accept this counter offer or make another offer.
    </p>

    <div style="text-align: center; margin-bottom: 32px;">
      <a href="${data.actionUrl}" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; text-decoration: none; padding: 16px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3); transition: all 0.2s ease;">
        Review Counter Offer
      </a>
    </div>

    <div style="background: #dbeafe; border-radius: 8px; padding: 16px; margin-bottom: 24px; border-left: 4px solid #3b82f6;">
      <p style="color: #1e40af; font-size: 14px; margin: 0; font-weight: 500;">
        🤝 <strong>Negotiation Tip:</strong> Counter offers show the seller is interested in making a deal. Consider accepting or making a reasonable counter-offer to close the deal!
      </p>
    </div>
  `;

  const textContent = `
Counter Offer Received!

Hi ${data.userName},

${data.sellerName} has made a counter offer for "${data.listingTitle}".

Counter Offer Details:
- Seller: ${data.sellerName}
- Item: ${data.listingTitle}
- Your Original Offer: $${data.originalOfferAmount.toFixed(2)}
- Counter Offer: $${data.counterOfferAmount.toFixed(2)}

Review and respond to this counter offer: ${data.actionUrl}

Tip: Counter offers show the seller is interested in making a deal. Consider accepting or making a reasonable counter-offer!

Best regards,
The Waboku.gg Team
  `;

  const html = getBaseEmailTemplate({
    content,
    actionUrl: data.actionUrl,
    actionText: 'Review Counter Offer'
  });

  return { subject, html, text: textContent };
}