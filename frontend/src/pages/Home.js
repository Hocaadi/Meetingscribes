import React from 'react';
import { Container, Row, Col, Button } from 'react-bootstrap';
import FileUpload from '../components/FileUpload';
import Features from '../components/Features';

const Home = () => {
  return (
    <>
      <section className="hero-section">
        <Container>
          <Row className="justify-content-center">
            <Col md={10} lg={8}>
              <h1>Transform Meeting Recordings into Actionable Insights</h1>
              <p>
                Upload your audio recording and let our AI do the work.
                Get an accurate transcript and structured analysis of your meetings in minutes.
              </p>
              <Button 
                variant="light" 
                size="lg"
                href="#upload-section"
                className="px-4"
              >
                Get Started
              </Button>
            </Col>
          </Row>
        </Container>
      </section>
      
      <div id="upload-section">
        <FileUpload />
      </div>
      
      <Features />
      
      <section className="bg-light py-5 text-center">
        <Container>
          <Row className="justify-content-center">
            <Col md={8}>
              <h2>Save Hours of Manual Work</h2>
              <p className="lead mb-4">
                Stop spending hours taking notes or reviewing meeting recordings.
                MeetingScribe gives you the important information in a structured format,
                so you can focus on action instead of administration.
              </p>
              <Button 
                variant="primary" 
                size="lg"
                href="#upload-section"
                className="px-4"
              >
                Try it Now - It's Free!
              </Button>
            </Col>
          </Row>
        </Container>
      </section>
    </>
  );
};

export default Home; 