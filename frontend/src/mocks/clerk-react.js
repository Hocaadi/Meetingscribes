/**
 * clerk-react.js - Mock implementation of Clerk functions
 * 
 * This file provides mock implementations of Clerk's authentication hooks and components
 * to allow components that depend on Clerk to work with our custom authentication system.
 */

import { useAuth } from '../contexts/AuthContext';

// useUser - Returns user information formatted like Clerk's useUser hook
export const useUser = () => {
  const auth = useAuth();
  return {
    isLoaded: !auth.loading,
    isSignedIn: !!auth.user,
    user: auth.user ? {
      id: auth.user.id,
      primaryEmailAddress: { emailAddress: auth.user.email },
      fullName: `${auth.user.firstName || ''} ${auth.user.lastName || ''}`.trim(),
      firstName: auth.user.firstName,
      lastName: auth.user.lastName,
      // Add any other properties your components might need
      createdAt: auth.user.createdAt,
      updatedAt: auth.user.updatedAt,
      imageUrl: auth.user.imageUrl || 'https://via.placeholder.com/150',
      hasImage: !!auth.user.imageUrl,
    } : null
  };
};

// useClerk - Returns Clerk instance with necessary methods
export const useClerk = () => {
  const auth = useAuth();
  return {
    user: auth.user,
    session: auth.session,
    signOut: auth.signOut,
    getToken: auth.getToken,
  };
};

// ClerkProvider component - A simple passthrough since we're using our own auth provider
export const ClerkProvider = ({ children }) => {
  return children;
};

// Other Clerk exports that might be used in your app
export const SignedIn = ({ children }) => {
  const { isSignedIn } = useUser();
  return isSignedIn ? children : null;
};

export const SignedOut = ({ children }) => {
  const { isSignedIn } = useUser();
  return !isSignedIn ? children : null;
};

export const UserButton = () => {
  return null; // Replace with your own user menu component if needed
};

export default {
  useUser,
  useClerk,
  ClerkProvider,
  SignedIn,
  SignedOut,
  UserButton
}; 