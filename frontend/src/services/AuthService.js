import supabase from '../supabaseClient';

/**
 * AuthService handles authentication using Supabase
 */
class AuthService {
  /**
   * Sign up a new user with email and password
   * @param {string} email - User's email
   * @param {string} password - User's password
   * @param {object} metadata - Additional user metadata like firstName, lastName
   * @returns {Promise<{user, error}>} User data or error
   */
  async signUp(email, password, metadata = {}) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: metadata.firstName || '',
            last_name: metadata.lastName || '',
            full_name: `${metadata.firstName || ''} ${metadata.lastName || ''}`.trim(),
            ...metadata
          },
        },
      });

      if (error) throw error;
      return { user: data.user, session: data.session };
    } catch (error) {
      console.error('Sign up error:', error);
      return { error };
    }
  }

  /**
   * Sign in a user with email and password
   * @param {string} email - User's email
   * @param {string} password - User's password
   * @returns {Promise<{user, error}>} User data or error
   */
  async signIn(email, password) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      return { user: data.user, session: data.session };
    } catch (error) {
      console.error('Sign in error:', error);
      return { error };
    }
  }

  /**
   * Sign out the current user
   * @returns {Promise<{error}>} Error if any
   */
  async signOut() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Sign out error:', error);
      return { error };
    }
  }

  /**
   * Get the current user session
   * @returns {Promise<{user, session, error}>} Current session or null
   */
  async getSession() {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      return { 
        user: data.session?.user || null,
        session: data.session,
      };
    } catch (error) {
      console.error('Get session error:', error);
      return { error };
    }
  }

  /**
   * Get user data with profile information
   * @returns {Promise<{user, error}>} User data with profile info
   */
  async getUserWithProfile() {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return { user: null };
      
      const user = sessionData.session.user;
      
      // Format user data to match what components expect
      return {
        user: {
          id: user.id,
          firstName: user.user_metadata?.first_name || '',
          lastName: user.user_metadata?.last_name || '',
          fullName: user.user_metadata?.full_name || `${user.user_metadata?.first_name || ''} ${user.user_metadata?.last_name || ''}`.trim(),
          primaryEmailAddress: { emailAddress: user.email },
          imageUrl: user.user_metadata?.avatar_url || null,
          // Add any additional fields needed by your application
        }
      };
    } catch (error) {
      console.error('Get user with profile error:', error);
      return { error };
    }
  }

  /**
   * Reset password for a user
   * @param {string} email - The email to send password reset to
   * @returns {Promise<{success, error}>} Status of the request
   */
  async resetPassword(email) {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      
      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Password reset error:', error);
      return { error };
    }
  }

  /**
   * Update user password
   * @param {string} newPassword - The new password
   * @returns {Promise<{success, error}>} Status of the update
   */
  async updatePassword(newPassword) {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      
      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Update password error:', error);
      return { error };
    }
  }

  /**
   * Update user profile
   * @param {object} profile - User profile data to update
   * @returns {Promise<{user, error}>} Updated user data
   */
  async updateProfile(profile) {
    try {
      const { data, error } = await supabase.auth.updateUser({
        data: {
          first_name: profile.firstName,
          last_name: profile.lastName,
          full_name: `${profile.firstName || ''} ${profile.lastName || ''}`.trim(),
          // Add any additional profile fields
        }
      });
      
      if (error) throw error;
      return { user: data.user };
    } catch (error) {
      console.error('Update profile error:', error);
      return { error };
    }
  }
}

// Create and export a singleton instance
const authService = new AuthService();
export default authService; 