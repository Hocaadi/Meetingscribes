import React, { createContext, useContext, useState, useEffect } from 'react';
import EmailService from './EmailService';
import supabase from '../supabaseClient';

// Log configuration status to help debugging
console.log('AuthContext Configuration:', {
  nodeEnv: process.env.NODE_ENV,
  apiBaseUrl: process.env.REACT_APP_API_URL
});

// Create Authentication Context
const AuthContext = createContext(null);

// User data storage in localStorage
const LOCAL_STORAGE_USER_KEY = 'meeting_scribe_user';
const LOCAL_STORAGE_SESSION_KEY = 'meeting_scribe_session';

/**
 * Custom hook to access auth context
 * @returns {Object} The auth context
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

/**
 * Alias for useAuth to maintain compatibility with other auth providers
 * @returns {Object} The auth context
 */
export const useUser = () => {
  const auth = useAuth();
  // Add isLoaded property for compatibility
  return {
    ...auth,
    isLoaded: !auth.loading
  };
};

/**
 * AuthProvider component that provides authentication state
 * @param {Object} props - Component props
 * @returns {JSX.Element} Auth provider component
 */
export const AuthProvider = ({ children }) => {
  // Initialize state with data from localStorage
  const [user, setUser] = useState(() => {
    try {
      const storedUser = localStorage.getItem(LOCAL_STORAGE_USER_KEY);
      return storedUser ? JSON.parse(storedUser) : null;
    } catch (e) {
      console.error('Error parsing stored user:', e);
      return null;
    }
  });
  
  const [session, setSession] = useState(() => {
    try {
      const storedSession = localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
      return storedSession ? JSON.parse(storedSession) : null;
    } catch (e) {
      console.error('Error parsing stored session:', e);
      return null;
    }
  });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Effect to load user from Supabase
  useEffect(() => {
    const loadUserFromSupabase = async () => {
      try {
        // Skip if we already have user data
        if (user && session) {
          console.log('User already loaded from localStorage', user.id);
          setLoading(false);
          return;
        }
        
        console.log('Trying to load user from Supabase auth');
        const { data } = await supabase.auth.getSession();
        
        if (data.session) {
          console.log('Supabase session found:', data.session.user.id);
          
          // Set user and session in state
          setUser(data.session.user);
          setSession(data.session);
          
          // Store in localStorage
          localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(data.session.user));
          localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(data.session));
        } else {
          console.log('No Supabase session found');
          // Clear user state to ensure consistency
          setUser(null);
          setSession(null);
          localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
          localStorage.removeItem(LOCAL_STORAGE_SESSION_KEY);
        }
      } catch (error) {
        console.error('Error loading user from Supabase:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadUserFromSupabase();
  }, [user, session]);
  
  // Fetch user profile from our API
  const fetchUserProfile = async (userId) => {
    try {
      if (!session || !session.token) {
        console.log('No token available for fetching profile');
        return;
      }
      
      // Get API base URL from environment variables or use default
      const apiBaseUrl = process.env.REACT_APP_API_URL || '';
      const apiUrl = apiBaseUrl ? `${apiBaseUrl}/api/user/profile` : '/api/user/profile';
      
      console.log('Fetching user profile from:', apiUrl);
      
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${session.token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to fetch user profile: ${response.status} ${response.statusText} - ${errorData.message || ''}`);
      }
      
      const profileData = await response.json();
      console.log('Profile data fetched successfully');
      
      // Merge profile data with user object
      const updatedUser = { ...user, profile: profileData };
      setUser(updatedUser);
      
      // Update localStorage
      localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(updatedUser));
      
      return profileData;
    } catch (err) {
      console.error('Error fetching user profile:', err);
      // Continue despite profile fetch error - don't block the user
      return null;
    }
  };
  
  // Sign up with email and password using OTP
  const signUpWithOTP = async ({ email, password, firstName, lastName }) => {
    try {
      setLoading(true);
      setError(null);
      console.log('Starting signup process with OTP for:', email);
      
      // Validate input first
      if (!email || !password) {
        throw new Error('Email and password are required for signup');
      }
      
      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }
      
      // Check if user already exists
      console.log('Checking if user already exists');
      const userCheck = await EmailService.checkUserExists(email);
      console.log('User existence check result:', userCheck);
      
      if (userCheck.exists) {
        console.log('User already exists, cannot sign up');
        throw new Error('An account with this email already exists. Please sign in instead.');
      }
      
      if (userCheck.error) {
        console.warn('User check service error, but will continue with signup attempt:', userCheck.error);
      }
      
      // Send OTP via our custom service
      console.log('Sending OTP to verify email:', email);
      const result = await EmailService.sendOTPEmail(email, 'signup');
      
      if (!result.success) {
        console.error('Failed to send OTP:', result.message);
        throw new Error(result.message || 'Failed to send verification code');
      }
      
      console.log('OTP sent successfully, waiting for verification');
      
      // Store signup data temporarily to use after OTP verification
      sessionStorage.setItem('pendingSignup', JSON.stringify({
        email,
        password,
        firstName: firstName || 'User',
        lastName: lastName || '',
        timestamp: Date.now()
      }));
      
      return { 
        success: true,
        message: 'Verification code sent successfully',
        email
      };
    } catch (err) {
      console.error('Error in signUpWithOTP:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };
  
  // Verify OTP token
  const verifyOTP = async ({ email, token, type }) => {
    try {
      setLoading(true);
      setError(null);
      console.log(`Verifying OTP for ${email} (type: ${type})`);
      
      if (!email || !token) {
        throw new Error('Email and verification code are required');
      }
      
      // First try our custom verification
      console.log('Calling EmailService.verifyOTP');
      const verificationResult = await EmailService.verifyOTP(email, token);
      console.log('OTP verification result:', verificationResult);
      
      if (!verificationResult.success) {
        throw new Error(verificationResult.message || 'Failed to verify code');
      }
      
      console.log('OTP verified successfully');
      
      // If this was a signup verification, complete the registration
      if (type === 'signup') {
        console.log('Processing signup after OTP verification');
        const pendingSignupData = sessionStorage.getItem('pendingSignup');
        
        if (!pendingSignupData) {
          console.error('No pending signup data found');
          throw new Error('Signup session expired. Please try again.');
        }
        
        try {
          // Parse the stored data
          const signupData = JSON.parse(pendingSignupData);
          console.log('Found pending signup data for:', signupData.email);
          
          // Verify the email matches
          if (signupData.email.toLowerCase() !== email.toLowerCase()) {
            console.error('Email mismatch in pending signup data');
            throw new Error('Email mismatch error. Please try signing up again.');
          }
          
          // Create a new session that expires in 7 days
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 7);
          
          // Create user session
          const newSession = {
            token: `token-${Date.now()}`,
            expiresAt: expiresAt.toISOString()
          };
          
          // Create user object
          const newUser = {
            id: `user-${Date.now()}`,
            email: email.toLowerCase(),
            firstName: signupData.firstName || 'User',
            lastName: signupData.lastName || '',
            createdAt: new Date().toISOString()
          };
          
          console.log('Creating new user:', newUser.email);
          
          // Set user and session
          setUser(newUser);
          setSession(newSession);
          
          // Store in localStorage for persistence
          localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(newUser));
          localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(newSession));
          
          // Clean up pending signup data
          sessionStorage.removeItem('pendingSignup');
          
          console.log('User registered and signed in successfully:', email);
        } catch (parseError) {
          console.error('Error processing pending signup:', parseError);
          sessionStorage.removeItem('pendingSignup');
          throw new Error('Failed to complete registration. Please try signing up again.');
        }
      } else if (type === 'signin') {
        console.log('Processing signin after OTP verification');
        
        // For sign in verification
        // Create a new session that expires in 7 days
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
        
        // Create user session
        const newSession = {
          token: `token-${Date.now()}`,
          expiresAt: expiresAt.toISOString()
        };
        
        // Create or update user object
        // First check if we already have user data in localStorage
        const existingUserData = localStorage.getItem(LOCAL_STORAGE_USER_KEY);
        let newUser;
        
        if (existingUserData) {
          try {
            const parsed = JSON.parse(existingUserData);
            // Only use the existing data if the email matches
            if (parsed.email && parsed.email.toLowerCase() === email.toLowerCase()) {
              console.log('Using existing user data for:', email);
              newUser = parsed;
            } else {
              console.log('Existing user data email mismatch, creating new basic user');
              newUser = {
                id: `user-${Date.now()}`,
                email: email.toLowerCase(),
                firstName: 'User',
                lastName: '',
                createdAt: new Date().toISOString()
              };
            }
          } catch (e) {
            console.error('Error parsing existing user data:', e);
            newUser = {
              id: `user-${Date.now()}`,
              email: email.toLowerCase(),
              firstName: 'User',
              lastName: '',
              createdAt: new Date().toISOString()
            };
          }
        } else {
          console.log('No existing user data, creating new basic user');
          newUser = {
            id: `user-${Date.now()}`,
            email: email.toLowerCase(),
            firstName: 'User',
            lastName: '',
            createdAt: new Date().toISOString()
          };
        }
        
        // Set user and session
        setUser(newUser);
        setSession(newSession);
        
        // Store in localStorage
        localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(newUser));
        localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(newSession));
        
        console.log('User signed in with OTP successfully:', email);
      }
      
      return { 
        success: true,
        message: 'Verification successful'
      };
    } catch (err) {
      console.error('Error verifying OTP:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };
  
  // Resend OTP to user's email
  const resendOTP = async ({ email, type }) => {
    try {
      setLoading(true);
      setError(null);
      console.log('Resending OTP to:', email);
      
      // Use our EmailService
      const result = await EmailService.sendOTPEmail(email, type || 'signup');
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to resend verification code');
      }
      
      console.log('OTP resent successfully');
      return { success: true, message: 'Verification code sent' };
    } catch (err) {
      console.error('Error resending OTP:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };
  
  // Sign in with email OTP (magic link)
  const signInWithOTP = async ({ email }) => {
    try {
      setLoading(true);
      setError(null);
      console.log('Starting signin process with OTP for:', email);
      
      if (!email) {
        throw new Error('Email is required');
      }
      
      // Normalize email
      const normalizedEmail = email.toLowerCase();
      
      // Send OTP via our custom service
      console.log('Sending OTP for signin:', normalizedEmail);
      const result = await EmailService.sendOTPEmail(normalizedEmail, 'signin');
      
      if (!result.success) {
        console.error('Failed to send OTP:', result.message);
        throw new Error(result.message || 'Failed to send verification code');
      }
      
      console.log('Signin OTP sent successfully, waiting for verification');
      
      return { 
        success: true,
        message: 'Verification code sent successfully',
        email: normalizedEmail
      };
    } catch (err) {
      console.error('Error in signInWithOTP:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };
  
  // Sign in
  const signIn = async ({ email, password }) => {
    try {
      setLoading(true);
      setError(null);
      
      // Validate email and password
      if (!email || !password) {
        throw new Error('Email and password are required');
      }
      
      // Use Supabase for authentication
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (authError) {
        console.error('Supabase auth error:', authError);
        throw new Error(authError.message || 'Authentication failed');
      }
      
      if (authData?.session) {
        // Set user and session state
        setUser(authData.user);
        setSession(authData.session);
        
        // Store in localStorage
        localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(authData.user));
        localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(authData.session));
        
        return { 
          success: true,
          message: 'Sign-in successful',
          user: authData.user
        };
      }
      
      // Try email OTP as fallback
      throw new Error('Authentication failed. Please try email OTP.');
    } catch (err) {
      console.error('Error signing in:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };
  
  // Sign out
  const signOut = async () => {
    try {
      setLoading(true);
      console.log('Signing out user');
      
      // Clear user and session states
      setUser(null);
      setSession(null);
      
      // Clear localStorage
      localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
      localStorage.removeItem(LOCAL_STORAGE_SESSION_KEY);
      
      console.log('Sign out successful');
    } catch (err) {
      console.error('Error signing out:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  // Admin bypass for all environments
  const adminBypass = async (secretKey) => {
    try {
      setLoading(true);
      setError(null);
      
      // Check secret key
      if (secretKey !== '232323') {
        console.error('Invalid admin bypass key');
        throw new Error('Invalid admin key');
      }
      
      console.log('Admin bypass activated');
      
      // Sign in with Supabase using predefined admin credentials
      const adminEmail = 'admin@meetingscribe.dev';
      const adminPassword = 'admin123!@#'; // Should be stored securely in production
      
      try {
        // Try to authenticate with Supabase
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: adminEmail,
          password: adminPassword
        });
        
        if (authError) {
          console.log('Admin auth failed, creating new admin account');
          
          // If admin doesn't exist, sign up
          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email: adminEmail,
            password: adminPassword
          });
          
          if (signUpError) {
            console.error('Failed to create admin account:', signUpError);
            throw new Error('Admin authentication error: ' + signUpError.message);
          }
          
          // Use the new account data
          if (signUpData.user && signUpData.session) {
            // Create admin profile if it doesn't exist
            const { error: profileError } = await supabase
              .from('profiles')
              .insert([{
                id: signUpData.user.id,
                first_name: 'Admin',
                last_name: 'User',
                email: adminEmail
              }])
              .single();
              
            if (profileError && !profileError.message.includes('duplicate')) {
              console.error('Error creating admin profile:', profileError);
            }
            
            // Set session and user
            setUser({
              ...signUpData.user,
              firstName: 'Admin',
              lastName: 'User',
              isAdmin: true
            });
            setSession(signUpData.session);
            
            // Store in localStorage
            localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify({
              ...signUpData.user,
              firstName: 'Admin',
              lastName: 'User',
              isAdmin: true
            }));
            localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(signUpData.session));
            
            return { 
              success: true,
              message: 'Admin mode activated',
              isAdmin: true
            };
          }
        } else if (authData && authData.user && authData.session) {
          // Create admin profile if it doesn't exist
          const { error: profileError } = await supabase
            .from('profiles')
            .upsert([{
              id: authData.user.id,
              first_name: 'Admin',
              last_name: 'User',
              email: adminEmail
            }]);
            
          if (profileError) {
            console.error('Error updating admin profile:', profileError);
          }
          
          // Set session and user
          setUser({
            ...authData.user,
            firstName: 'Admin',
            lastName: 'User',
            isAdmin: true
          });
          setSession(authData.session);
          
          // Store in localStorage
          localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify({
            ...authData.user,
            firstName: 'Admin',
            lastName: 'User',
            isAdmin: true
          }));
          localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(authData.session));
          
          return { 
            success: true,
            message: 'Admin mode activated',
            isAdmin: true
          };
        }
      } catch (authErr) {
        console.error('Admin authentication error:', authErr);
      }
      
      // Fallback to local admin if Supabase auth fails
      console.log('Using local admin fallback');
      
      // Create a new session that expires in 30 days (longer for admin)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      
      // Create admin user and session
      const adminUser = { 
        id: `admin-${Date.now()}`,
        email: 'admin@meetingscribe.dev', 
        firstName: 'Admin',
        lastName: 'User',
        createdAt: new Date().toISOString(),
        role: 'admin',
        isAdmin: true
      };
      
      const adminSession = {
        token: `admin-token-${Date.now()}`,
        expiresAt: expiresAt.toISOString()
      };
      
      // Set user and session state
      setUser(adminUser);
      setSession(adminSession);
      
      // Store in localStorage
      localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(adminUser));
      localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(adminSession));
      
      console.warn('Admin logged in with local session only - database operations will fail');
      alert('Warning: Admin logged in with local session only. Database operations will not work. Please set up proper admin credentials in Supabase.');
      
      return { 
        success: true,
        message: 'Admin mode activated (local only)',
        isAdmin: true,
        isLocalOnly: true
      };
    } catch (err) {
      console.error('Admin bypass error:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };
  
  // Get user token
  const getToken = async () => {
    try {
      if (!session) return null;
      return session.token;
    } catch (err) {
      console.error('Error getting token:', err);
      return null;
    }
  };
  
  // Clerk-like interface for compatibility
  const clerk = {
    user,
    session,
    signOut,
    getToken
  };
  
  // Check if user is signed in - modified to handle development mode better
  const isSignedIn = !!user && !!session;
  
  // Make the development mode status available to components
  const isDevelopmentMode = process.env.NODE_ENV === 'development';
  
  const value = {
    user,
    session,
    loading,
    error,
    isSignedIn,
    isDevelopmentMode,
    signUpWithOTP,
    verifyOTP,
    resendOTP,
    signInWithOTP,
    signIn,
    signOut,
    adminBypass,
    getToken,
    clerk
  };
  
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Convenience hook that provides clerk-like functionality
export const useClerk = () => {
  const { clerk } = useAuth();
  return clerk;
};

export default AuthContext; 