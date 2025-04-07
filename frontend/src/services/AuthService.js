import axios from 'axios';
import config from '../config';
import supabase from '../supabaseClient';

/**
 * Service for handling authentication-related operations
 */
class AuthService {
  /**
   * Get current authenticated user
   * @returns {Promise<Object>} Current user object
   */
  async getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  }

  /**
   * Get user session
   * @returns {Promise<Object>} Current session object
   */
  async getSession() {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  }

  /**
   * Sign in with email and password
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise<Object>} Authentication result
   */
  async signIn(email, password) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (error) throw error;
      return { success: true, user: data.user, session: data.session };
    } catch (error) {
      console.error('Sign in error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Sign out current user
   * @returns {Promise<Object>} Sign out result
   */
  async signOut() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Sign out error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update user profile
   * @param {Object} profile - Profile data to update
   * @returns {Promise<Object>} Update result
   */
  async updateProfile(profile) {
    try {
      // Get current auth token
      const session = await this.getSession();
      
      if (!session) {
        throw new Error('No active session found');
      }
      
      // Call API to update profile
      const response = await axios.post(
        `${config.API_URL}/api/user/profile`,
        {
          firstName: profile.firstName,
          lastName: profile.lastName
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          }
        }
      );
      
      if (response.status !== 200) {
        throw new Error('Failed to update profile');
      }
      
      return { success: true, profile: response.data };
    } catch (error) {
      console.error('Update profile error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if user has admin role
   * @returns {Promise<boolean>} True if user is admin
   */
  async isAdmin() {
    try {
      const user = await this.getCurrentUser();
      return user?.user_metadata?.role === 'admin';
    } catch (error) {
      console.error('Admin check error:', error);
      return false;
    }
  }
}

// Create and export singleton instance
const authService = new AuthService();
export default authService; 