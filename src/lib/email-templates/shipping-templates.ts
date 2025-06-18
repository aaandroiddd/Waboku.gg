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
        
        .status-shipped {
            background: rgba(0, 188, 212, 0.1);
            color: #00bcd4;
            border: 1px solid #00bcd4;
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
            
            .seller-info {
                background: #0f1419;
                border: 1px solid #2a3441;
                padding: 16px;
                margin: 20px 0;
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
            
            .status-badge {
                padding: 6px 12px;
                font-size: 12px;
            }
            
            .status-shipped {
                background: rgba(0, 188, 212, 0.2);
                color: #00bcd4;
                border: 1px solid #00bcd4;
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