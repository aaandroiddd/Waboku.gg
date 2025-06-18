// Export all email templates from a central location
export { getBaseEmailTemplate, EmailTemplateData } from './base-template';
export { getWelcomeEmailTemplate, WelcomeEmailData } from './welcome-template';
export { getNotificationEmailTemplate, NotificationEmailData } from './notification-templates';
export { getOrderConfirmationTemplate, getPaymentConfirmationTemplate, OrderConfirmationData, PaymentConfirmationData } from './order-templates';
export { getShippingNotificationTemplate, ShippingNotificationData } from './shipping-templates';
export { getVerificationEmailTemplate, getPasswordResetTemplate, VerificationEmailData, PasswordResetData } from './auth-templates';