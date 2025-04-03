import React, { useState } from 'react';
import { Container, Row, Col, Form, Button, Alert } from 'react-bootstrap';

const Contact = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [validated, setValidated] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    
    if (form.checkValidity() === false) {
      e.stopPropagation();
      setValidated(true);
      return;
    }

    // In a real app, you would send this data to your backend
    console.log('Form submitted:', formData);
    
    // Show success message and reset form
    setShowSuccess(true);
    setFormData({
      name: '',
      email: '',
      subject: '',
      message: ''
    });
    setValidated(false);
    
    // Hide success message after 5 seconds
    setTimeout(() => {
      setShowSuccess(false);
    }, 5000);
  };

  return (
    <section className="contact-section">
      <Container>
        <Row className="mb-5">
          <Col>
            <h1 className="text-center mb-4">Contact Us</h1>
            <p className="lead text-center mb-5">
              Have a question or want to learn more about MeetingScribe? Get in touch with us!
            </p>
          </Col>
        </Row>
        
        <Row>
          <Col lg={6} className="mb-4">
            <h2>Get In Touch</h2>
            <p>
              We'd love to hear from you! Whether you have a question about our service, 
              pricing, or just want to say hello, our team is ready to answer all your questions.
            </p>
            
            <div className="mt-4">
              <h5>Email:</h5>
              <p><a href="mailto:aadarshrathorea@gmail.com">aadarshrathorea@gmail.com</a></p>
              
              <h5 className="mt-4">Purchase the Script:</h5>
              <p>
                If you're interested in purchasing the MeetingScribe script for your own use or modification,
                please contact us via email with "Script Purchase" in the subject line.
              </p>
            </div>
          </Col>
          
          <Col lg={6}>
            <div className="contact-form">
              {showSuccess && (
                <Alert variant="success" onClose={() => setShowSuccess(false)} dismissible>
                  Your message has been sent successfully! We'll get back to you soon.
                </Alert>
              )}
              
              <Form noValidate validated={validated} onSubmit={handleSubmit}>
                <Form.Group className="mb-3" controlId="contactName">
                  <Form.Label>Name</Form.Label>
                  <Form.Control
                    required
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Your name"
                  />
                  <Form.Control.Feedback type="invalid">
                    Please provide your name.
                  </Form.Control.Feedback>
                </Form.Group>
                
                <Form.Group className="mb-3" controlId="contactEmail">
                  <Form.Label>Email</Form.Label>
                  <Form.Control
                    required
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="your.email@example.com"
                  />
                  <Form.Control.Feedback type="invalid">
                    Please provide a valid email address.
                  </Form.Control.Feedback>
                </Form.Group>
                
                <Form.Group className="mb-3" controlId="contactSubject">
                  <Form.Label>Subject</Form.Label>
                  <Form.Control
                    required
                    type="text"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    placeholder="Subject"
                  />
                  <Form.Control.Feedback type="invalid">
                    Please provide a subject.
                  </Form.Control.Feedback>
                </Form.Group>
                
                <Form.Group className="mb-3" controlId="contactMessage">
                  <Form.Label>Message</Form.Label>
                  <Form.Control
                    required
                    as="textarea"
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    rows={5}
                    placeholder="Your message"
                  />
                  <Form.Control.Feedback type="invalid">
                    Please provide a message.
                  </Form.Control.Feedback>
                </Form.Group>
                
                <Button variant="primary" type="submit" className="w-100">
                  Send Message
                </Button>
              </Form>
            </div>
          </Col>
        </Row>
      </Container>
    </section>
  );
};

export default Contact; 