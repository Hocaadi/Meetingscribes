import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Spinner } from 'react-bootstrap';
import { useAuth, useUser } from '../contexts/AuthContext';
import AuthService from '../services/AuthService';
import './Profile.css';

const Profile = () => {
  const { fetchUserProfile } = useAuth();
  const { user, isLoaded } = useUser();
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
  });
  
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  // Load profile data when component mounts
  useEffect(() => {
    if (user) {
      // Initialize form data from user
      setFormData({
        firstName: user.profile?.first_name || user.firstName || '',
        lastName: user.profile?.last_name || user.lastName || '',
        email: user.email || ''
      });
    } else if (isLoaded) {
      // Try to fetch profile data if user is loaded but profile is missing
      fetchUserProfile();
    }
  }, [user, isLoaded, fetchUserProfile]);
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage({ type: '', text: '' });
    
    try {
      // Call API to update profile
      const result = await AuthService.updateProfile({
        firstName: formData.firstName,
        lastName: formData.lastName
      });
      
      if (result.success) {
        setMessage({ type: 'success', text: 'Profile updated successfully!' });
        setIsEditing(false);
        
        // Refresh user profile data
        await fetchUserProfile();
      } else {
        setMessage({ type: 'danger', text: result.error || 'Failed to update profile' });
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      setMessage({ type: 'danger', text: error.message || 'An error occurred while updating your profile' });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (!isLoaded) {
    return (
      <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '50vh' }}>
        <Spinner animation="border" variant="primary" />
      </Container>
    );
  }
  
  return (
    <Container className="profile-container py-5">
      <Row className="justify-content-center">
        <Col md={8} lg={6}>
          <Card className="profile-card">
            <Card.Header as="h4" className="profile-header">
              User Profile
            </Card.Header>
            <Card.Body>
              {message.text && (
                <Alert variant={message.type} dismissible onClose={() => setMessage({ type: '', text: '' })}>
                  {message.text}
                </Alert>
              )}
              
              <Form onSubmit={handleSubmit}>
                <Row className="mb-3">
                  <Col>
                    <div className="profile-avatar-container">
                      <div className="profile-avatar">
                        {formData.firstName.charAt(0)}{formData.lastName.charAt(0)}
                      </div>
                    </div>
                  </Col>
                </Row>
                
                <Form.Group className="mb-3">
                  <Form.Label>Email</Form.Label>
                  <Form.Control
                    type="email"
                    value={formData.email}
                    disabled
                    readOnly
                  />
                  <Form.Text className="text-muted">
                    Email cannot be changed
                  </Form.Text>
                </Form.Group>
                
                <Form.Group className="mb-3">
                  <Form.Label>First Name</Form.Label>
                  <Form.Control
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    disabled={!isEditing || isSubmitting}
                    required
                  />
                </Form.Group>
                
                <Form.Group className="mb-3">
                  <Form.Label>Last Name</Form.Label>
                  <Form.Control
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    disabled={!isEditing || isSubmitting}
                  />
                </Form.Group>
                
                <div className="d-flex justify-content-end mt-4">
                  {isEditing ? (
                    <>
                      <Button 
                        variant="outline-secondary" 
                        className="me-2" 
                        onClick={() => setIsEditing(false)}
                        disabled={isSubmitting}
                      >
                        Cancel
                      </Button>
                      <Button 
                        variant="primary" 
                        type="submit"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <>
                            <Spinner as="span" animation="border" size="sm" className="me-2" />
                            Saving...
                          </>
                        ) : 'Save Changes'}
                      </Button>
                    </>
                  ) : (
                    <Button 
                      variant="primary" 
                      onClick={() => setIsEditing(true)}
                    >
                      Edit Profile
                    </Button>
                  )}
                </div>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default Profile; 