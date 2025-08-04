import { getFirebaseAdmin } from './firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { emailService } from './email-service';

interface SecurityEvent {
  type: 'suspicious_offer' | 'rapid_reviews' | 'payment_anomaly' | 'auth_abuse' | 'listing_manipulation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId?: string;
  details: any;
  timestamp: Date;
  ip?: string;
  userAgent?: string;
}

interface SecurityThreshold {
  offers_per_hour: number;
  reviews_per_day: number;
  failed_auth_attempts: number;
  listing_creation_per_hour: number;
  suspicious_offer_ratio: number; // Offers significantly below listing price
}

const DEFAULT_THRESHOLDS: SecurityThreshold = {
  offers_per_hour: 20,
  reviews_per_day: 10,
  failed_auth_attempts: 5,
  listing_creation_per_hour: 15,
  suspicious_offer_ratio: 0.3 // Offers below 30% of listing price
};

class SecurityMonitor {
  private db = getFirestore();
  private thresholds = DEFAULT_THRESHOLDS;
  private alertEmails = ['security@waboku.gg', 'admin@waboku.gg'];

  /**
   * Log a security event
   */
  async logSecurityEvent(event: SecurityEvent): Promise<void> {
    try {
      await this.db.collection('securityEvents').add({
        ...event,
        timestamp: event.timestamp,
        processed: false
      });

      // Send immediate alert for critical events
      if (event.severity === 'critical') {
        await this.sendSecurityAlert(event);
      }

      console.log(`[security-monitor] Logged ${event.severity} security event:`, event.type);
    } catch (error) {
      console.error('[security-monitor] Failed to log security event:', error);
    }
  }

  /**
   * Monitor offer creation for suspicious patterns
   */
  async monitorOfferCreation(
    userId: string,
    listingId: string,
    offerAmount: number,
    listingPrice: number,
    ip?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      // Check for suspicious offer amount (too low)
      const offerRatio = offerAmount / listingPrice;
      if (offerRatio < this.thresholds.suspicious_offer_ratio) {
        await this.logSecurityEvent({
          type: 'suspicious_offer',
          severity: 'medium',
          userId,
          details: {
            listingId,
            offerAmount,
            listingPrice,
            ratio: offerRatio,
            reason: 'Offer significantly below listing price'
          },
          timestamp: new Date(),
          ip,
          userAgent
        });
      }

      // Check for rapid offer creation
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentOffers = await this.db.collection('offers')
        .where('buyerId', '==', userId)
        .where('createdAt', '>', oneHourAgo)
        .get();

      if (recentOffers.size >= this.thresholds.offers_per_hour) {
        await this.logSecurityEvent({
          type: 'suspicious_offer',
          severity: 'high',
          userId,
          details: {
            offersInLastHour: recentOffers.size,
            threshold: this.thresholds.offers_per_hour,
            reason: 'Excessive offer creation rate'
          },
          timestamp: new Date(),
          ip,
          userAgent
        });
      }

      // Check for offers on multiple listings by same seller (potential manipulation)
      const userOffers = await this.db.collection('offers')
        .where('buyerId', '==', userId)
        .where('createdAt', '>', oneHourAgo)
        .get();

      const sellerIds = new Set();
      userOffers.docs.forEach(doc => {
        sellerIds.add(doc.data().sellerId);
      });

      if (sellerIds.size === 1 && userOffers.size > 5) {
        await this.logSecurityEvent({
          type: 'suspicious_offer',
          severity: 'high',
          userId,
          details: {
            sellerId: Array.from(sellerIds)[0],
            offerCount: userOffers.size,
            reason: 'Multiple offers to same seller in short time'
          },
          timestamp: new Date(),
          ip,
          userAgent
        });
      }

    } catch (error) {
      console.error('[security-monitor] Error monitoring offer creation:', error);
    }
  }

  /**
   * Monitor review creation for suspicious patterns
   */
  async monitorReviewCreation(
    userId: string,
    sellerId: string,
    rating: number,
    ip?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      // Check for rapid review creation
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentReviews = await this.db.collection('reviews')
        .where('reviewerId', '==', userId)
        .where('createdAt', '>', oneDayAgo)
        .get();

      if (recentReviews.size >= this.thresholds.reviews_per_day) {
        await this.logSecurityEvent({
          type: 'rapid_reviews',
          severity: 'high',
          userId,
          details: {
            reviewsInLastDay: recentReviews.size,
            threshold: this.thresholds.reviews_per_day,
            reason: 'Excessive review creation rate'
          },
          timestamp: new Date(),
          ip,
          userAgent
        });
      }

      // Check for suspicious rating patterns (all 5-star or all 1-star)
      const userReviews = recentReviews.docs.map(doc => doc.data().rating);
      if (userReviews.length >= 3) {
        const allSameRating = userReviews.every(r => r === userReviews[0]);
        const extremeRatings = userReviews.every(r => r === 1 || r === 5);

        if (allSameRating || extremeRatings) {
          await this.logSecurityEvent({
            type: 'rapid_reviews',
            severity: 'medium',
            userId,
            details: {
              ratings: userReviews,
              sellerId,
              reason: 'Suspicious rating pattern detected'
            },
            timestamp: new Date(),
            ip,
            userAgent
          });
        }
      }

    } catch (error) {
      console.error('[security-monitor] Error monitoring review creation:', error);
    }
  }

  /**
   * Monitor payment anomalies
   */
  async monitorPaymentAnomaly(
    sessionId: string,
    userId: string,
    amount: number,
    listingPrice: number,
    details: any
  ): Promise<void> {
    try {
      // Check for amount discrepancies
      const priceDifference = Math.abs(amount - listingPrice);
      const priceRatio = priceDifference / listingPrice;

      if (priceRatio > 0.1) { // More than 10% difference
        await this.logSecurityEvent({
          type: 'payment_anomaly',
          severity: 'high',
          userId,
          details: {
            sessionId,
            paidAmount: amount,
            listingPrice,
            difference: priceDifference,
            ratio: priceRatio,
            reason: 'Significant price discrepancy in payment',
            ...details
          },
          timestamp: new Date()
        });
      }

      // Check for rapid payment attempts
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentOrders = await this.db.collection('orders')
        .where('buyerId', '==', userId)
        .where('createdAt', '>', oneHourAgo)
        .get();

      if (recentOrders.size >= 10) {
        await this.logSecurityEvent({
          type: 'payment_anomaly',
          severity: 'critical',
          userId,
          details: {
            ordersInLastHour: recentOrders.size,
            reason: 'Excessive order creation rate',
            sessionId
          },
          timestamp: new Date()
        });
      }

    } catch (error) {
      console.error('[security-monitor] Error monitoring payment anomaly:', error);
    }
  }

  /**
   * Monitor authentication abuse
   */
  async monitorAuthAttempt(
    success: boolean,
    email: string,
    ip?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      if (!success) {
        // Track failed attempts by IP
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const failedAttempts = await this.db.collection('securityEvents')
          .where('type', '==', 'auth_abuse')
          .where('details.ip', '==', ip)
          .where('timestamp', '>', oneHourAgo)
          .get();

        if (failedAttempts.size >= this.thresholds.failed_auth_attempts) {
          await this.logSecurityEvent({
            type: 'auth_abuse',
            severity: 'high',
            details: {
              email,
              ip,
              failedAttempts: failedAttempts.size + 1,
              threshold: this.thresholds.failed_auth_attempts,
              reason: 'Excessive failed authentication attempts'
            },
            timestamp: new Date(),
            ip,
            userAgent
          });
        } else {
          // Log individual failed attempt
          await this.logSecurityEvent({
            type: 'auth_abuse',
            severity: 'low',
            details: {
              email,
              ip,
              success: false,
              reason: 'Failed authentication attempt'
            },
            timestamp: new Date(),
            ip,
            userAgent
          });
        }
      }

    } catch (error) {
      console.error('[security-monitor] Error monitoring auth attempt:', error);
    }
  }

  /**
   * Check if reCAPTCHA should be required for authentication
   */
  async shouldRequireRecaptcha(
    email?: string,
    ip?: string
  ): Promise<{ required: boolean; reason?: string }> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      // Check failed attempts by IP in the last hour
      if (ip) {
        const ipFailedAttempts = await this.db.collection('securityEvents')
          .where('type', '==', 'auth_abuse')
          .where('details.ip', '==', ip)
          .where('details.success', '==', false)
          .where('timestamp', '>', oneHourAgo)
          .get();

        if (ipFailedAttempts.size >= 3) {
          return {
            required: true,
            reason: 'Multiple failed attempts from this IP address'
          };
        }
      }

      // Check failed attempts by email in the last day
      if (email) {
        const emailFailedAttempts = await this.db.collection('securityEvents')
          .where('type', '==', 'auth_abuse')
          .where('details.email', '==', email)
          .where('details.success', '==', false)
          .where('timestamp', '>', oneDayAgo)
          .get();

        if (emailFailedAttempts.size >= 2) {
          return {
            required: true,
            reason: 'Multiple failed attempts for this email address'
          };
        }
      }

      // Check for suspicious patterns (e.g., rapid attempts)
      if (ip) {
        const recentAttempts = await this.db.collection('securityEvents')
          .where('type', '==', 'auth_abuse')
          .where('details.ip', '==', ip)
          .where('timestamp', '>', new Date(Date.now() - 10 * 60 * 1000)) // Last 10 minutes
          .get();

        if (recentAttempts.size >= 2) {
          return {
            required: true,
            reason: 'Rapid authentication attempts detected'
          };
        }
      }

      return { required: false };
    } catch (error) {
      console.error('[security-monitor] Error checking reCAPTCHA requirement:', error);
      // Default to requiring reCAPTCHA on error for security
      return {
        required: true,
        reason: 'Security check failed'
      };
    }
  }

  /**
   * Check if device is recognized for a user
   */
  async isRecognizedDevice(
    email: string,
    userAgent?: string,
    ip?: string
  ): Promise<boolean> {
    try {
      if (!userAgent && !ip) return false;

      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      
      // Look for successful auth attempts from this device/IP combination
      const recognizedAttempts = await this.db.collection('securityEvents')
        .where('type', '==', 'auth_abuse')
        .where('details.email', '==', email)
        .where('details.success', '==', true)
        .where('timestamp', '>', sevenDaysAgo)
        .get();

      // Check if any of the successful attempts match this device
      for (const doc of recognizedAttempts.docs) {
        const data = doc.data();
        const matchesUserAgent = userAgent && data.userAgent === userAgent;
        const matchesIP = ip && data.details.ip === ip;
        
        if (matchesUserAgent || matchesIP) {
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('[security-monitor] Error checking device recognition:', error);
      return false;
    }
  }

  /**
   * Log successful authentication attempt
   */
  async logSuccessfulAuth(
    email: string,
    ip?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      await this.logSecurityEvent({
        type: 'auth_abuse',
        severity: 'low',
        details: {
          email,
          ip,
          success: true,
          reason: 'Successful authentication attempt'
        },
        timestamp: new Date(),
        ip,
        userAgent
      });
    } catch (error) {
      console.error('[security-monitor] Error logging successful auth:', error);
    }
  }

  /**
   * Monitor listing manipulation
   */
  async monitorListingActivity(
    userId: string,
    action: 'create' | 'update' | 'delete',
    listingId: string,
    details: any,
    ip?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      if (action === 'create') {
        // Check for rapid listing creation
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const recentListings = await this.db.collection('listings')
          .where('userId', '==', userId)
          .where('createdAt', '>', oneHourAgo)
          .get();

        if (recentListings.size >= this.thresholds.listing_creation_per_hour) {
          await this.logSecurityEvent({
            type: 'listing_manipulation',
            severity: 'medium',
            userId,
            details: {
              listingsInLastHour: recentListings.size,
              threshold: this.thresholds.listing_creation_per_hour,
              reason: 'Excessive listing creation rate',
              listingId
            },
            timestamp: new Date(),
            ip,
            userAgent
          });
        }
      }

      // Check for suspicious price changes
      if (action === 'update' && details.priceChange) {
        const { oldPrice, newPrice } = details.priceChange;
        const priceChangeRatio = Math.abs(newPrice - oldPrice) / oldPrice;

        if (priceChangeRatio > 2) { // More than 200% change
          await this.logSecurityEvent({
            type: 'listing_manipulation',
            severity: 'medium',
            userId,
            details: {
              listingId,
              oldPrice,
              newPrice,
              changeRatio: priceChangeRatio,
              reason: 'Suspicious price change detected'
            },
            timestamp: new Date(),
            ip,
            userAgent
          });
        }
      }

    } catch (error) {
      console.error('[security-monitor] Error monitoring listing activity:', error);
    }
  }

  /**
   * Send security alert email
   */
  private async sendSecurityAlert(event: SecurityEvent): Promise<void> {
    try {
      const subject = `🚨 Security Alert: ${event.type} (${event.severity})`;
      const message = `
Security Event Detected:

Type: ${event.type}
Severity: ${event.severity}
User ID: ${event.userId || 'N/A'}
Timestamp: ${event.timestamp.toISOString()}
IP: ${event.ip || 'N/A'}
User Agent: ${event.userAgent || 'N/A'}

Details:
${JSON.stringify(event.details, null, 2)}

Please investigate immediately.
      `;

      for (const email of this.alertEmails) {
        await emailService.sendEmailNotification({
          userId: 'system',
          userEmail: email,
          userName: 'Security Team',
          type: 'security_alert',
          title: subject,
          message,
          actionUrl: '/admin/security',
          data: event
        });
      }

    } catch (error) {
      console.error('[security-monitor] Failed to send security alert:', error);
    }
  }

  /**
   * Get security summary for admin dashboard
   */
  async getSecuritySummary(hours: number = 24): Promise<{
    totalEvents: number;
    eventsByType: Record<string, number>;
    eventsBySeverity: Record<string, number>;
    topUsers: Array<{ userId: string; eventCount: number }>;
  }> {
    try {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);
      const events = await this.db.collection('securityEvents')
        .where('timestamp', '>', since)
        .get();

      const eventsByType: Record<string, number> = {};
      const eventsBySeverity: Record<string, number> = {};
      const userEventCounts: Record<string, number> = {};

      events.docs.forEach(doc => {
        const data = doc.data();
        
        eventsByType[data.type] = (eventsByType[data.type] || 0) + 1;
        eventsBySeverity[data.severity] = (eventsBySeverity[data.severity] || 0) + 1;
        
        if (data.userId) {
          userEventCounts[data.userId] = (userEventCounts[data.userId] || 0) + 1;
        }
      });

      const topUsers = Object.entries(userEventCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([userId, eventCount]) => ({ userId, eventCount }));

      return {
        totalEvents: events.size,
        eventsByType,
        eventsBySeverity,
        topUsers
      };

    } catch (error) {
      console.error('[security-monitor] Error getting security summary:', error);
      return {
        totalEvents: 0,
        eventsByType: {},
        eventsBySeverity: {},
        topUsers: []
      };
    }
  }
}

export const securityMonitor = new SecurityMonitor();