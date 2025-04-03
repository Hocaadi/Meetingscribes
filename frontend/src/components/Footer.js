import React from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import './Footer.css';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="site-footer">
      <Container>
        <Row>
          <Col md={4} className="footer-brand">
            <div className="footer-logo-container">
              <img
                src="/logo.png"
                width="50"
                height="50"
                className="footer-logo"
                alt="MeetingScribe Logo"
              />
              <h5 className="footer-brand-name">MeetingScribe</h5>
            </div>
            <p className="footer-tagline">AI-powered meeting transcription and analysis</p>
          </Col>
          
          <Col md={2}>
            <h5 className="footer-heading">Product</h5>
            <ul className="footer-links">
              <li><Link to="/dashboard">Dashboard</Link></li>
              <li><Link to="/premium">Premium</Link></li>
              <li><a href="#features">Features</a></li>
              <li><a href="#pricing">Pricing</a></li>
            </ul>
          </Col>
          
          <Col md={2}>
            <h5 className="footer-heading">Company</h5>
            <ul className="footer-links">
              <li><Link to="/about">About Us</Link></li>
              <li><Link to="/contact">Contact</Link></li>
              <li><Link to="/blog">Blog</Link></li>
              <li><Link to="/careers">Careers</Link></li>
            </ul>
          </Col>
          
          <Col md={4}>
            <h5 className="footer-heading">Stay Connected</h5>
            <p>Subscribe to our newsletter for updates and tips</p>
            <div className="footer-social-icons">
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" aria-label="Twitter">
                <i className="bi bi-twitter"></i>
              </a>
              <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
                <i className="bi bi-linkedin"></i>
              </a>
              <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
                <i className="bi bi-facebook"></i>
              </a>
              <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" aria-label="YouTube">
                <i className="bi bi-youtube"></i>
              </a>
            </div>
          </Col>
        </Row>
        
        <hr className="footer-divider" />
        
        <Row className="footer-bottom">
          <Col md={6}>
            <p className="copyright-text">
              &copy; {currentYear} MeetingScribe. All rights reserved.
            </p>
          </Col>
          <Col md={6}>
            <ul className="footer-legal">
              <li><Link to="/privacy">Privacy Policy</Link></li>
              <li><Link to="/terms">Terms of Service</Link></li>
              <li><Link to="/cookies">Cookie Policy</Link></li>
            </ul>
          </Col>
        </Row>
      </Container>
    </footer>
  );
};

export default Footer; 