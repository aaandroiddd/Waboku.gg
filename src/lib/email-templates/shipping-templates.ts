export interface ShippingNotificationData {
  userName: string;
  userEmail: string;
  sellerName: string;
  sellerLocation: string;
  orderNumber: string;
  trackingNumber: string;
  shippingCarrier: string;
  estimatedDelivery: string;
  shippingAddress: string;
  trackingUrl: string;
  orderId: string;
}

export function getShippingNotificationTemplate(data: ShippingNotificationData): { subject: string; html: string; text: string } {
  const { userName, sellerName, sellerLocation, orderNumber, trackingNumber, shippingCarrier, estimatedDelivery, shippingAddress, trackingUrl, orderId } = data;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://waboku.gg';

  const subject = '📦 Your cards are on the way!';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Shipped</title>
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
            background-color: #0f1419;
            color: #ffffff;
            padding: 20px;
        }
        
        .email-container {
            max-width: 600px;
            margin: 0 auto;
            background: #1e2328;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
            border: 1px solid #2a3441;
        }
        
        .header {
            background: linear-gradient(135deg, #1e2328 0%, #2a3441 100%);
            padding: 40px;
            text-align: center;
            border-bottom: 1px solid #2a3441;
        }
        
        .logo {
            font-size: 32px;
            font-weight: 600;
            color: #ffffff;
            margin-bottom: 8px;
        }
        
        .logo .gg {
            color: #00bcd4;
        }
        
        .tagline {
            color: #8c9aad;
            font-size: 16px;
            font-weight: 400;
        }
        
        .content {
            padding: 40px;
            background: #1e2328;
        }
        
        .content h1 {
            color: #ffffff;
            font-size: 28px;
            font-weight: 600;
            margin-bottom: 24px;
            text-align: center;
        }
        
        .content h2 {
            color: #00bcd4;
            font-size: 20px;
            font-weight: 600;
            margin: 32px 0 16px 0;
            padding-bottom: 8px;
            border-bottom: 1px solid #2a3441;
        }
        
        .content p {
            margin-bottom: 20px;
            color: #c9d1d9;
            font-size: 16px;
            line-height: 1.6;
        }
        
        .cta-button {
            display: inline-block;
            background: #00bcd4;
            color: #ffffff;
            padding: 14px 28px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            font-size: 16px;
            margin: 20px 0;
            text-align: center;
            transition: all 0.2s ease;
        }
        
        .cta-button:hover {
            background: #00acc1;
            transform: translateY(-1px);
        }
        
        .seller-info {
            background: #0f1419;
            border: 1px solid #2a3441;
            border-radius: 6px;
            padding: 16px;
            margin: 20px 0;
            display: flex;
            align-items: center;
            gap: 12px;
        }
        
        .seller-avatar {
            width: 40px;
            height: 40px;
            background: #00bcd4;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 600;
            color: #ffffff;
        }
        
        .seller-details h4 {
            color: #ffffff;
            font-size: 16px;
            margin-bottom: 2px;
        }
        
        .seller-details p {
            color: #8c9aad;
            font-size: 14px;
            margin: 0;
        }
        
        .verified-badge {
            background: #00bcd4;
            color: #ffffff;
            font-size: 11px;
            padding: 2px 6px;
            border-radius: 4px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .order-summary {
            background: #0f1419;
            border: 1px solid #2a3441;
            border-radius: 6px;
            padding: 24px;
            margin: 24px 0;
        }
        
        .order-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 0;
            border-bottom: 1px solid #2a3441;
            font-size: 15px;
        }
        
        .order-item:last-child {
            border-bottom: none;
        }
        
        .status-badge {
            display: inline-block;
            padding: 6px 12px;
            border-radius: 16px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .status-shipped {
            background: rgba(0, 188, 212, 0.2);
            color: #00bcd4;
            border: 1px solid #00bcd4;
        }
        
        .info-box {
            background: rgba(0, 188, 212, 0.1);
            border: 1px solid rgba(0, 188, 212, 0.3);
            border-radius: 6px;
            padding: 16px;
            margin: 20px 0;
        }
        
        .info-box-title {
            color: #00bcd4;
            font-weight: 600;
            margin-bottom: 8px;
        }
        
        .info-box-content {
            color: #c9d1d9;
            font-size: 14px;
        }
        
        .footer {
            background: #0f1419;
            padding: 32px 40px;
            text-align: center;
            border-top: 1px solid #2a3441;
        }
        
        .footer p {
            margin: 8px 0;
            color: #8c9aad;
            font-size: 14px;
        }
        
        .social-links {
            margin: 20px 0;
        }
        
        .social-links a {
            color: #00bcd4;
            text-decoration: none;
            margin: 0 12px;
            font-size: 14px;
        }
        
        @media only screen and (max-width: 600px) {
            .email-container {
                margin: 0;
                border-radius: 0;
            }
            
            .header, .content, .footer {
                padding: 24px 20px;
            }
            
            .logo {
                font-size: 28px;
            }
            
            .content h1 {
                font-size: 24px;
            }
            
            .content h2 {
                font-size: 18px;
            }
            
            .order-item {
                flex-direction: column;
                align-items: flex-start;
                gap: 8px;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <div class="logo">waboku<span class="gg">.gg</span></div>
            <div class="tagline">Shipped</div>
        </div>
        <div class="content">
            <h1>Your cards are on the way! 📦</h1>
            <p>Hey ${userName},</p>
            <p>Great news! ${sellerName} has shipped your cards. Your package is now in transit and you can track its progress below.</p>
            
            <div class="seller-info">
                <div class="seller-avatar">${sellerName.substring(0, 2).toUpperCase()}</div>
                <div class="seller-details">
                    <h4>${sellerName} <span class="verified-badge">Verified</span></h4>
                    <p>shipped your order from ${sellerLocation}</p>
                </div>
            </div>
            
            <div class="order-summary">
                <h2>Shipping Information</h2>
                <div class="order-item">
                    <span><strong>Order #:</strong></span>
                    <span>${orderNumber}</span>
                </div>
                <div class="order-item">
                    <span><strong>Tracking #:</strong></span>
                    <span>${trackingNumber}</span>
                </div>
                <div class="order-item">
                    <span><strong>Carrier:</strong></span>
                    <span>${shippingCarrier}</span>
                </div>
                <div class="order-item">
                    <span><strong>Status:</strong></span>
                    <span class="status-badge status-shipped">In Transit</span>
                </div>
                <div class="order-item">
                    <span><strong>Est. Delivery:</strong></span>
                    <span>${estimatedDelivery}</span>
                </div>
            </div>
            
            <div style="text-align: center;">
                <a href="${trackingUrl}" class="cta-button">Track Your Package</a>
            </div>
            
            <p><strong>Shipping to:</strong><br>
            ${shippingAddress}</p>
            
            <div class="info-box">
                <div class="info-box-title">📦 Package Protection</div>
                <div class="info-box-content">Your cards have been carefully packaged by the seller. If there are any issues upon delivery, our buyer protection has you covered.</div>
            </div>
            
            <p><strong>When you receive your package:</strong></p>
            <p>• Check that all cards match the listing description<br>
            • Verify the condition is as described<br>
            • Confirm delivery in your order dashboard<br>
            • Leave feedback for the seller</p>
            
            <p>Questions about your shipment? You can message the seller directly through your order page.</p>
            
            <p>Happy collecting!<br>
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
Your cards are on the way! 📦

Hey ${userName},

Great news! ${sellerName} has shipped your cards. Your package is now in transit and you can track its progress below.

Seller: ${sellerName} (Verified)
Shipped from: ${sellerLocation}

Shipping Information:
Order #: ${orderNumber}
Tracking #: ${trackingNumber}
Carrier: ${shippingCarrier}
Status: In Transit
Est. Delivery: ${estimatedDelivery}

Track Your Package: ${trackingUrl}

Shipping to:
${shippingAddress}

📦 Package Protection
Your cards have been carefully packaged by the seller. If there are any issues upon delivery, our buyer protection has you covered.

When you receive your package:
• Check that all cards match the listing description
• Verify the condition is as described
• Confirm delivery in your order dashboard
• Leave feedback for the seller

Questions about your shipment? You can message the seller directly through your order page.

Happy collecting!
The Waboku Team

© 2025 Waboku. All rights reserved.
Questions? Contact us at support@waboku.gg
`;

  return { subject, html, text };
}