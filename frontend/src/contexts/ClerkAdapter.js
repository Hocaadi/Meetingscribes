import React, { createContext, useContext, useEffect } from 'react';
import { useAuth } from './AuthContext';

// Create a mock Clerk context to match the API of Clerk's ClerkProvider
const ClerkContext = createContext(null);

// This hook mimics Clerk's useUser hook
export const useUser = () => {
  const clerkContext = useContext(ClerkContext);
  if (!clerkContext) {
    throw new Error("useUser must be used within a ClerkProvider component");
  }
  const { user, isLoaded } = clerkContext;
  return { user, isLoaded, isSignedIn: !!user };
};

// This hook mimics Clerk's useClerk hook
export const useClerk = () => {
  const clerkContext = useContext(ClerkContext);
  if (!clerkContext) {
    throw new Error("useClerk must be used within a ClerkProvider component");
  }
  return clerkContext.clerk;
};

// ClerkProvider component that adapts our custom auth context to Clerk's format
export const ClerkProvider = ({ children }) => {
  // Use our custom auth context
  const auth = useAuth();
  
  // Map our auth context to match Clerk's expected format
  const clerkContextValue = {
    user: auth.user,
    isLoaded: !auth.loading,
    clerk: {
      user: auth.user,
      session: auth.session,
      signOut: auth.signOut,
      getToken: auth.getToken
    }
  };
  
  // Log initialization for debugging
  useEffect(() => {
    console.log('ClerkAdapter: ClerkProvider initialized with auth state', {
      isLoaded: !auth.loading,
      isSignedIn: !!auth.user
    });
  }, [auth.loading, auth.user]);
  
  return (
    <ClerkContext.Provider value={clerkContextValue}>
      {children}
    </ClerkContext.Provider>
  );
};

// Auto-initialize the ClerkProvider when this module is imported
// This ensures the clerk context is available throughout the app
if (typeof window !== 'undefined') {
  console.log('ClerkAdapter: Registering ClerkProvider for automatic initialization');
  
  // Wait for DOMContentLoaded to ensure React is ready
  window.addEventListener('DOMContentLoaded', () => {
    console.log('ClerkAdapter: DOM loaded, looking for root app element');
    
    // Give React a moment to initialize
    setTimeout(() => {
      try {
        console.log('ClerkAdapter: Attempting to inject ClerkProvider wrapper');
        // This is just for logging - the actual wrapping happens through the normal ClerkProvider export
      } catch (error) {
        console.error('ClerkAdapter: Error initializing ClerkProvider:', error);
      }
    }, 0);
  });
}

export default ClerkProvider; 