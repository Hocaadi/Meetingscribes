import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate, useNavigate } from 'react-router-dom';
import './App.css';
import LandingPage from './components/LandingPage';
import AppNavbar from './components/AppNavbar';
import FileUpload from './components/FileUpload';
import GhibliPage from './components/GhibliPage';
import PremiumPayment from './components/PremiumPayment';
import About from './pages/About';
import AuthPage from './components/AuthPage';
import OTPTester from './components/OTPTester';
import OTPAuthTester from './components/auth/OTPAuthTester';
import { AuthProvider, useAuth, useUser } from './contexts/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import './components/ErrorBoundary.css';
import { Alert, Button, Container } from 'react-bootstrap';
import ThankYouPage from './components/ThankYouPage';
import Footer from './components/Footer';
import WorkProgress from './pages/WorkProgress';
import AdminAuthCheck from './AdminAuthCheck';

// Configuration warning component
const ConfigWarning = () => {
  // Always return null to hide the warning completely
  return null;
};

// Protected route component
const ProtectedRoute = ({ children }) => {
  const { isSignedIn, isLoaded, user, session, isDevelopmentMode } = useUser();
  const navigate = useNavigate();
  const [redirecting, setRedirecting] = useState(false);
  
  console.log('ProtectedRoute state:', { 
    isSignedIn, 
    isLoaded, 
    hasUser: !!user, 
    hasSession: !!session,
    isDevelopmentMode,
    redirecting
  });
  
  useEffect(() => {
    // Only redirect if auth is loaded and user is not signed in
    // Skip redirect if we're in development mode
    if (isLoaded && !isSignedIn && !redirecting && !isDevelopmentMode) {
      console.log('User not authenticated, redirecting to sign-in page');
      setRedirecting(true);
      
      // Use setTimeout to ensure state doesn't get mixed up
      setTimeout(() => {
        navigate('/sign-in', { replace: true });
      }, 100);
    }
  }, [isLoaded, isSignedIn, navigate, redirecting, isDevelopmentMode]);
  
  // If auth is still loading, show a loading indicator
  if (!isLoaded) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading your profile...</p>
      </div>
    );
  }
  
  // Special case for development mode
  if (isDevelopmentMode) {
    console.log('Development mode enabled - allowing access');
    return <>{children}</>;
  }
  
  // If user is not signed in, show loading while redirect happens
  if (!isSignedIn) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Redirecting to sign in...</p>
      </div>
    );
  }
  
  // User is signed in, render the protected content
  return children;
};

function App() {
  // Log environment variables for debugging (will be removed in production)
  console.log('Environment:', {
    NODE_ENV: process.env.NODE_ENV,
    REACT_APP_API_URL: process.env.REACT_APP_API_URL,
    REACT_APP_SUPABASE_URL: process.env.REACT_APP_SUPABASE_URL?.substring(0, 15) + '...' // Only log part of the URL for security
  });
  
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <div className="app-container">
            <AppNavbar />
            
            <main className="main-content" style={{
              display: 'block',
              visibility: 'visible',
              flex: '1 0 auto',
              paddingTop: '80px'
            }}>
              <Routes>
                {/* Public routes */}
                <Route path="/sign-in/*" element={<AuthPage />} />
                <Route path="/sign-up/*" element={<AuthPage />} />
                <Route path="/about" element={<About />} />
                
                {/* Testing Tools */}
                <Route 
                  path="/otp-test" 
                  element={
                    process.env.NODE_ENV === 'development' ? (
                      <OTPTester />
                    ) : (
                      <Navigate to="/" replace />
                    )
                  } 
                />
                
                <Route 
                  path="/auth-test" 
                  element={
                    <Container className="py-5">
                      <OTPAuthTester />
                    </Container>
                  } 
                />
                
                {/* Admin Authentication Check */}
                <Route
                  path="/admin-auth-check"
                  element={
                    <AdminAuthCheck />
                  }
                />
                
                {/* Protected routes */}
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <FileUpload />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/work-progress"
                  element={
                    <ProtectedRoute>
                      <WorkProgress />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/ghibli"
                  element={
                    <ProtectedRoute>
                      <GhibliPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/premium"
                  element={
                    <ProtectedRoute>
                      <PremiumPayment />
                    </ProtectedRoute>
                  }
                />
                
                {/* Home route */}
                <Route path="/" element={<LandingPage />} />
                
                {/* ThankYou route */}
                <Route path="/thankyou" element={<ThankYouPage />} />
                
                {/* Catch-all redirect */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
            <Footer />
          </div>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
