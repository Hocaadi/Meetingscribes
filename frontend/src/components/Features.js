import React from 'react';
import { Container, Row, Col } from 'react-bootstrap';

const Features = () => {
  return (
    <section className="features-section">
      <Container>
        <h2 className="text-center mb-5">How MeetingScribe Works</h2>
        <Row>
          <Col md={4} className="mb-4">
            <div className="feature-card">
              <div className="feature-icon">
                <i className="bi bi-upload"></i>
              </div>
              <h3>Upload Audio</h3>
              <p>Upload your meeting recording in various audio formats including MP3, WAV, M4A, and more.</p>
            </div>
          </Col>
          <Col md={4} className="mb-4">
            <div className="feature-card">
              <div className="feature-icon">
                <i className="bi bi-file-earmark-text"></i>
              </div>
              <h3>AI Transcription</h3>
              <p>Our advanced AI engine automatically transcribes your audio with high accuracy, even with multiple speakers.</p>
            </div>
          </Col>
          <Col md={4} className="mb-4">
            <div className="feature-card">
              <div className="feature-icon">
                <i className="bi bi-graph-up"></i>
              </div>
              <h3>Intelligent Analysis</h3>
              <p>Receive a structured report with key discussion points, action items, decisions, and important information.</p>
            </div>
          </Col>
        </Row>
        
        <Row className="mt-4">
          <Col md={4} className="mb-4">
            <div className="feature-card">
              <div className="feature-icon">
                <i className="bi bi-clock-history"></i>
              </div>
              <h3>Save Time</h3>
              <p>Eliminate manual note-taking and hours of reviewing recordings. Get actionable insights in minutes.</p>
            </div>
          </Col>
          <Col md={4} className="mb-4">
            <div className="feature-card">
              <div className="feature-icon">
                <i className="bi bi-file-earmark-word"></i>
              </div>
              <h3>Word Document</h3>
              <p>Download your transcript and analysis as a professional Word document ready to share with your team.</p>
            </div>
          </Col>
          <Col md={4} className="mb-4">
            <div className="feature-card">
              <div className="feature-icon">
                <i className="bi bi-shield-lock"></i>
              </div>
              <h3>Security & Privacy</h3>
              <p>Your audio files and transcripts are processed securely and automatically deleted after processing.</p>
            </div>
          </Col>
        </Row>
      </Container>
    </section>
  );
};

export default Features; 