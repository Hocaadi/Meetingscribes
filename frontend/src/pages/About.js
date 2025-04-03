import React from 'react';
import { Container, Row, Col, Card } from 'react-bootstrap';

const About = () => {
  return (
    <section className="about-section">
      <Container>
        <Row className="mb-5">
          <Col>
            <h1 className="text-center mb-4">About MeetingScribe</h1>
            <p className="lead text-center mb-5">
              Transforming the way businesses capture and leverage meeting information.
            </p>
          </Col>
        </Row>
        
        <Row className="mb-5">
          <Col md={6}>
            <h2>Our Mission</h2>
            <p>
              At MeetingScribe, we believe that valuable insights should never be lost due to inadequate notes or missed meetings. 
              Our mission is to help teams capture, organize, and act on meeting information efficiently.
            </p>
            <p>
              We've built a powerful yet simple tool that leverages cutting-edge AI technology to transcribe 
              meeting recordings and extract the most important information automatically.
            </p>
          </Col>
          <Col md={6}>
            <h2>How It Works</h2>
            <p>
              MeetingScribe uses advanced speech recognition technology to transcribe your meeting recordings with high accuracy. 
              Then, our AI analysis engine extracts key information like discussion topics, action items, decisions, and requests.
            </p>
            <p>
              The result is a neatly formatted document that captures the essence of your meeting, 
              saving you hours of manual note-taking and review.
            </p>
          </Col>
        </Row>
        
        <Row>
          <Col>
            <h2 className="text-center mb-4">Technologies We Use</h2>
          </Col>
        </Row>
        
        <Row className="mb-5">
          <Col md={4} className="mb-4">
            <Card className="h-100">
              <Card.Body>
                <Card.Title>OpenAI Whisper</Card.Title>
                <Card.Text>
                  State-of-the-art speech recognition technology for highly accurate transcription,
                  capable of handling different accents, background noise, and technical terminology.
                </Card.Text>
              </Card.Body>
            </Card>
          </Col>
          <Col md={4} className="mb-4">
            <Card className="h-100">
              <Card.Body>
                <Card.Title>GPT-4</Card.Title>
                <Card.Text>
                  Advanced natural language processing to analyze transcripts,
                  identify key information, and generate structured summaries that capture the essential content.
                </Card.Text>
              </Card.Body>
            </Card>
          </Col>
          <Col md={4} className="mb-4">
            <Card className="h-100">
              <Card.Body>
                <Card.Title>Secure Cloud Processing</Card.Title>
                <Card.Text>
                  All audio processing happens securely in the cloud,
                  with automatic file deletion after processing to ensure your data remains private.
                </Card.Text>
              </Card.Body>
            </Card>
          </Col>
        </Row>
        
        <Row>
          <Col className="text-center">
            <p className="lead">
              Ready to try MeetingScribe for your team? <a href="/">Get started now!</a>
            </p>
          </Col>
        </Row>
      </Container>
    </section>
  );
};

export default About; 