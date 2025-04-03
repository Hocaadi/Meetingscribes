import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Container, Row, Col, Card, Button } from 'react-bootstrap';
import { useUser } from '../contexts/AuthContext';
import 'bootstrap/dist/css/bootstrap.min.css';
import './LandingPage.css';
import DemoVideo from './DemoVideo';

const LandingPage = () => {
  const { isSignedIn, user } = useUser();
  const navigate = useNavigate();
  
  // If user is already logged in, show dashboard link instead of sign in/up
  const renderAuthOptions = () => {
    if (isSignedIn) {
      return (
        <Card className="auth-card shadow">
          <Card.Body className="text-center">
            <h3 className="mb-4">Welcome Back, {user?.firstName || 'User'}!</h3>
            <p className="lead mb-4">Continue working with your meeting transcriptions and analysis.</p>
            <div className="d-grid gap-3 mb-3">
              <Button 
                variant="primary" 
                size="lg" 
                className="w-100"
                onClick={() => navigate('/dashboard')}
              >
                Go to Dashboard
              </Button>
              <Button 
                variant="outline-primary" 
                size="lg" 
                className="w-100"
                onClick={() => navigate('/work-progress')}
              >
                Work & Progress
              </Button>
            </div>
          </Card.Body>
        </Card>
      );
    } else {
      return (
        <Card className="auth-card shadow">
          <Card.Body className="text-center">
            <h3 className="mb-4">Get Started Today</h3>
            <p className="lead mb-4">Join thousands of professionals who trust MeetingScribe for their meeting transcription needs.</p>
            <div className="d-grid gap-3 mb-3">
              <Link to="/sign-up">
                <Button variant="primary" size="lg" className="w-100">
                  Sign Up Free
                </Button>
              </Link>
              <Link to="/sign-in">
                <Button variant="outline-primary" size="lg" className="w-100">
                  Already a user? Sign In
                </Button>
              </Link>
            </div>
            <small className="text-muted">No credit card required for free tier</small>
          </Card.Body>
        </Card>
      );
    }
  };
  
  return (
    <div className="landing-page">
      {/* Hero Section */}
      <div className="hero-section">
        <Container>
          <Row className="align-items-center">
            <Col md={6} className="text-center text-md-start">
              <div className="logo-container mb-4">
                <img
                  src="/logo.png"
                  width="120"
                  height="120"
                  className="hero-logo"
                  alt="MeetingScribe Logo"
                />
              </div>
              <h1 className="hero-title">Transform Your Meetings with AI</h1>
              <p className="hero-subtitle">
                MeetingScribe automatically transcribes, analyzes, and summarizes your meetings so you can focus on what matters.
              </p>
              <div className="hero-features">
                <div className="feature-item">
                  <i className="bi bi-mic-fill"></i>
                  <span>Accurate Transcription</span>
                </div>
                <div className="feature-item">
                  <i className="bi bi-lightning-fill"></i>
                  <span>Fast Processing</span>
                </div>
                <div className="feature-item">
                  <i className="bi bi-graph-up"></i>
                  <span>AI Analysis</span>
                </div>
              </div>
            </Col>
            <Col lg={6}>
              <div className="auth-container">
                {renderAuthOptions()}
              </div>
            </Col>
          </Row>
        </Container>
      </div>

      {/* Features Section */}
      <div className="features-section">
        <Container>
          <h2 className="section-title text-center">How MeetingScribe Works</h2>
          <Row className="mt-5">
            <Col md={4}>
              <div className="feature-card text-center">
                <div className="feature-icon">
                  <i className="bi bi-upload"></i>
                </div>
                <h3>Upload</h3>
                <p>Upload your meeting audio files in various formats (MP3, WAV, M4A, etc.)</p>
              </div>
            </Col>
            <Col md={4}>
              <div className="feature-card text-center">
                <div className="feature-icon">
                  <i className="bi bi-cpu"></i>
                </div>
                <h3>Process</h3>
                <p>Our AI transcribes and analyzes your meeting content with high accuracy</p>
              </div>
            </Col>
            <Col md={4}>
              <div className="feature-card text-center">
                <div className="feature-icon">
                  <i className="bi bi-file-earmark-text"></i>
                </div>
                <h3>Review</h3>
                <p>Get a complete analysis with action items, summaries, and key insights</p>
              </div>
            </Col>
          </Row>
        </Container>
      </div>

      {/* Demo Video Section */}
      <DemoVideo />

      {/* Pricing Section */}
      <div id="pricing" className="pricing-section">
        <Container>
          <h2 className="section-title text-center">Simple Pricing</h2>
          <p className="text-center mb-5">Get started for free and upgrade when you need more</p>
          
          <Row className="justify-content-center">
            <Col lg={4} md={6}>
              <Card className="pricing-card">
                <Card.Header className="text-center">
                  <h3>Free</h3>
                </Card.Header>
                <Card.Body>
                  <div className="price text-center">
                    <span className="currency">$</span>
                    <span className="amount">0</span>
                  </div>
                  <ul className="feature-list">
                    <li><i className="bi bi-check-circle-fill"></i> 2 meeting recordings</li>
                    <li><i className="bi bi-check-circle-fill"></i> Basic transcription</li>
                    <li><i className="bi bi-check-circle-fill"></i> Standard AI analysis</li>
                    <li><i className="bi bi-check-circle-fill"></i> DOCX export format</li>
                  </ul>
                </Card.Body>
              </Card>
            </Col>
            
            <Col lg={4} md={6}>
              <Card className="pricing-card premium">
                <Card.Header className="text-center">
                  <h3>Premium</h3>
                  <span className="badge bg-primary">Most Popular</span>
                </Card.Header>
                <Card.Body>
                  <div className="price text-center">
                    <span className="currency">$</span>
                    <span className="amount">9</span>
                    <span className="period">/month</span>
                  </div>
                  <ul className="feature-list">
                    <li><i className="bi bi-check-circle-fill"></i> <strong>Unlimited</strong> recordings</li>
                    <li><i className="bi bi-check-circle-fill"></i> Enhanced transcription</li>
                    <li><i className="bi bi-check-circle-fill"></i> Advanced AI analysis</li>
                    <li><i className="bi bi-check-circle-fill"></i> Multiple export formats</li>
                    <li><i className="bi bi-check-circle-fill"></i> Priority processing</li>
                  </ul>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Container>
      </div>

      {/* Testimonials Section */}
      <div id="testimonials" className="testimonials-section">
        <Container>
          <h2 className="section-title text-center">What Our Users Say</h2>
          <Row className="mt-4">
            <Col md={4}>
              <Card className="testimonial-card">
                <Card.Body>
                  <p className="testimonial-text">"MeetingScribe has saved our team countless hours of note-taking and follow-up. The action item extraction is incredibly accurate."</p>
                  <div className="testimonial-author">
                    <div className="author-info">
                      <h5>Sarah Johnson</h5>
                      <p>Project Manager</p>
                    </div>
                  </div>
                </Card.Body>
              </Card>
            </Col>
            <Col md={4}>
              <Card className="testimonial-card">
                <Card.Body>
                  <p className="testimonial-text">"The ability to chat with our meeting transcripts has transformed how we reference past discussions. Game changer for remote teams!"</p>
                  <div className="testimonial-author">
                    <div className="author-info">
                      <h5>Michael Chen</h5>
                      <p>Tech Lead</p>
                    </div>
                  </div>
                </Card.Body>
              </Card>
            </Col>
            <Col md={4}>
              <Card className="testimonial-card">
                <Card.Body>
                  <p className="testimonial-text">"I was skeptical about AI transcription, but the accuracy is impressive. The summary feature helps me quickly get the gist of meetings I missed."</p>
                  <div className="testimonial-author">
                    <div className="author-info">
                      <h5>Amanda Torres</h5>
                      <p>Marketing Director</p>
                    </div>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Container>
      </div>

      {/* Footer CTA */}
      <div className="footer-cta">
        <Container className="text-center">
          <h2>Ready to Transform Your Meetings?</h2>
          <p className="lead mb-4">Join thousands of professionals who trust MeetingScribe</p>
          {isSignedIn ? (
            <Button 
              variant="light" 
              size="lg"
              onClick={() => navigate('/dashboard')}
            >
              Go to Dashboard
            </Button>
          ) : (
            <Link to="/sign-up">
              <Button variant="light" size="lg">Get Started Free</Button>
            </Link>
          )}
        </Container>
      </div>
    </div>
  );
};

export default LandingPage; 