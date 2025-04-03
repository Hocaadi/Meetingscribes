import React, { useState } from 'react';
import { Container, Row, Col, Card, Button } from 'react-bootstrap';
import { useUser } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';

const PremiumUpgrade = ({ usageData, onClose }) => {
  const { user } = useUser();
  
  // This would connect to your payment processor in a real implementation
  const handleUpgrade = () => {
    alert('In a production app, this would redirect to a payment page. This is just a demo.');
    // After successful payment, you would reset the user's quota on the backend
  };
  
  return (
    <Container className="premium-upgrade-container my-4">
      <Row className="justify-content-center">
        <Col md={10} lg={8}>
          <Card className="shadow border-0">
            <Card.Header className="bg-warning text-dark text-center py-3">
              <h3>Upgrade to Premium</h3>
            </Card.Header>
            <Card.Body className="p-4">
              <div className="text-center mb-4">
                <h4>Hello, {user?.firstName || 'there'}!</h4>
                <p className="lead">
                  You've used all {usageData?.limit || 2} of your free processing requests.
                </p>
                <p>Upgrade to continue transforming your meeting recordings into valuable insights.</p>
              </div>
              
              <Row className="mt-4">
                <Col md={6}>
                  <Card className="h-100 plan-card">
                    <Card.Header className="text-center bg-light py-3">
                      <h5>Free Plan</h5>
                    </Card.Header>
                    <Card.Body>
                      <ul className="feature-list">
                        <li>✓ 2 meeting recordings per account</li>
                        <li>✓ Basic transcription</li>
                        <li>✓ Standard analysis</li>
                        <li>✓ DOCX export</li>
                      </ul>
                    </Card.Body>
                    <Card.Footer className="text-center bg-light py-3">
                      <p className="mb-0 text-muted">Your current plan</p>
                    </Card.Footer>
                  </Card>
                </Col>
                
                <Col md={6}>
                  <Card className="h-100 plan-card premium-card border-primary">
                    <Card.Header className="text-center bg-primary text-white py-3">
                      <h5>Premium Plan</h5>
                    </Card.Header>
                    <Card.Body>
                      <ul className="feature-list">
                        <li>✓ <strong>Unlimited</strong> meeting recordings</li>
                        <li>✓ Enhanced transcription</li>
                        <li>✓ Advanced AI analysis</li>
                        <li>✓ Multiple export formats</li>
                        <li>✓ Priority processing</li>
                      </ul>
                    </Card.Body>
                    <Card.Footer className="text-center bg-light py-3">
                      <Link to="/premium">
                        <Button 
                          variant="primary" 
                          className="w-100"
                        >
                          Upgrade Now
                        </Button>
                      </Link>
                    </Card.Footer>
                  </Card>
                </Col>
              </Row>
            </Card.Body>
            <Card.Footer className="bg-light text-center py-3">
              <Button variant="outline-secondary" onClick={onClose}>
                Maybe Later
              </Button>
            </Card.Footer>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default PremiumUpgrade; 