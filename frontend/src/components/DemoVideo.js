import React, { useState, useRef, useEffect } from 'react';
import { Container, Row, Col, Button, Modal } from 'react-bootstrap';
import './DemoVideo.css';

const DemoVideo = () => {
  const [showModal, setShowModal] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const videoRef = useRef(null);

  const handleShowModal = () => {
    setShowModal(true);
    // Reset error state when opening modal
    setVideoError(false);
  };

  const handleCloseModal = () => {
    if (videoRef.current) {
      videoRef.current.pause();
    }
    setShowModal(false);
  };

  // Cleanup function when component unmounts
  useEffect(() => {
    return () => {
      if (videoRef.current) {
        videoRef.current.pause();
      }
    };
  }, []);

  return (
    <section className="demo-video-section py-5" id="demo">
      <Container>
        <Row className="justify-content-center mb-5">
          <Col md={10} className="text-center">
            <h2 className="section-title">See MeetingScribe in Action</h2>
            <p className="section-subtitle">
              Watch how MeetingScribe transforms your meeting recordings into actionable insights in minutes
            </p>
          </Col>
        </Row>
        
        <Row className="justify-content-center">
          <Col lg={10} xl={8}>
            <div className="video-preview-container">
              {/* Video thumbnail with play button */}
              <div className="video-thumbnail" onClick={handleShowModal}>
                <img 
                  src="/images/default-thumbnail.svg" 
                  alt="MeetingScribe Demo" 
                  className="img-fluid rounded shadow"
                  onError={(e) => {
                    e.target.onerror = null;
                    // Use a valid placeholder URL from a public CDN service
                    e.target.src = 'https://placehold.co/1280x720/0d6efd/ffffff?text=MeetingScribe+Demo';
                  }}
                />
                <div className="play-button-overlay">
                  <div className="play-button">
                    <i className="bi bi-play-fill"></i>
                  </div>
                </div>
              </div>
              
              <div className="video-features">
                <div className="feature">
                  <i className="bi bi-mic"></i>
                  <span>Audio Transcription</span>
                </div>
                <div className="feature">
                  <i className="bi bi-list-check"></i>
                  <span>Action Items</span>
                </div>
                <div className="feature">
                  <i className="bi bi-lightbulb"></i>
                  <span>Key Insights</span>
                </div>
                <div className="feature">
                  <i className="bi bi-file-earmark-word"></i>
                  <span>DOCX Export</span>
                </div>
              </div>
            </div>
          </Col>
        </Row>
        
        <Row className="mt-4 justify-content-center">
          <Col md={6} className="text-center">
            <Button 
              variant="primary" 
              size="lg" 
              className="watch-demo-btn"
              onClick={handleShowModal}
            >
              <i className="bi bi-play-circle me-2"></i>
              Watch Full Demo
            </Button>
          </Col>
        </Row>
      </Container>
      
      {/* Video Modal */}
      <Modal 
        show={showModal} 
        onHide={handleCloseModal} 
        size="lg" 
        centered
        contentClassName="video-modal-content"
      >
        <Modal.Header closeButton>
          <Modal.Title>MeetingScribe Demo</Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-0">
          {!videoError ? (
            <video 
              ref={videoRef}
              controls 
              width="100%" 
              autoPlay
              className="demo-video"
              onError={(e) => {
                console.error("Video failed to load:", e);
                setVideoError(true);
              }}
            >
              <source src="/videos/demo-video.mp4" type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          ) : (
            <div className="video-error-message">
              Video preview unavailable. Please check back later.
            </div>
          )}
        </Modal.Body>
      </Modal>
    </section>
  );
};

export default DemoVideo; 