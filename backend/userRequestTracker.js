/**
 * User Request Tracker
 * 
 * Handles tracking user request counts and enforcing limits for free tier users
 */

const { v4: uuidv4 } = require('uuid');
const { supabase } = require('./supabaseClient');

// Define request limits
const FREE_TIER_LIMIT = 5; // Number of free processing requests

/**
 * Check if a user has exceeded their request limit
 * @param {string} userId - User ID to check
 * @returns {Promise<boolean>} - True if limit exceeded, false otherwise
 */
async function hasExceededLimit(userId) {
  try {
    // Skip limit check for empty user ID
    if (!userId) {
      return false;
    }
    
    // Check if user has premium account
    const isPremium = await isPremiumUser(userId);
    if (isPremium) {
      return false; // Premium users have no limit
    }
    
    // Get current request count
    const count = await getRequestCount(userId);
    return count >= FREE_TIER_LIMIT;
  } catch (error) {
    console.error('Error checking free tier limit:', error);
    // In case of error, allow the request to proceed
    return false;
  }
}

/**
 * Get the current request count for a user
 * @param {string} userId - User ID to check
 * @returns {Promise<number>} - Number of requests used
 */
async function getRequestCount(userId) {
  try {
    // Skip count check for empty user ID
    if (!userId) {
      return 0;
    }
    
    // Check if user record exists
    const { data, error } = await supabase
      .from('user_requests')
      .select('request_count')
      .eq('user_id', userId)
      .single();
    
    if (error) {
      // Log the specific error but don't throw
      console.error('Error getting request count:', error);
      return 0;
    }
    
    return data ? data.request_count : 0;
  } catch (error) {
    console.error('Error getting request count:', error);
    return 0;
  }
}

/**
 * Increment the request count for a user
 * @param {string} userId - User ID to increment count for
 * @returns {Promise<number>} - New request count
 */
async function incrementRequestCount(userId) {
  try {
    // Skip count increment for empty user ID
    if (!userId) {
      return 0;
    }
    
    // Check if user is premium (premium users don't accumulate count)
    const isPremium = await isPremiumUser(userId);
    if (isPremium) {
      return 0;
    }
    
    // Check if user record exists
    const { data: existingRecord } = await supabase
      .from('user_requests')
      .select('request_count')
      .eq('user_id', userId)
      .single();
    
    if (existingRecord) {
      // Update existing record
      const newCount = existingRecord.request_count + 1;
      await supabase
        .from('user_requests')
        .update({ request_count: newCount, last_request: new Date() })
        .eq('user_id', userId);
      
      return newCount;
    } else {
      // Create new record
      await supabase
        .from('user_requests')
        .insert([{ 
          user_id: userId, 
          request_count: 1,
          last_request: new Date()
        }]);
      
      return 1;
    }
  } catch (error) {
    console.error('Error incrementing request count:', error);
    return 0;
  }
}

/**
 * Check if a user has premium status
 * @param {string} userId - User ID to check
 * @returns {Promise<boolean>} - True if premium, false otherwise
 */
async function isPremiumUser(userId) {
  try {
    // Skip premium check for empty user ID
    if (!userId) {
      return false;
    }
    
    // First check subscriptions table
    const { data: subscriptionData, error: subscriptionError } = await supabase
      .from('subscriptions')
      .select('status')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();
    
    if (subscriptionError) {
      console.error('Error checking premium status:', subscriptionError);
    }
    
    // If active subscription found, user is premium
    if (subscriptionData) {
      return true;
    }
    
    // Alternatively, check user profile for premium flag
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('is_premium')
      .eq('id', userId)
      .maybeSingle();
    
    if (profileError) {
      console.error('Error checking premium status in profiles:', profileError);
      return false;
    }
    
    return profileData && profileData.is_premium === true;
  } catch (error) {
    console.error('Error checking premium status:', error);
    return false;
  }
}

/**
 * Get the number of remaining requests for a user
 * @param {string} userId - User ID to check
 * @returns {Promise<number>} - Number of remaining requests
 */
async function getRemainingRequests(userId) {
  try {
    // Skip check for empty user ID
    if (!userId) {
      return FREE_TIER_LIMIT;
    }
    
    // Check if user is premium
    const isPremium = await isPremiumUser(userId);
    if (isPremium) {
      return Infinity; // Premium users have unlimited requests
    }
    
    // Get current request count
    const count = await getRequestCount(userId);
    return Math.max(0, FREE_TIER_LIMIT - count);
  } catch (error) {
    console.error('Error getting remaining requests:', error);
    return FREE_TIER_LIMIT; // In case of error, assume full limit
  }
}

/**
 * Record a request for tracking feature usage
 * @param {string} userId - User ID
 * @param {string} featureType - Feature type (e.g., 'processing', 'ghibli', etc.)
 */
async function recordRequest(userId, featureType) {
  try {
    if (!userId) return;
    
    // Insert usage record
    await supabase
      .from('feature_usage')
      .insert([{
        user_id: userId,
        feature_type: featureType,
        used_at: new Date()
      }])
      .then(({ error }) => {
        if (error) console.error('Error recording feature usage:', error);
      });
  } catch (error) {
    console.error('Error recording feature usage:', error);
  }
}

/**
 * Check if a user has access to a premium feature
 * @param {string} userId - User ID
 * @param {string} featureType - Feature type to check access for
 * @returns {Promise<object>} - Access status object
 */
async function checkUserAccess(userId, featureType) {
  try {
    // If no user ID, require upgrade
    if (!userId) {
      return { 
        hasAccess: false, 
        upgradeRequired: true,
        message: 'Authentication required'
      };
    }
    
    // Check if user is premium or admin
    const isPremium = await isPremiumUser(userId);
    
    // Record this access check
    await recordRequest(userId, `${featureType}_access_check`);
    
    if (isPremium) {
      return { 
        hasAccess: true, 
        upgradeRequired: false,
        message: 'Premium access granted'
      };
    }
    
    // For non-premium users, check if it's a premium-only feature
    const premiumOnlyFeatures = ['ghibli', 'advanced_analytics'];
    
    if (premiumOnlyFeatures.includes(featureType)) {
      return { 
        hasAccess: false, 
        upgradeRequired: true,
        message: 'Premium subscription required for this feature'
      };
    }
    
    // For regular features, check request limit
    const hasExceeded = await hasExceededLimit(userId);
    
    return {
      hasAccess: !hasExceeded,
      upgradeRequired: hasExceeded,
      message: hasExceeded ? 'Free tier limit exceeded' : 'Access granted'
    };
  } catch (error) {
    console.error('Error checking user access:', error);
    // In case of error, grant access to avoid blocking legitimate users
    return { 
      hasAccess: true, 
      upgradeRequired: false,
      message: 'Access granted (error handling fallback)'
    };
  }
}

module.exports = {
  FREE_TIER_LIMIT,
  hasExceededLimit,
  getRequestCount,
  incrementRequestCount,
  isPremiumUser,
  getRemainingRequests,
  recordRequest,
  checkUserAccess
}; 