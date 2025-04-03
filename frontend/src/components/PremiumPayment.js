import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Alert } from 'react-bootstrap';
import axios from 'axios';
import { useUser } from '../contexts/AuthContext';
import config from '../config';
import './PremiumPayment.css';
import { useNavigate } from 'react-router-dom';

const PremiumPayment = () => {
  const { isLoaded, isSignedIn, user } = useUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState('idle');
  const [isPremium, setIsPremium] = useState(false);
  const navigate = useNavigate();

  // Check if user is already premium
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      checkPremiumStatus();
    }
  }, [isLoaded, isSignedIn, user]);

  const checkPremiumStatus = async () => {
    try {
      const response = await axios.get(`${config.API_URL}/api/payment/premium-status`, {
        headers: { 'x-user-id': user.id }
      });
      setIsPremium(response.data.isPremium);
    } catch (err) {
      console.error('Error checking premium status:', err);
    }
  };

  // Simplified direct upgrade without Razorpay
  const handleDirectUpgrade = async () => {
    if (!isSignedIn) {
      setError('Please sign in to upgrade to Premium');
      return;
    }

    setLoading(true);
    setError(null);
    setPaymentStatus('processing');

    try {
      // Call the direct test upgrade endpoint
      const response = await axios.post(
        `${config.API_URL}/api/payment/test-upgrade`,
        {},
        { headers: { 'x-user-id': user.id } }
      );
      
      if (response.data.isPremium) {
        setPaymentStatus('success');
        setIsPremium(true);
        const orderId = response.data.orderId || generateOrderId();
        const plan = 'Premium Subscription';
        navigate(`/thankyou?orderId=${orderId}&plan=${encodeURIComponent(plan)}`);
      } else {
        setPaymentStatus('failed');
        setError('Upgrade failed. Please try again.');
      }
    } catch (err) {
      console.error('Upgrade failed:', err);
      setPaymentStatus('failed');
      setError(err.response?.data?.error || 'Failed to upgrade to premium');
    } finally {
      setLoading(false);
    }
  };

  // Add this generateOrderId utility function
  const generateOrderId = () => {
    // Create an order ID with format: MS-[timestamp]-[random]
    const timestamp = new Date().getTime();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `MS-${timestamp}-${random}`;
  };

  if (!isLoaded) {
    return <div className="text-center my-5">Loading...</div>;
  }

  return (
    <div className="premium-page-container">
      <Container>
        <Row className="justify-content-center">
          <Col md={8} lg={6}>
            <div className="text-center mb-5">
              <h1 className="premium-title">Upgrade to Premium</h1>
              <p className="premium-subtitle">Unlock unlimited meeting transcriptions and advanced features</p>
            </div>
            
            {error && (
              <Alert variant="danger" onClose={() => setError(null)} dismissible>
                {error}
              </Alert>
            )}
            
            {isPremium ? (
              <Card className="premium-status-card">
                <Card.Body className="text-center">
                  <i className="bi bi-patch-check-fill premium-icon"></i>
                  <h2>You're a Premium Member!</h2>
                  <p>Enjoy unlimited transcriptions and all premium features.</p>
                  <Button variant="primary" href="/dashboard">Go to Dashboard</Button>
                </Card.Body>
              </Card>
            ) : (
              <Card className="premium-plan-card">
                <Card.Header as="h3" className="text-center premium-card-header">
                  Premium Plan
                </Card.Header>
                <Card.Body>
                  <div className="price-container">
                    <span className="price-currency">$</span>
                    <span className="price">15</span>
                    <span className="price-period">/month</span>
                  </div>
                  
                  <ul className="premium-features">
                    <li><i className="bi bi-check-circle-fill"></i> Unlimited meeting transcriptions</li>
                    <li><i className="bi bi-check-circle-fill"></i> Interactive AI Chat with your transcripts</li>
                    <li><i className="bi bi-check-circle-fill"></i> Priority processing</li>
                    <li><i className="bi bi-check-circle-fill"></i> Advanced analytics and insights</li>
                    <li><i className="bi bi-check-circle-fill"></i> Download in multiple formats</li>
                    <li><i className="bi bi-check-circle-fill"></i> Premium support</li>
                  </ul>
                  
                  <div className="text-center">
                    <Alert variant="info" className="mb-3">
                      <strong>Demo Mode:</strong> Click the button below for instant premium access.
                    </Alert>
                  </div>
                  
                  <Button 
                    variant="primary" 
                    className="upgrade-button"
                    onClick={handleDirectUpgrade}
                    disabled={loading || paymentStatus === 'processing'}
                  >
                    {loading ? 'Processing...' : 'Upgrade to Premium'}
                  </Button>
                  
                  {paymentStatus === 'success' && (
                    <Alert variant="success" className="mt-3">
                      Upgrade successful! Your account has been upgraded to Premium.
                    </Alert>
                  )}
                </Card.Body>
              </Card>
            )}
          </Col>
        </Row>
      </Container>
    </div>
  );
};

export default PremiumPayment; 