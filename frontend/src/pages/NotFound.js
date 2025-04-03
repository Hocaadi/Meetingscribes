import React from 'react';
import { Container, Row, Col, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';

const NotFound = () => {
  return (
    <section className="py-5">
      <Container className="text-center">
        <Row className="justify-content-center">
          <Col md={8}>
            <h1 className="display-1 fw-bold text-primary">404</h1>
            <h2 className="mb-4">Page Not Found</h2>
            <p className="lead mb-5">
              Sorry, we couldn't find the page you're looking for. 
              It might have been moved, deleted, or never existed.
            </p>
            <Button as={Link} to="/" variant="primary" size="lg">
              Go to Homepage
            </Button>
          </Col>
        </Row>
      </Container>
    </section>
  );
};

export default NotFound; 