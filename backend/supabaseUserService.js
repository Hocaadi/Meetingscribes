const { supabase } = require('./supabaseClient');

/**
 * User Subscription Service using Supabase
 * Manages premium user access and subscription status
 */
class SupabaseUserService {
  /**
   * Check if a user is a premium subscriber
   * @param {string} userId - The user's ID
   * @returns {Promise<boolean>} True if user has an active premium subscription
   */
  async isPremiumUser(userId) {
    if (!userId) return false;
    
    try {
      // Query the subscriptions table for this user
      const { data, error } = await supabase
        .from('subscriptions')
        .select('status, expires_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (error) {
        console.error('Error checking premium status:', error);
        return false;
      }
      
      // If no subscription found, user is not premium
      if (!data) return false;
      
      // Check if subscription is active and not expired
      const isActive = data.status === 'active';
      const isNotExpired = !data.expires_at || new Date(data.expires_at) > new Date();
      
      return isActive && isNotExpired;
    } catch (error) {
      console.error('Error in isPremiumUser:', error);
      return false;
    }
  }
  
  /**
   * Get the remaining free tier requests for a user
   * @param {string} userId - The user's ID
   * @returns {Promise<number>} Number of remaining free requests
   */
  async getRemainingRequests(userId) {
    // If premium, return maximum value
    const isPremium = await this.isPremiumUser(userId);
    if (isPremium) return Number.MAX_SAFE_INTEGER;
    
    try {
      // Get current usage
      const used = await this.getRequestCount(userId);
      const limit = this.FREE_TIER_LIMIT;
      
      return Math.max(0, limit - used);
    } catch (error) {
      console.error('Error getting remaining requests:', error);
      return 0;
    }
  }
  
  /**
   * Get total number of requests made by a user
   * @param {string} userId - The user's ID
   * @returns {Promise<number>} Number of requests made
   */
  async getRequestCount(userId) {
    if (!userId) return 0;
    
    try {
      // Query the usage_logs table
      const { data, error } = await supabase
        .from('usage_logs')
        .select('count')
        .eq('user_id', userId)
        .single();
      
      if (error) {
        console.error('Error getting request count:', error);
        return 0;
      }
      
      return data?.count || 0;
    } catch (error) {
      console.error('Error in getRequestCount:', error);
      return 0;
    }
  }
  
  /**
   * Increment the request count for a user
   * @param {string} userId - The user's ID
   * @returns {Promise<number>} Updated request count
   */
  async incrementRequestCount(userId) {
    if (!userId) return 0;
    
    try {
      // Check if record exists first
      const { data: existingData } = await supabase
        .from('usage_logs')
        .select('count')
        .eq('user_id', userId)
        .single();
      
      if (existingData) {
        // Update existing record
        const newCount = (existingData.count || 0) + 1;
        
        await supabase
          .from('usage_logs')
          .update({ count: newCount, updated_at: new Date().toISOString() })
          .eq('user_id', userId);
          
        return newCount;
      } else {
        // Create new record
        await supabase
          .from('usage_logs')
          .insert({
            user_id: userId,
            count: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
          
        return 1;
      }
    } catch (error) {
      console.error('Error incrementing request count:', error);
      return 0;
    }
  }
  
  /**
   * Check if user has exceeded free tier limit
   * @param {string} userId - The user's ID
   * @returns {Promise<boolean>} True if user has exceeded limit
   */
  async hasExceededLimit(userId) {
    // Premium users never exceed limit
    const isPremium = await this.isPremiumUser(userId);
    if (isPremium) return false;
    
    const remaining = await this.getRemainingRequests(userId);
    return remaining <= 0;
  }
  
  /**
   * Upgrade a user to premium status
   * @param {string} userId - The user's ID
   * @param {string} planType - Subscription plan type
   * @returns {Promise<boolean>} True if upgrade was successful
   */
  async upgradeToPremium(userId, planType = 'monthly') {
    if (!userId) return false;
    
    try {
      // Calculate expiration date (30 days for monthly, 365 days for yearly)
      const daysToAdd = planType === 'yearly' ? 365 : 30;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + daysToAdd);
      
      // Create a new subscription record
      const { error } = await supabase
        .from('subscriptions')
        .insert({
          user_id: userId,
          status: 'active',
          plan_type: planType,
          amount_paid: planType === 'yearly' ? 15000 : 1500, // in cents
          currency: 'USD',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString()
        });
      
      if (error) {
        console.error('Error creating subscription:', error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error in upgradeToPremium:', error);
      return false;
    }
  }
  
  // Free tier limit constant
  FREE_TIER_LIMIT = 2;
}

// Create and export singleton instance
const supabaseUserService = new SupabaseUserService();
module.exports = supabaseUserService; 