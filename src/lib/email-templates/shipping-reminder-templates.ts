export interface ShippingReminderData {
  userName: string;
  userEmail: string;
  orderNumber: string;
  orderId: string;
  buyerName: string;
  listingTitle: string;
  orderAmount: number;
  orderDate: string;
  hoursOverdue: number;
  shippingAddress: string;
}

export function getShippingReminderTemplate(data: ShippingReminderData): { subject: string; html: string; text: string } {
  const { userName, orderNumber, buyerName, listingTitle, orderAmount, orderDate, hoursOverdue, shippingAddress, orderId } = data;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://waboku.gg';
  const orderUrl = `${baseUrl}/dashboard/orders/${orderId}`;

  const subject = `⏰ Shipping reminder: Order #${orderNumber} needs attention`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Shipping Reminder</title>
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
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
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
            color: #fbbf24;
        }
        
        .tagline {
            color: #fef3c7;
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
            color: #f59e0b;
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
            background: #f59e0b;
            color: #ffffff;
            padding: 16px 32px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 18px;
            margin: 24px 0;
            text-align: center;
            transition: all 0.2s ease;
            box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3);
        }
        
        .cta-button:hover {
            background: #d97706;
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);
        }
        
        .urgent-notice {
            background: #fef3c7;
            border: 2px solid #f59e0b;
            border-radius: 8px;
            padding: 24px;
            margin: 28px 0;
            text-align: center;
        }
        
        .urgent-notice-title {
            color: #92400e;
            font-weight: 600;
            font-size: 20px;
            margin-bottom: 12px;
        }
        
        .urgent-notice-content {
            color: #92400e;
            font-size: 16px;
            line-height: 1.6;
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
        
        .status-overdue {
            background: rgba(239, 68, 68, 0.1);
            color: #dc2626;
            border: 1px solid #dc2626;
        }
        
        .info-box {
            background: rgba(245, 158, 11, 0.05);
            border: 1px solid rgba(245, 158, 11, 0.2);
            border-radius: 8px;
            padding: 24px;
            margin: 28px 0;
        }
        
        .info-box-title {
            color: #f59e0b;
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
            color: #f59e0b;
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
                background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
                padding: 24px 20px;
                border-bottom: 1px solid #2a3441;
            }
            
            .logo {
                font-size: 28px;
                color: #ffffff;
            }
            
            .tagline {
                color: #fef3c7;
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
                color: #f59e0b;
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
            
            .urgent-notice {
                background: rgba(245, 158, 11, 0.2);
                border: 2px solid #f59e0b;
                padding: 16px;
                margin: 20px 0;
            }
            
            .urgent-notice-title {
                color: #fbbf24;
                font-size: 18px;
            }
            
            .urgent-notice-content {
                color: #fef3c7;
                font-size: 14px;
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
            
            .status-overdue {
                background: rgba(239, 68, 68, 0.2);
                color: #f87171;
                border: 1px solid #dc2626;
            }
            
            .info-box {
                background: rgba(245, 158, 11, 0.1);
                border: 1px solid rgba(245, 158, 11, 0.3);
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
            <div class="tagline">Shipping Reminder</div>
        </div>
        <div class="content">
            <h1>⏰ Shipping reminder needed</h1>
            <p>Hey ${userName},</p>
            
            <div class="urgent-notice">
                <div class="urgent-notice-title">Action Required</div>
                <div class="urgent-notice-content">Your order is ${hoursOverdue} hours overdue for shipping. Please update the shipping status or add tracking information as soon as possible.</div>
            </div>
            
            <p>You have an order from <strong>${buyerName}</strong> that was placed ${orderDate} and needs to be shipped. Buyers expect their orders to be processed within 48 hours of purchase.</p>
            
            <div class="order-summary">
                <h2>Order Details</h2>
                <div class="order-item">
                    <span><strong>Order #:</strong></span>
                    <span>${orderNumber}</span>
                </div>
                <div class="order-item">
                    <span><strong>Item:</strong></span>
                    <span>${listingTitle}</span>
                </div>
                <div class="order-item">
                    <span><strong>Amount:</strong></span>
                    <span>$${orderAmount.toFixed(2)}</span>
                </div>
                <div class="order-item">
                    <span><strong>Buyer:</strong></span>
                    <span>${buyerName}</span>
                </div>
                <div class="order-item">
                    <span><strong>Status:</strong></span>
                    <span class="status-badge status-overdue">${hoursOverdue}h Overdue</span>
                </div>
            </div>
            
            <div style="text-align: center;">
                <a href="${orderUrl}" class="cta-button">Update Shipping Status</a>
            </div>
            
            <p><strong>Ship to:</strong><br>
            ${shippingAddress}</p>
            
            <div class="info-box">
                <div class="info-box-title">📦 What you need to do:</div>
                <div class="info-box-content">
                    1. Package your item securely<br>
                    2. Ship with a reliable carrier<br>
                    3. Add tracking information to the order<br>
                    4. Mark the order as "shipped" in your dashboard
                </div>
            </div>
            
            <p><strong>Why this matters:</strong></p>
            <p>• Buyers expect timely shipping for a great experience<br>
            • Late shipping can affect your seller rating<br>
            • Prompt shipping builds trust and encourages repeat customers<br>
            • Orders not shipped within 7 days may be eligible for automatic refunds</p>
            
            <p>Need help with shipping? Check out our <a href="${baseUrl}/dashboard/seller-account" style="color: #f59e0b;">seller resources</a> or contact our support team.</p>
            
            <p>Thanks for being part of the Waboku community!<br>
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
⏰ Shipping reminder needed

Hey ${userName},

ACTION REQUIRED: Your order is ${hoursOverdue} hours overdue for shipping. Please update the shipping status or add tracking information as soon as possible.

You have an order from ${buyerName} that was placed ${orderDate} and needs to be shipped. Buyers expect their orders to be processed within 48 hours of purchase.

Order Details:
Order #: ${orderNumber}
Item: ${listingTitle}
Amount: $${orderAmount.toFixed(2)}
Buyer: ${buyerName}
Status: ${hoursOverdue}h Overdue

Update Shipping Status: ${orderUrl}

Ship to:
${shippingAddress}

📦 What you need to do:
1. Package your item securely
2. Ship with a reliable carrier
3. Add tracking information to the order
4. Mark the order as "shipped" in your dashboard

Why this matters:
• Buyers expect timely shipping for a great experience
• Late shipping can affect your seller rating
• Prompt shipping builds trust and encourages repeat customers
• Orders not shipped within 7 days may be eligible for automatic refunds

Need help with shipping? Check out our seller resources at ${baseUrl}/dashboard/seller-account or contact our support team.

Thanks for being part of the Waboku community!
The Waboku Team

© 2025 Waboku. All rights reserved.
Questions? Contact us at support@waboku.gg
`;

  return { subject, html, text };
}