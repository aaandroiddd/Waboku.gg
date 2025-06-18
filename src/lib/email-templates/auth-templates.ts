export interface VerificationEmailData {
  userName: string;
  userEmail: string;
  verificationCode: string;
  verificationLink: string;
}

export function getVerificationEmailTemplate(data: VerificationEmailData): { subject: string; html: string; text: string } {
  const { userName, verificationCode, verificationLink } = data;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://waboku.gg';

  const subject = '🔐 Verify your email';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify Your Account</title>
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
        
        .verification-code {
            background: linear-gradient(135deg, #00bcd4, #00acc1);
            color: white;
            font-size: 36px;
            font-weight: 600;
            padding: 32px;
            text-align: center;
            border-radius: 12px;
            margin: 32px 0;
            letter-spacing: 12px;
            font-family: 'Courier New', monospace;
            box-shadow: 0 4px 16px rgba(0, 188, 212, 0.3);
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
            
            .verification-code {
                font-size: 24px;
                letter-spacing: 4px;
                padding: 24px;
                margin: 24px 0;
                box-shadow: none;
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
            <div class="tagline">Verify Your Account</div>
        </div>
        <div class="content">
            <h1>Verify your email 🔐</h1>
            <p>Hey ${userName},</p>
            <p>Welcome to Waboku! You're just one step away from joining our community of TCG collectors and accessing the marketplace.</p>
            
            <p>Please verify your email address to activate your account:</p>
            
            <div class="verification-code">
                ${verificationCode}
            </div>
            
            <div style="text-align: center;">
                <a href="${verificationLink}" class="cta-button">Verify My Account</a>
            </div>
            
            <div class="info-box">
                <div class="info-box-title">🛡️ Why we verify emails</div>
                <div class="info-box-content">Email verification helps us keep the marketplace secure and ensures you receive important updates about your orders and account activity.</div>
            </div>
            
            <p>You can also manually enter this verification code on the verification page:</p>
            <p style="text-align: center; font-family: 'Courier New', monospace; background: #0f1419; padding: 16px; border-radius: 6px; font-size: 18px; letter-spacing: 2px; border: 1px solid #2a3441;">${verificationCode}</p>
            
            <p><strong>This code expires in 24 hours</strong> for security purposes.</p>
            
            <p>If you didn't create an account with Waboku, you can safely ignore this email.</p>
            
            <p>Welcome to the community!<br>
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
Verify your email 🔐

Hey ${userName},

Welcome to Waboku! You're just one step away from joining our community of TCG collectors and accessing the marketplace.

Please verify your email address to activate your account:

Verification Code: ${verificationCode}

Verify My Account: ${verificationLink}

🛡️ Why we verify emails
Email verification helps us keep the marketplace secure and ensures you receive important updates about your orders and account activity.

You can also manually enter this verification code on the verification page: ${verificationCode}

This code expires in 24 hours for security purposes.

If you didn't create an account with Waboku, you can safely ignore this email.

Welcome to the community!
The Waboku Team

© 2025 Waboku. All rights reserved.
Questions? Contact us at support@waboku.gg
`;

  return { subject, html, text };
}

export interface PasswordResetData {
  userName: string;
  userEmail: string;
  resetLink: string;
}

export function getPasswordResetTemplate(data: PasswordResetData): { subject: string; html: string; text: string } {
  const { userName, resetLink } = data;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://waboku.gg';

  const subject = '🔑 Reset your password';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Reset</title>
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
            
            .protection-notice {
                background: rgba(34, 197, 94, 0.1);
                border: 1px solid rgba(34, 197, 94, 0.3);
                padding: 16px;
                margin: 20px 0;
            }
            
            .protection-notice-title {
                font-size: 16px;
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
            <div class="tagline">Password Reset</div>
        </div>
        <div class="content">
            <h1>Reset your password 🔑</h1>
            <p>Hey ${userName},</p>
            <p>We received a request to reset your password for your Waboku account. No worries - it happens to the best of us!</p>
            
            <div style="text-align: center;">
                <a href="${resetLink}" class="cta-button">Reset My Password</a>
            </div>
            
            <div class="info-box">
                <div class="info-box-title">🔒 Secure Reset Process</div>
                <div class="info-box-content">This link will take you to a secure page where you can create a new password for your account. The link is unique to you and expires soon for security.</div>
            </div>
            
            <p><strong>Important Security Information:</strong></p>
            <p>• This reset link expires in 1 hour<br>
            • The link can only be used once<br>
            • If you didn't request this reset, please ignore this email<br>
            • Your current password remains active until you complete the reset</p>
            
            <p>If the button above doesn't work, copy and paste this link into your browser:</p>
            <p style="background: #0f1419; padding: 16px; border-radius: 6px; word-break: break-all; font-size: 14px; border: 1px solid #2a3441; font-family: 'Courier New', monospace;">${resetLink}</p>
            
            <div class="protection-notice">
                <div class="protection-notice-title">🔐 Account Security</div>
                <div class="info-box-content">Need help with account security? Contact our support team - we're here to help keep your account safe.</div>
            </div>
            
            <p>Stay secure!<br>
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
Reset your password 🔑

Hey ${userName},

We received a request to reset your password for your Waboku account. No worries - it happens to the best of us!

Reset My Password: ${resetLink}

🔒 Secure Reset Process
This link will take you to a secure page where you can create a new password for your account. The link is unique to you and expires soon for security.

Important Security Information:
• This reset link expires in 1 hour
• The link can only be used once
• If you didn't request this reset, please ignore this email
• Your current password remains active until you complete the reset

If the button above doesn't work, copy and paste this link into your browser:
${resetLink}

🔐 Account Security
Need help with account security? Contact our support team - we're here to help keep your account safe.

Stay secure!
The Waboku Team

© 2025 Waboku. All rights reserved.
Questions? Contact us at support@waboku.gg
`;

  return { subject, html, text };
}