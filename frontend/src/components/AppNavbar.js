import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Navbar, Container, Nav, Button, Dropdown, Badge } from 'react-bootstrap';
import { useUser, useClerk } from '../contexts/AuthContext';
import 'bootstrap/dist/css/bootstrap.min.css';
import './AppNavbar.css';
import { FaLock, FaUnlock, FaCrown, FaUser } from 'react-icons/fa';

const AppNavbar = () => {
  const { signOut } = useClerk();
  const { user, isSignedIn, isDevelopmentMode } = useUser();
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  
  // Check if current path is auth page
  const isAuthPage = location.pathname.includes('/sign-in') || location.pathname.includes('/sign-up');
  
  // Debug auth state
  console.log('AppNavbar auth state:', { isSignedIn, user, path: location.pathname });
  
  // Check if user is admin
  const isAdmin = user?.isAdmin || user?.role === 'admin' || false;
  
  // Check if user has premium subscription
  const isPremium = user?.subscription === 'premium' || user?.isPremium || false;
  
  // Force checking localStorage for auth state
  useEffect(() => {
    // Check localStorage for user data
    const storedUser = localStorage.getItem('auth_user');
    const storedSession = localStorage.getItem('auth_session');
    
    if (storedUser && storedSession && !isSignedIn) {
      console.log('Found stored user data in localStorage but not in state');
      // Force refresh to restore auth state
      window.location.reload();
    }
  }, [isSignedIn]);
  
  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      const offset = window.scrollY;
      if (offset > 50) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };
    
    window.addEventListener('scroll', handleScroll);
    
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);
  
  const handleSignOut = async () => {
    await signOut();
    navigate('/', { replace: true });
  };

  // Custom user avatar component
  const UserAvatar = ({ user }) => {
    const initials = user?.firstName && user?.lastName 
      ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
      : user?.firstName
        ? user.firstName[0].toUpperCase()
        : '?';
    
    return (
      <div className={`user-avatar-circle ${isAdmin ? 'admin-avatar' : ''}`}>
        {user?.imageUrl ? (
          <img 
            src={user.imageUrl} 
            alt={`${user.firstName || 'User'}'s avatar`} 
            className="user-avatar-img"
          />
        ) : (
          <span>{initials}</span>
        )}
      </div>
    );
  };
  
  return (
    <Navbar bg="transparent" variant="dark" expand="lg" className={`app-navbar fixed-top ${scrolled ? 'scrolled' : ''}`}>
      <Container>
        <Navbar.Brand as={Link} to="/" className="d-flex align-items-center">
          <img
            src="/logo.png"
            width="40"
            height="40"
            className="d-inline-block align-top me-2"
            alt="MeetingScribe Logo"
          />
          <span className="brand-text">MeetingScribe</span>
          {isDevelopmentMode && (
            <Badge bg="warning" text="dark" className="ms-2 dev-badge">DEV</Badge>
          )}
        </Navbar.Brand>
        
        <Navbar.Toggle aria-controls="navbar-nav" />
        
        <Navbar.Collapse id="navbar-nav">
          <Nav className="me-auto">
            {isSignedIn && (
              <>
                <Nav.Link as={Link} to="/dashboard" className="nav-link">Dashboard</Nav.Link>
                <Nav.Link as={Link} to="/work-progress" className="nav-link">Work & Progress</Nav.Link>
              </>
            )}
            
            {/* Always show these on landing page regardless of auth state */}
            {location.pathname === '/' && (
              <>
                <Nav.Link href="#features" className="nav-link">Features</Nav.Link>
                <Nav.Link href="#pricing" className="nav-link">Pricing</Nav.Link>
                <Nav.Link href="#testimonials" className="nav-link">Testimonials</Nav.Link>
                <Nav.Link as={Link} to="/about" className="nav-link">About</Nav.Link>
              </>
            )}
            
            {isDevelopmentMode && (
              <Nav.Link as={Link} to="/auth-test" className="nav-link dev-link">
                Auth Test
                <Badge bg="warning" text="dark" className="ms-1" pill>DEV</Badge>
              </Nav.Link>
            )}
          </Nav>
          
          <Nav>
            {isSignedIn && (
              <Nav.Link as={Link} to="/ghibli" className="nav-link nav-beta me-3">
                GIBHLI Image
                {isAdmin ? (
                  <span className="ms-1 admin-badge" title="Admin Access">
                    <FaUnlock size={10} />
                  </span>
                ) : isPremium ? (
                  <span className="ms-1 premium-badge" title="Premium Feature">
                    <FaCrown size={10} />
                  </span>
                ) : (
                  <span className="ms-1 locked-badge" title="Premium Feature">
                    <FaLock size={10} />
                  </span>
                )}
              </Nav.Link>
            )}
            
            {!isSignedIn && !isAuthPage && (
              <>
                <Link to="/sign-in" className="me-2">
                  <Button variant="outline-light" className="nav-button">Sign In</Button>
                </Link>
                <Link to="/sign-up">
                  <Button variant="light" className="nav-button-primary">Sign Up</Button>
                </Link>
              </>
            )}
            
            {isSignedIn && (
              <div className="d-flex align-items-center">
                <span className="text-light me-3 user-welcome">
                  Welcome, {user?.firstName || 'User'}
                  {isAdmin && (
                    <span className="admin-badge ms-1">ADMIN</span>
                  )}
                </span>
                <Dropdown align="end">
                  <Dropdown.Toggle as="div" id="user-dropdown" className="user-dropdown-toggle">
                    {user ? (
                      <UserAvatar user={user} />
                    ) : (
                      <div className="user-avatar-circle">
                        <FaUser />
                      </div>
                    )}
                  </Dropdown.Toggle>
                  
                  <Dropdown.Menu>
                    <Dropdown.Item as={Link} to="/dashboard">Dashboard</Dropdown.Item>
                    <Dropdown.Item as={Link} to="/work-progress">Work & Progress</Dropdown.Item>
                    <Dropdown.Item as={Link} to="/profile">Profile</Dropdown.Item>
                    {isAdmin && (
                      <>
                        <Dropdown.Divider />
                        <Dropdown.Item className="admin-dropdown-item">
                          Admin Mode
                          <Badge bg="primary" className="ms-2">Active</Badge>
                        </Dropdown.Item>
                        <Dropdown.Item as={Link} to="/admin-auth-check">
                          Admin Auth Check
                        </Dropdown.Item>
                      </>
                    )}
                    <Dropdown.Divider />
                    <Dropdown.Item onClick={handleSignOut}>Sign Out</Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown>
              </div>
            )}
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};

export default AppNavbar; 