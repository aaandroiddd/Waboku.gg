import { NextApiRequest, NextApiResponse } from 'next';

// Module cache to prevent repeated imports
const moduleCache = new Map();

async function getModule(modulePath: string) {
  if (moduleCache.has(modulePath)) {
    return moduleCache.get(modulePath);
  }
  
  try {
    const module = await import(modulePath);
    moduleCache.set(modulePath, module);
    return module;
  } catch (error) {
    console.error(`Failed to import module ${modulePath}:`, error);
    throw new Error(`Module ${modulePath} not available`);
  }
}

async function getFirebaseAdminInstance() {
  const { getFirebaseAdmin } = await getModule('@/lib/firebase-admin');
  return getFirebaseAdmin();
}

async function getSubscriptionSyncModule() {
  return await getModule('@/lib/subscription-sync');
}

async function getStripe() {
  const { default: Stripe } = await getModule('stripe');
  
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('[Subscription Check] Missing STRIPE_SECRET_KEY');
    throw new Error('Missing STRIPE_SECRET_KEY');
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
      maxNetworkRetries: 3,
      timeout: 20000
    });
    console.log('[Subscription Check] Stripe initialized successfully');
    return stripe;
  } catch (error: any) {
    console.error('[Subscription Check] Failed to initialize Stripe:', {
      error: error.message,
      type: error.type,
      code: error.code
    });
    throw error;
  }
}



export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const requestId = Math.random().toString(36).substring(7);
  console.info(`[Subscription Check ${requestId}] Started:`, {
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString()
  });

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Add caching headers to reduce frequent calls
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300'); // Cache for 5 minutes
  res.setHeader('Surrogate-Control', 'max-age=300'); // Cache for CDN
  
  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    console.warn(`[Subscription Check ${requestId}] Invalid method:`, req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }



  try {
    // Get the authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      console.warn(`[Subscription Check ${requestId}] Missing or invalid authorization header`);
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Missing or invalid authorization token',
        code: 'AUTH_HEADER_MISSING'
      });
    }

    // Extract the token
    const idToken = authHeader.split('Bearer ')[1];
    
    // Basic token validation before attempting Firebase verification
    if (!idToken || idToken.length < 50) {
      console.warn(`[Subscription Check ${requestId}] Token appears invalid (length: ${idToken?.length || 0})`);
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Invalid token format',
        code: 'AUTH_TOKEN_INVALID_FORMAT'
      });
    }
    
    try {
      // Initialize Firebase Admin and verify token
      const { admin } = await getFirebaseAdminInstance();
      console.log(`[Subscription Check ${requestId}] Firebase Admin initialized successfully`);
      
      // Log token details for debugging (safely)
      console.log(`[Subscription Check ${requestId}] Verifying token:`, {
        tokenLength: idToken.length,
        tokenPrefix: idToken.substring(0, 5) + '...',
        tokenSuffix: '...' + idToken.slice(-5),
        timestamp: new Date().toISOString()
      });
      
      // Verify the token and get user data
      let decodedToken;
      try {
        // The correct way to access the auth() method
        decodedToken = await admin.auth().verifyIdToken(idToken, true);
      } catch (error: any) {
        console.error(`[Subscription Check ${requestId}] Token verification failed:`, {
          error: error.message,
          code: error.code,
          type: error.type,
          stack: error.stack?.split('\n').slice(0, 3).join('\n')
        });
        
        // Try one more time without forcing token refresh
        try {
          console.log(`[Subscription Check ${requestId}] Retrying token verification without refresh check`);
          decodedToken = await admin.auth().verifyIdToken(idToken, false);
          console.log(`[Subscription Check ${requestId}] Retry succeeded`);
        } catch (retryError: any) {
          console.error(`[Subscription Check ${requestId}] Retry token verification also failed:`, {
            error: retryError.message,
            code: retryError.code
          });
          throw retryError;
        }
      }
      const userId = decodedToken.uid;
      const userEmail = decodedToken.email;

      console.log(`[Subscription Check ${requestId}] Token verified successfully:`, {
        userId,
        email: userEmail,
        emailVerified: decodedToken.email_verified,
        tokenIssued: new Date(decodedToken.iat * 1000).toISOString(),
        tokenExpires: new Date(decodedToken.exp * 1000).toISOString()
      });

      // Get subscription data using our utility function
      const syncModule = await getSubscriptionSyncModule();
      const { source, data: subscriptionData } = await syncModule.getSubscriptionData(userId);
      
      console.log(`[Subscription Check ${requestId}] Retrieved subscription data from ${source}:`, {
        userId,
        accountTier: subscriptionData.accountTier,
        status: subscriptionData.status,
        stripeSubscriptionId: subscriptionData.stripeSubscriptionId ? 'exists' : 'missing'
      });

      // If admin has set premium status, ensure it's properly synced
      if (subscriptionData.accountTier === 'premium' && 
          (subscriptionData.manuallyUpdated || 
           (subscriptionData.stripeSubscriptionId && subscriptionData.stripeSubscriptionId.includes('admin_')))) {
        
        console.log(`[Subscription Check ${requestId}] Using admin-set premium status:`, {
          accountTier: subscriptionData.accountTier,
          subscriptionPlan: subscriptionData.currentPlan,
          subscriptionStatus: subscriptionData.status,
          manuallyUpdated: subscriptionData.manuallyUpdated
        });
        
        // Ensure admin subscription has proper dates
        const currentDate = new Date();
        const endDate = new Date();
        endDate.setFullYear(currentDate.getFullYear() + 1); // Set end date to 1 year from now
        
        const updatedSubscription = {
          ...subscriptionData,
          tier: 'premium',
          currentPlan: 'premium',
          status: 'active',
          stripeSubscriptionId: subscriptionData.stripeSubscriptionId || `admin_${userId}_${Date.now()}`,
          currentPeriodEnd: Math.floor(endDate.getTime() / 1000),
          startDate: subscriptionData.startDate || currentDate.toISOString(),
          renewalDate: endDate.toISOString(),
          manuallyUpdated: true
        };
        
        // Sync the updated data to both databases
        await syncModule.syncSubscriptionData(userId, updatedSubscription);
        
        return res.status(200).json({
          isPremium: true,
          status: 'active',
          tier: 'premium',
          currentPeriodEnd: updatedSubscription.currentPeriodEnd,
          renewalDate: updatedSubscription.renewalDate,
          startDate: updatedSubscription.startDate,
          subscriptionId: updatedSubscription.stripeSubscriptionId
        });
      }

      // If no subscription or free tier, return that info
      if (!subscriptionData.stripeSubscriptionId || subscriptionData.status === 'none') {
        console.log(`[Subscription Check ${requestId}] No active subscription found:`, { userId });
        return res.status(200).json({ 
          isPremium: false,
          status: 'none',
          tier: 'free'
        });
      }

      // If there's a Stripe subscription ID, verify with Stripe
      let stripeSubscription = null;
      if (subscriptionData.stripeSubscriptionId && !subscriptionData.stripeSubscriptionId.includes('admin_')) {
        try {
          const stripe = await getStripe();
          stripeSubscription = await stripe.subscriptions.retrieve(subscriptionData.stripeSubscriptionId);
          
          // Update subscription status from Stripe
          const updatedSubscription = {
            ...subscriptionData,
            status: stripeSubscription.status,
            currentPeriodEnd: stripeSubscription.current_period_end,
            renewalDate: new Date(stripeSubscription.current_period_end * 1000).toISOString()
          };
          
          // Sync the updated data to both databases
          await syncModule.syncSubscriptionData(userId, updatedSubscription);

          console.log(`[Subscription Check ${requestId}] Updated subscription with Stripe data:`, {
            userId,
            status: stripeSubscription.status,
            currentPeriodEnd: stripeSubscription.current_period_end
          });
          
          // Update local reference for response
          subscriptionData.status = stripeSubscription.status;
          subscriptionData.currentPeriodEnd = stripeSubscription.current_period_end;
          subscriptionData.renewalDate = new Date(stripeSubscription.current_period_end * 1000).toISOString();
          
        } catch (stripeError: any) {
          console.error(`[Subscription Check ${requestId}] Stripe error:`, {
            code: stripeError.code,
            message: stripeError.message,
            type: stripeError.type
          });
          
          // If Stripe subscription not found, reset status
          if (stripeError.code === 'resource_missing') {
            console.log(`[Subscription Check ${requestId}] Subscription not found in Stripe, checking for customer by email`);
            
            // Check if this might be a user who deleted their account and created a new one
            if (userEmail) {
              try {
                const stripeInstance = await getStripe();
                // Look for customer in Stripe by email
                const customers = await stripeInstance.customers.list({
                  email: userEmail,
                  limit: 1
                });
                
                if (customers.data.length > 0) {
                  const stripeCustomerId = customers.data[0].id;
                  console.log(`[Subscription Check ${requestId}] Found existing Stripe customer:`, {
                    email: userEmail,
                    customerId: stripeCustomerId
                  });
                  
                  // Check if this customer has any subscriptions
                  const subscriptions = await stripeInstance.subscriptions.list({
                    customer: stripeCustomerId,
                    limit: 5
                  });
                  
                  if (subscriptions.data.length > 0) {
                    console.log(`[Subscription Check ${requestId}] Found subscriptions for customer:`, {
                      count: subscriptions.data.length,
                      statuses: subscriptions.data.map(sub => sub.status)
                    });
                    
                    // Cancel all existing subscriptions
                    for (const subscription of subscriptions.data) {
                      if (subscription.status !== 'canceled') {
                        await stripeInstance.subscriptions.cancel(subscription.id);
                        console.log(`[Subscription Check ${requestId}] Canceled subscription:`, subscription.id);
                      }
                    }
                  }
                  
                  // Always try to delete the customer for users who recreated accounts
                  try {
                    await stripeInstance.customers.del(stripeCustomerId);
                    console.log(`[Subscription Check ${requestId}] Deleted Stripe customer:`, stripeCustomerId);
                  } catch (deleteError) {
                    console.error(`[Subscription Check ${requestId}] Error deleting customer:`, deleteError);
                    // Continue with deletion even if customer deletion fails
                  }
                }
              } catch (customerError) {
                console.error(`[Subscription Check ${requestId}] Error checking for customer:`, customerError);
              }
            }
            
            // Subscription ID not found in Stripe.
            // Log this event. The user's existing data in Firestore will not be changed by this block.
            // The response will reflect that this specific subscription ID was not found/active.
            console.warn(`[Subscription Check ${requestId}] Stripe subscription ID ${subscriptionData.stripeSubscriptionId} not found in Stripe. User's persisted data will not be altered by this specific 'resource_missing' event. Downstream logic will determine final tier based on current DB state and this API response.`);
            subscriptionData.status = 'error_stripe_resource_missing'; // Indicate the issue
            // We don't nullify stripeSubscriptionId here from the original data,
            // so that the response can still report what ID was checked.
            // The key is not calling syncSubscriptionData to force a 'free' tier write.
          }
          // For other Stripe errors, we also don't aggressively change DB data here.
          // Let the existing DB state and AccountContext logic handle it.
        }
      }
      
      // Determine active status based on potentially updated subscriptionData
      const now = Date.now() / 1000;
      let isActive = false;
      if (subscriptionData.status === 'active' || subscriptionData.status === 'trialing') {
        if (subscriptionData.currentPeriodEnd && subscriptionData.currentPeriodEnd > now) {
          isActive = true;
        }
      }
      // If status was changed to 'error_stripe_resource_missing', it won't be active.

      console.log(`[Subscription Check ${requestId}] Final status determination:`, {
        userId,
        isActive,
        calculatedTier: (isActive && (subscriptionData.accountTier === 'premium' || subscriptionData.currentPlan === 'premium')) ? 'premium' : 'free',
        subscription: {
          status: subscriptionData.status, // This might be 'error_stripe_resource_missing'
          originalAccountTier: subscriptionData.accountTier, // From DB
          originalCurrentPlan: subscriptionData.currentPlan, // From DB
          currentPeriodEnd: subscriptionData.currentPeriodEnd
        }
      });

      // Check if this is an admin-assigned subscription and ensure dates if it's considered active
      // This part should only run if the subscription is otherwise considered valid/active from DB or Stripe direct check
      if (subscriptionData.stripeSubscriptionId?.includes('admin_') && 
          (subscriptionData.status === 'active' || subscriptionData.status === 'trialing')) {
        if (!subscriptionData.renewalDate || !subscriptionData.startDate) {
          const currentDate = new Date();
          const adminEndDate = new Date();
          adminEndDate.setFullYear(currentDate.getFullYear() + 1);
          
          const adminUpdatedSubscription = {
            ...subscriptionData, // original data from getSubscriptionData
            startDate: subscriptionData.startDate || currentDate.toISOString(),
            renewalDate: adminEndDate.toISOString(),
            // Ensure status is active if it's an admin sub being "fixed" here
            status: 'active', 
            accountTier: 'premium', // ensure tier is premium
            currentPlan: 'premium'
          };
          
          // Sync these updated dates for admin subs back to DB
          await syncModule.syncSubscriptionData(userId, adminUpdatedSubscription);
          
          // Update local subscriptionData for the response
          subscriptionData.startDate = adminUpdatedSubscription.startDate;
          subscriptionData.renewalDate = adminUpdatedSubscription.renewalDate;
          subscriptionData.status = 'active';
          subscriptionData.accountTier = 'premium';
          subscriptionData.currentPlan = 'premium';
          isActive = true; // Recalculate isActive based on updated admin data
        }
      }
      
      const finalTier = (isActive && (subscriptionData.accountTier === 'premium' || subscriptionData.currentPlan === 'premium')) ? 'premium' : 'free';

      return res.status(200).json({
        isPremium: finalTier === 'premium',
        status: subscriptionData.status || 'none', // could be 'error_stripe_resource_missing'
        tier: finalTier,
        currentPeriodEnd: subscriptionData.currentPeriodEnd,
        renewalDate: subscriptionData.renewalDate,
        startDate: subscriptionData.startDate,
        subscriptionId: subscriptionData.stripeSubscriptionId // The ID that was checked
      });

    } catch (authError: any) {
      console.error(`[Subscription Check ${requestId}] Auth error:`, {
        code: authError.code,
        message: authError.message,
        stack: authError.stack
      });
      
      return res.status(401).json({ 
        error: 'Authentication failed',
        message: authError.message || 'Invalid authentication token',
        code: authError.code || 'AUTH_TOKEN_INVALID'
      });
    }

  } catch (error: any) {
    console.error(`[Subscription Check ${requestId}] Unhandled error:`, {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    
    return res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to check subscription status',
      code: error.code || 'INTERNAL_ERROR'
    });
  }
}