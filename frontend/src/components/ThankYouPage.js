import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Container, Card, Button, Row, Col } from 'react-bootstrap';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './ThankYouPage.css';

const ThankYouPage = () => {
  // Get any query parameters from the URL
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const orderId = queryParams.get('orderId') || 'Unknown';
  const plan = queryParams.get('plan') || 'Premium';
  
  return (
    <Container className="thank-you-container">
      <Card className="thank-you-card">
        <Card.Body>
          <div className="text-center mb-3">
            <img
              src="/logo.png"
              width="80"
              height="80"
              className="logo-image mb-3"
              alt="MeetingScribe Logo"
            />
          </div>
          
          <div className="text-center mb-4">
            <div className="success-icon">
              <i className="bi bi-check-circle-fill"></i>
            </div>
            <h1 className="thank-you-title">Thank You for Your Purchase!</h1>
            <p className="thank-you-subtitle">Your payment has been successfully processed.</p>
          </div>
          
          <Card className="order-details-card mb-4">
            <Card.Header as="h5">Order Details</Card.Header>
            <Card.Body>
              <Row>
                <Col md={6}>
                  <p><strong>Order ID:</strong> {orderId}</p>
                  <p><strong>Date:</strong> {new Date().toLocaleDateString()}</p>
                </Col>
                <Col md={6}>
                  <p><strong>Plan:</strong> {plan}</p>
                  <p><strong>Status:</strong> <span className="text-success">Confirmed</span></p>
                </Col>
              </Row>
            </Card.Body>
          </Card>
          
          <div className="next-steps-section">
            <h4><i className="bi bi-arrow-right-circle me-2"></i>What's Next?</h4>
            <ul className="next-steps-list">
              <li>Your premium features have been activated on your account</li>
              <li>You now have access to unlimited transcriptions</li>
              <li>Advanced analytics features are now available</li>
              <li>A receipt has been sent to your email</li>
            </ul>
          </div>
          
          <div className="text-center mt-4 action-buttons">
            <Link to="/dashboard">
              <Button variant="primary" size="lg" className="me-3">
                <i className="bi bi-speedometer2 me-2"></i>Go to Dashboard
              </Button>
            </Link>
            <Link to="/support">
              <Button variant="outline-secondary" size="lg">
                <i className="bi bi-question-circle me-2"></i>Need Help?
              </Button>
            </Link>
          </div>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default ThankYouPage; 