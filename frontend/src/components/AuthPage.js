import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Container, Row, Col, Card } from 'react-bootstrap';
import SignIn from './auth/SignIn';
import SignUp from './auth/SignUp';
import './AuthPage.css';

const AuthPage = () => {
  const location = useLocation();
  const isSignUp = location.pathname.includes('sign-up');
  
  return (
    <div className="auth-page">
      <Container>
        <Row className="justify-content-center">
          <Col md={8} lg={6} xl={5}>
            <div className="text-center mb-4">
              <Link to="/" className="back-to-home">
                <i className="bi bi-arrow-left"></i> Back to Home
              </Link>
            </div>
            <Card className="auth-form-card shadow">
              <Card.Body>
                <div className="text-center mb-4">
                  <h2>{isSignUp ? 'Create Your Account' : 'Welcome Back'}</h2>
                  <p className="text-muted">
                    {isSignUp 
                      ? 'Join MeetingScribe to start transforming your meetings' 
                      : 'Sign in to access your MeetingScribe dashboard'}
                  </p>
                </div>
                
                {isSignUp ? (
                  <SignUp redirectUrl="/dashboard" />
                ) : (
                  <SignIn redirectUrl="/dashboard" />
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  );
};

export default AuthPage; 