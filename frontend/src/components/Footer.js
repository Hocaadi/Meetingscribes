import React from 'react';
import { Container, Row, Col } from 'react-bootstrap';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="footer">
      <Container>
        <Row>
          <Col md={4}>
            <h5>MeetingScribe</h5>
            <p>Transform your audio meetings into actionable insights with AI-powered transcription and analysis.</p>
          </Col>
          <Col md={4}>
            <h5>Quick Links</h5>
            <ul className="list-unstyled">
              <li><a href="/" className="text-white">Home</a></li>
              <li><a href="/about" className="text-white">About</a></li>
              <li><a href="/contact" className="text-white">Contact</a></li>
            </ul>
          </Col>
          <Col md={4}>
            <h5>Contact</h5>
            <p>
              For business inquiries, please contact:<br />
              <a href="mailto:aadarshrathorea@gmail.com" className="text-white">aadarshrathorea@gmail.com</a>
            </p>
          </Col>
        </Row>
        <hr className="my-4 bg-light" />
        <Row>
          <Col>
            <p className="text-center mb-0">
              &copy; {currentYear} MeetingScribe. All rights reserved.
            </p>
          </Col>
        </Row>
      </Container>
    </footer>
  );
};

export default Footer; 