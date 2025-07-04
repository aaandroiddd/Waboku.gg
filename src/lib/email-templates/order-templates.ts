export interface OrderConfirmationData {
  userName: string;
  userEmail: string;
  orderNumber: string;
  orderDate: string;
  cardName: string;
  setName: string;
  condition: string;
  quantity: number;
  price: string;
  sellerName: string;
  sellerLocation: string;
  subtotal: string;
  shipping: string;
  fee: string;
  total: string;
  shippingAddress: string;
  orderId: string;
}

export function getOrderConfirmationTemplate(data: OrderConfirmationData): { subject: string; html: string; text: string } {
  const { userName, orderNumber, orderDate, cardName, setName, condition, quantity, price, sellerName, sellerLocation, subtotal, shipping, fee, total, shippingAddress, orderId } = data;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://waboku.gg';

  const subject = '⚡ Purchase confirmed!';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Purchase Confirmed</title>
    <style>
        /* Reset and base styles for email clients */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            background-color: #f8fafc;
            color: #1e293b;
            padding: 20px;
        }
        
        .email-container {
            max-width: 800px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
            border: 1px solid #e2e8f0;
        }
        
        .header {
            background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
            padding: 40px;
            text-align: center;
            border-bottom: 1px solid #e2e8f0;
        }
        
        .logo {
            font-size: 36px;
            font-weight: 600;
            color: #ffffff;
            margin-bottom: 8px;
        }
        
        .logo .gg {
            color: #00bcd4;
        }
        
        .tagline {
            color: #cbd5e1;
            font-size: 18px;
            font-weight: 400;
        }
        
        .content {
            padding: 50px;
            background: #ffffff;
        }
        
        .content h1 {
            color: #1e293b;
            font-size: 32px;
            font-weight: 600;
            margin-bottom: 28px;
            text-align: center;
        }
        
        .content h2 {
            color: #00bcd4;
            font-size: 24px;
            font-weight: 600;
            margin: 36px 0 20px 0;
            padding-bottom: 12px;
            border-bottom: 2px solid #e2e8f0;
        }
        
        .content p {
            margin-bottom: 24px;
            color: #475569;
            font-size: 18px;
            line-height: 1.7;
        }
        
        .cta-button {
            display: inline-block;
            background: #00bcd4;
            color: #ffffff;
            padding: 16px 32px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 18px;
            margin: 24px 0;
            text-align: center;
            transition: all 0.2s ease;
            box-shadow: 0 2px 8px rgba(0, 188, 212, 0.3);
        }
        
        .cta-button:hover {
            background: #00acc1;
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(0, 188, 212, 0.4);
        }
        
        .order-summary {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 28px;
            margin: 28px 0;
        }
        
        .order-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 14px 0;
            border-bottom: 1px solid #e2e8f0;
            font-size: 16px;
            color: #475569;
        }
        
        .order-item:last-child {
            border-bottom: none;
            font-weight: 600;
            color: #00bcd4;
            font-size: 20px;
            padding-top: 18px;
            margin-top: 12px;
            border-top: 2px solid #e2e8f0;
        }
        
        .card-listing {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 24px;
            margin: 24px 0;
            display: flex;
            gap: 20px;
            align-items: center;
        }
        
        .card-image {
            width: 90px;
            height: 126px;
            background: linear-gradient(135deg, #e2e8f0, #f1f5f9);
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            color: #64748b;
            text-align: center;
            flex-shrink: 0;
            border: 1px solid #cbd5e1;
        }
        
        .card-details {
            flex: 1;
        }
        
        .card-name {
            font-weight: 600;
            color: #1e293b;
            margin-bottom: 6px;
            font-size: 18px;
        }
        
        .card-meta {
            font-size: 16px;
            color: #64748b;
            margin-bottom: 10px;
        }
        
        .card-price {
            font-size: 20px;
            font-weight: 600;
            color: #00bcd4;
        }
        
        .seller-info {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 20px;
            margin: 24px 0;
            display: flex;
            align-items: center;
            gap: 16px;
        }
        
        .seller-avatar {
            width: 48px;
            height: 48px;
            background: #00bcd4;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 600;
            color: #ffffff;
            font-size: 18px;
        }
        
        .seller-details h4 {
            color: #1e293b;
            font-size: 18px;
            margin-bottom: 4px;
        }
        
        .seller-details p {
            color: #64748b;
            font-size: 16px;
            margin: 0;
        }
        
        .verified-badge {
            background: #00bcd4;
            color: #ffffff;
            font-size: 12px;
            padding: 4px 8px;
            border-radius: 6px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .status-badge {
            display: inline-block;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .status-confirmed {
            background: rgba(34, 197, 94, 0.1);
            color: #22c55e;
            border: 1px solid #22c55e;
        }
        
        .info-box {
            background: rgba(0, 188, 212, 0.05);
            border: 1px solid rgba(0, 188, 212, 0.2);
            border-radius: 8px;
            padding: 24px;
            margin: 28px 0;
        }
        
        .info-box-title {
            color: #00bcd4;
            font-weight: 600;
            font-size: 18px;
            margin-bottom: 12px;
        }
        
        .info-box-content {
            color: #475569;
            font-size: 16px;
            line-height: 1.6;
        }
        
        .footer {
            background: #f8fafc;
            padding: 40px 50px;
            text-align: center;
            border-top: 1px solid #e2e8f0;
        }
        
        .footer p {
            margin: 10px 0;
            color: #64748b;
            font-size: 16px;
        }
        
        .social-links {
            margin: 24px 0;
        }
        
        .social-links a {
            color: #00bcd4;
            text-decoration: none;
            margin: 0 16px;
            font-size: 16px;
            font-weight: 500;
        }
        
        /* Mobile styles - keep original dark theme */
        @media only screen and (max-width: 600px) {
            body {
                background-color: #0f1419;
                color: #ffffff;
                padding: 0;
            }
            
            .email-container {
                max-width: 100%;
                margin: 0;
                border-radius: 0;
                background: #1e2328;
                border: none;
                box-shadow: none;
            }
            
            .header {
                background: linear-gradient(135deg, #1e2328 0%, #2a3441 100%);
                padding: 24px 20px;
                border-bottom: 1px solid #2a3441;
            }
            
            .logo {
                font-size: 28px;
                color: #ffffff;
            }
            
            .tagline {
                color: #8c9aad;
                font-size: 16px;
            }
            
            .content {
                padding: 24px 20px;
                background: #1e2328;
            }
            
            .content h1 {
                color: #ffffff;
                font-size: 24px;
            }
            
            .content h2 {
                color: #00bcd4;
                font-size: 18px;
                border-bottom: 1px solid #2a3441;
            }
            
            .content p {
                color: #c9d1d9;
                font-size: 16px;
                margin-bottom: 20px;
            }
            
            .cta-button {
                padding: 14px 28px;
                font-size: 16px;
                margin: 20px 0;
                box-shadow: none;
            }
            
            .order-summary {
                background: #0f1419;
                border: 1px solid #2a3441;
                padding: 24px;
                margin: 24px 0;
            }
            
            .order-item {
                flex-direction: column;
                align-items: flex-start;
                gap: 8px;
                font-size: 15px;
                color: #c9d1d9;
                border-bottom: 1px solid #2a3441;
            }
            
            .order-item:last-child {
                color: #00bcd4;
                font-size: 18px;
                border-top: 1px solid #2a3441;
            }
            
            .card-listing {
                background: #0f1419;
                border: 1px solid #2a3441;
                flex-direction: column;
                text-align: center;
                padding: 20px;
            }
            
            .card-image {
                width: 80px;
                height: 112px;
                background: linear-gradient(135deg, #2a3441, #1e2328);
                color: #8c9aad;
                font-size: 12px;
            }
            
            .card-name {
                color: #ffffff;
                font-size: 16px;
            }
            
            .card-meta {
                color: #8c9aad;
                font-size: 14px;
            }
            
            .card-price {
                font-size: 18px;
            }
            
            .seller-info {
                background: #0f1419;
                border: 1px solid #2a3441;
                padding: 16px;
            }
            
            .seller-avatar {
                width: 40px;
                height: 40px;
                font-size: 16px;
            }
            
            .seller-details h4 {
                color: #ffffff;
                font-size: 16px;
            }
            
            .seller-details p {
                color: #8c9aad;
                font-size: 14px;
            }
            
            .verified-badge {
                font-size: 11px;
                padding: 2px 6px;
            }
            
            .status-badge {
                padding: 6px 12px;
                font-size: 12px;
            }
            
            .info-box {
                background: rgba(0, 188, 212, 0.1);
                border: 1px solid rgba(0, 188, 212, 0.3);
                padding: 16px;
                margin: 20px 0;
            }
            
            .info-box-title {
                font-size: 16px;
            }
            
            .info-box-content {
                color: #c9d1d9;
                font-size: 14px;
            }
            
            .footer {
                background: #0f1419;
                padding: 32px 20px;
                border-top: 1px solid #2a3441;
            }
            
            .footer p {
                color: #8c9aad;
                font-size: 14px;
                margin: 8px 0;
            }
            
            .social-links a {
                font-size: 14px;
                margin: 0 12px;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <div class="logo">waboku<span class="gg">.gg</span></div>
            <div class="tagline">Purchase Confirmed</div>
        </div>
        <div class="content">
            <h1>Purchase confirmed! ⚡</h1>
            <p>Hey ${userName},</p>
            <p>Great news! Your purchase has been confirmed. The seller has been notified and will prepare your cards for shipment.</p>
            
            <div class="order-summary">
                <h2>Order Details</h2>
                <div class="order-item">
                    <span><strong>Order #:</strong></span>
                    <span>${orderNumber}</span>
                </div>
                <div class="order-item">
                    <span><strong>Purchase Date:</strong></span>
                    <span>${orderDate}</span>
                </div>
                <div class="order-item">
                    <span><strong>Status:</strong></span>
                    <span class="status-badge status-confirmed">Confirmed</span>
                </div>
            </div>
            
            <h2>Items Purchased</h2>
            <div class="card-listing">
                <div class="card-image">Card Image</div>
                <div class="card-details">
                    <div class="card-name">${cardName} - ${setName}</div>
                    <div class="card-meta">Condition: ${condition} • Quantity: ${quantity}</div>
                    <div class="card-price">$${price}</div>
                </div>
            </div>
            
            <h2>Seller Information</h2>
            <div class="seller-info">
                <div class="seller-avatar">${sellerName.substring(0, 2).toUpperCase()}</div>
                <div class="seller-details">
                    <h4>${sellerName} <span class="verified-badge">Verified</span></h4>
                    <p>Located in ${sellerLocation}</p>
                </div>
            </div>
            
            <div class="order-summary">
                <div class="order-item">
                    <span>Item Total:</span>
                    <span>$${subtotal}</span>
                </div>
                <div class="order-item">
                    <span>Shipping:</span>
                    <span>$${shipping}</span>
                </div>
                <div class="order-item">
                    <span>Processing Fee:</span>
                    <span>$${fee}</span>
                </div>
                <div class="order-item">
                    <span><strong>Total Paid:</strong></span>
                    <span><strong>$${total}</strong></span>
                </div>
            </div>
            
            <div style="text-align: center;">
                <a href="${baseUrl}/dashboard/orders/${orderId}" class="cta-button">Track Your Order</a>
            </div>
            
            <div class="info-box">
                <div class="info-box-title">📦 What Happens Next?</div>
                <div class="info-box-content">The seller will package your cards securely and provide tracking information. You'll receive another email once your order ships.</div>
            </div>
            
            <p><strong>Shipping Address:</strong><br>
            ${shippingAddress}</p>
            
            <p>Thanks for using Waboku to connect with fellow collectors!<br>
            <strong>The Waboku Team</strong></p>
        </div>
        <div class="footer">
            <div class="social-links">
                <a href="#">Discord</a>
                <a href="#">Twitter</a>
                <a href="#">Instagram</a>
            </div>
            <p>© 2025 Waboku. All rights reserved.</p>
            <p>Questions? Contact us at support@waboku.gg</p>
        </div>
    </div>
</body>
</html>`;

  const text = `
Purchase confirmed! ⚡

Hey ${userName},

Great news! Your purchase has been confirmed. The seller has been notified and will prepare your cards for shipment.

Order Details:
Order #: ${orderNumber}
Purchase Date: ${orderDate}
Status: Confirmed

Items Purchased:
${cardName} - ${setName}
Condition: ${condition} • Quantity: ${quantity}
Price: $${price}

Seller Information:
${sellerName} (Verified)
Located in ${sellerLocation}

Order Summary:
Item Total: $${subtotal}
Shipping: $${shipping}
Processing Fee: $${fee}
Total Paid: $${total}

Track Your Order: ${baseUrl}/dashboard/orders/${orderId}

📦 What Happens Next?
The seller will package your cards securely and provide tracking information. You'll receive another email once your order ships.

Shipping Address:
${shippingAddress}

Thanks for using Waboku to connect with fellow collectors!
The Waboku Team

© 2025 Waboku. All rights reserved.
Questions? Contact us at support@waboku.gg
`;

  return { subject, html, text };
}

export interface PaymentConfirmationData {
  userName: string;
  userEmail: string;
  transactionId: string;
  paymentMethod: string;
  amount: string;
  paymentDate: string;
  orderId: string;
}

export function getPaymentConfirmationTemplate(data: PaymentConfirmationData): { subject: string; html: string; text: string } {
  const { userName, transactionId, paymentMethod, amount, paymentDate, orderId } = data;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://waboku.gg';

  const subject = '💳 Payment received!';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payment Processed</title>
    <style>
        /* Reset and base styles for email clients */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            background-color: #f8fafc;
            color: #1e293b;
            padding: 20px;
        }
        
        .email-container {
            max-width: 800px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
            border: 1px solid #e2e8f0;
        }
        
        .header {
            background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
            padding: 40px;
            text-align: center;
            border-bottom: 1px solid #e2e8f0;
        }
        
        .logo {
            font-size: 36px;
            font-weight: 600;
            color: #ffffff;
            margin-bottom: 8px;
        }
        
        .logo .gg {
            color: #00bcd4;
        }
        
        .tagline {
            color: #cbd5e1;
            font-size: 18px;
            font-weight: 400;
        }
        
        .content {
            padding: 50px;
            background: #ffffff;
        }
        
        .content h1 {
            color: #1e293b;
            font-size: 32px;
            font-weight: 600;
            margin-bottom: 28px;
            text-align: center;
        }
        
        .content h2 {
            color: #00bcd4;
            font-size: 24px;
            font-weight: 600;
            margin: 36px 0 20px 0;
            padding-bottom: 12px;
            border-bottom: 2px solid #e2e8f0;
        }
        
        .content p {
            margin-bottom: 24px;
            color: #475569;
            font-size: 18px;
            line-height: 1.7;
        }
        
        .cta-button {
            display: inline-block;
            background: #00bcd4;
            color: #ffffff;
            padding: 16px 32px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 18px;
            margin: 24px 0;
            text-align: center;
            transition: all 0.2s ease;
            box-shadow: 0 2px 8px rgba(0, 188, 212, 0.3);
        }
        
        .cta-button:hover {
            background: #00acc1;
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(0, 188, 212, 0.4);
        }
        
        .order-summary {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 28px;
            margin: 28px 0;
        }
        
        .order-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 14px 0;
            border-bottom: 1px solid #e2e8f0;
            font-size: 16px;
            color: #475569;
        }
        
        .order-item:last-child {
            border-bottom: none;
            font-weight: 600;
            color: #00bcd4;
            font-size: 20px;
            padding-top: 18px;
            margin-top: 12px;
            border-top: 2px solid #e2e8f0;
        }
        
        .protection-notice {
            background: rgba(34, 197, 94, 0.05);
            border: 1px solid rgba(34, 197, 94, 0.2);
            border-radius: 8px;
            padding: 24px;
            margin: 28px 0;
        }
        
        .protection-notice-title {
            color: #22c55e;
            font-weight: 600;
            font-size: 18px;
            margin-bottom: 12px;
        }
        
        .info-box {
            background: rgba(0, 188, 212, 0.05);
            border: 1px solid rgba(0, 188, 212, 0.2);
            border-radius: 8px;
            padding: 24px;
            margin: 28px 0;
        }
        
        .info-box-title {
            color: #00bcd4;
            font-weight: 600;
            font-size: 18px;
            margin-bottom: 12px;
        }
        
        .info-box-content {
            color: #475569;
            font-size: 16px;
            line-height: 1.6;
        }
        
        .footer {
            background: #f8fafc;
            padding: 40px 50px;
            text-align: center;
            border-top: 1px solid #e2e8f0;
        }
        
        .footer p {
            margin: 10px 0;
            color: #64748b;
            font-size: 16px;
        }
        
        .social-links {
            margin: 24px 0;
        }
        
        .social-links a {
            color: #00bcd4;
            text-decoration: none;
            margin: 0 16px;
            font-size: 16px;
            font-weight: 500;
        }
        
        /* Mobile styles - keep original dark theme */
        @media only screen and (max-width: 600px) {
            body {
                background-color: #0f1419;
                color: #ffffff;
                padding: 0;
            }
            
            .email-container {
                max-width: 100%;
                margin: 0;
                border-radius: 0;
                background: #1e2328;
                border: none;
                box-shadow: none;
            }
            
            .header {
                background: linear-gradient(135deg, #1e2328 0%, #2a3441 100%);
                padding: 24px 20px;
                border-bottom: 1px solid #2a3441;
            }
            
            .logo {
                font-size: 28px;
                color: #ffffff;
            }
            
            .tagline {
                color: #8c9aad;
                font-size: 16px;
            }
            
            .content {
                padding: 24px 20px;
                background: #1e2328;
            }
            
            .content h1 {
                color: #ffffff;
                font-size: 24px;
            }
            
            .content h2 {
                color: #00bcd4;
                font-size: 18px;
                border-bottom: 1px solid #2a3441;
            }
            
            .content p {
                color: #c9d1d9;
                font-size: 16px;
                margin-bottom: 20px;
            }
            
            .cta-button {
                padding: 14px 28px;
                font-size: 16px;
                margin: 20px 0;
                box-shadow: none;
            }
            
            .order-summary {
                background: #0f1419;
                border: 1px solid #2a3441;
                padding: 24px;
                margin: 24px 0;
            }
            
            .order-item {
                flex-direction: column;
                align-items: flex-start;
                gap: 8px;
                font-size: 15px;
                color: #c9d1d9;
                border-bottom: 1px solid #2a3441;
            }
            
            .order-item:last-child {
                color: #00bcd4;
                font-size: 18px;
                border-top: 1px solid #2a3441;
            }
            
            .protection-notice {
                background: rgba(34, 197, 94, 0.1);
                border: 1px solid rgba(34, 197, 94, 0.3);
                padding: 16px;
                margin: 20px 0;
            }
            
            .protection-notice-title {
                font-size: 16px;
            }
            
            .info-box {
                background: rgba(0, 188, 212, 0.1);
                border: 1px solid rgba(0, 188, 212, 0.3);
                padding: 16px;
                margin: 20px 0;
            }
            
            .info-box-title {
                font-size: 16px;
            }
            
            .info-box-content {
                color: #c9d1d9;
                font-size: 14px;
            }
            
            .footer {
                background: #0f1419;
                padding: 32px 20px;
                border-top: 1px solid #2a3441;
            }
            
            .footer p {
                color: #8c9aad;
                font-size: 14px;
                margin: 8px 0;
            }
            
            .social-links a {
                font-size: 14px;
                margin: 0 12px;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <div class="logo">waboku<span class="gg">.gg</span></div>
            <div class="tagline">Payment Processed</div>
        </div>
        <div class="content">
            <h1>Payment received! 💳</h1>
            <p>Hey ${userName},</p>
            <p>We've successfully processed your payment. Your funds are being held securely until you receive and approve your cards.</p>
            
            <div class="order-summary">
                <h2>Payment Details</h2>
                <div class="order-item">
                    <span><strong>Transaction ID:</strong></span>
                    <span>${transactionId}</span>
                </div>
                <div class="order-item">
                    <span><strong>Payment Method:</strong></span>
                    <span>${paymentMethod}</span>
                </div>
                <div class="order-item">
                    <span><strong>Date:</strong></span>
                    <span>${paymentDate}</span>
                </div>
                <div class="order-item">
                    <span><strong>Amount:</strong></span>
                    <span><strong>$${amount}</strong></span>
                </div>
            </div>
            
            <div class="protection-notice">
                <div class="protection-notice-title">🛡️ Buyer Protection Active</div>
                <div class="info-box-content">Your payment is protected! Funds will only be released to the seller after you confirm receipt and condition of your cards.</div>
            </div>
            
            <div style="text-align: center;">
                <a href="${baseUrl}/dashboard/orders/${orderId}" class="cta-button">View Order Status</a>
            </div>
            
            <p>What happens next?</p>
            <p>• The seller will be notified of your payment<br>
            • Your cards will be packaged and shipped<br>
            • You'll receive tracking information<br>
            • Funds are released after delivery confirmation</p>
            
            <div class="info-box">
                <div class="info-box-title">💰 Seller Payout</div>
                <div class="info-box-content">The seller will receive payment once you confirm delivery. This protects both buyers and sellers in our marketplace.</div>
            </div>
            
            <p>Need a receipt? You can download your invoice from your order details page.</p>
            
            <p>Thanks for choosing Waboku!<br>
            <strong>The Waboku Team</strong></p>
        </div>
        <div class="footer">
            <div class="social-links">
                <a href="#">Discord</a>
                <a href="#">Twitter</a>
                <a href="#">Instagram</a>
            </div>
            <p>© 2025 Waboku. All rights reserved.</p>
            <p>Questions? Contact us at support@waboku.gg</p>
        </div>
    </div>
</body>
</html>`;

  const text = `
Payment received! 💳

Hey ${userName},

We've successfully processed your payment. Your funds are being held securely until you receive and approve your cards.

Payment Details:
Transaction ID: ${transactionId}
Payment Method: ${paymentMethod}
Date: ${paymentDate}
Amount: $${amount}

🛡️ Buyer Protection Active
Your payment is protected! Funds will only be released to the seller after you confirm receipt and condition of your cards.

View Order Status: ${baseUrl}/dashboard/orders/${orderId}

What happens next?
• The seller will be notified of your payment
• Your cards will be packaged and shipped
• You'll receive tracking information
• Funds are released after delivery confirmation

💰 Seller Payout
The seller will receive payment once you confirm delivery. This protects both buyers and sellers in our marketplace.

Need a receipt? You can download your invoice from your order details page.

Thanks for choosing Waboku!
The Waboku Team

© 2025 Waboku. All rights reserved.
Questions? Contact us at support@waboku.gg
`;

  return { subject, html, text };
}