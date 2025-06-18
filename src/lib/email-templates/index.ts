// Export all email templates from a central location
export { getBaseEmailTemplate } from './base-template';
export { getWelcomeEmailTemplate } from './welcome-template';
export { getNotificationEmailTemplate } from './notification-templates';
export { getOrderConfirmationTemplate, getPaymentConfirmationTemplate } from './order-templates';
export { getShippingNotificationTemplate } from './shipping-templates';
export { getVerificationEmailTemplate, getPasswordResetTemplate } from './auth-templates';
export { 
  getOfferReceivedTemplate, 
  getOfferAcceptedTemplate, 
  getOfferDeclinedTemplate, 
  getOfferCounterTemplate 
} from './offer-templates';
export { 
  getSubscriptionChargeTemplate,
  getSubscriptionSuccessTemplate,
  getSubscriptionCanceledTemplate,
  getSubscriptionFailedTemplate,
  getSubscriptionRenewalReminderTemplate
} from './subscription-templates';

// Export types
export type { EmailTemplateData } from './base-template';
export type { WelcomeEmailData } from './welcome-template';
export type { NotificationEmailData } from './notification-templates';
export type { OrderConfirmationData, PaymentConfirmationData } from './order-templates';
export type { ShippingNotificationData } from './shipping-templates';
export type { VerificationEmailData, PasswordResetData } from './auth-templates';
export type { 
  OfferReceivedData, 
  OfferAcceptedData, 
  OfferDeclinedData, 
  OfferCounterData 
} from './offer-templates';
export type { 
  SubscriptionChargeData,
  SubscriptionSuccessData,
  SubscriptionCanceledData,
  SubscriptionFailedData,
  SubscriptionRenewalReminderData
} from './subscription-templates';