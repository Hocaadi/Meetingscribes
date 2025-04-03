import React, { useState } from 'react';
import { 
  Card, 
  Button, 
  Form, 
  Row, 
  Col, 
  Badge, 
  InputGroup, 
  Modal,
  Dropdown
} from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faPlus, 
  faCalendarAlt, 
  faTrophy, 
  faStar, 
  faDownload, 
  faTags,
  faSearch,
  faSortAmountDown
} from '@fortawesome/free-solid-svg-icons';
import WorkProgressService from '../../services/WorkProgressService';
import WorkAIService from '../../services/WorkAIService';

/**
 * AccomplishmentsList component for displaying and managing accomplishments
 */
const AccomplishmentsList = ({ accomplishments, dateRange, onDateRangeChange }) => {
  // State for new accomplishment
  const [showNewForm, setShowNewForm] = useState(false);
  const [newAccomplishment, setNewAccomplishment] = useState({
    title: '',
    description: '',
    accomplishment_date: new Date().toISOString().split('T')[0],
    impact_level: 'medium',
    tags: [],
    is_featured: false
  });
  
  // State for filters
  const [searchQuery, setSearchQuery] = useState('');
  const [impactFilter, setImpactFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date-desc');
  
  // State for generate brag sheet modal
  const [showBragSheetModal, setShowBragSheetModal] = useState(false);
  const [bragSheetOptions, setBragSheetOptions] = useState({
    time_period: '3 months',
    format: 'markdown',
    target_audience: 'manager'
  });
  const [bragSheetContent, setBragSheetContent] = useState('');
  const [generatingBragSheet, setGeneratingBragSheet] = useState(false);
  
  // Toggle new accomplishment form
  const toggleNewForm = () => {
    setShowNewForm(!showNewForm);
  };
  
  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewAccomplishment({ ...newAccomplishment, [name]: value });
  };
  
  // Handle tag input
  const handleTagInput = (e) => {
    if (e.key === 'Enter' && e.target.value.trim()) {
      e.preventDefault();
      const newTag = e.target.value.trim();
      if (!newAccomplishment.tags.includes(newTag)) {
        setNewAccomplishment({
          ...newAccomplishment,
          tags: [...newAccomplishment.tags, newTag]
        });
      }
      e.target.value = '';
    }
  };
  
  // Remove a tag
  const removeTag = (tagToRemove) => {
    setNewAccomplishment({
      ...newAccomplishment,
      tags: newAccomplishment.tags.filter(tag => tag !== tagToRemove)
    });
  };
  
  // Submit new accomplishment
  const handleSubmitAccomplishment = async (e) => {
    e.preventDefault();
    
    try {
      await WorkProgressService.createAccomplishment(newAccomplishment);
      
      // Reset form
      setNewAccomplishment({
        title: '',
        description: '',
        accomplishment_date: new Date().toISOString().split('T')[0],
        impact_level: 'medium',
        tags: [],
        is_featured: false
      });
      
      setShowNewForm(false);
      
      // Should trigger a refresh of accomplishments in parent component
    } catch (error) {
      console.error('Error creating accomplishment:', error);
    }
  };
  
  // Handle brag sheet generation
  const handleGenerateBragSheet = async () => {
    try {
      setGeneratingBragSheet(true);
      
      const result = await WorkAIService.generateBragSheet(
        filteredAccomplishments,
        bragSheetOptions
      );
      
      setBragSheetContent(result.content);
    } catch (error) {
      console.error('Error generating brag sheet:', error);
    } finally {
      setGeneratingBragSheet(false);
    }
  };
  
  // Handle brag sheet option changes
  const handleBragSheetOptionChange = (e) => {
    const { name, value } = e.target;
    setBragSheetOptions({ ...bragSheetOptions, [name]: value });
  };
  
  // Filter accomplishments based on search query and filters
  const filteredAccomplishments = accomplishments.filter(accomplishment => {
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesTitle = accomplishment.title.toLowerCase().includes(query);
      const matchesDescription = accomplishment.description.toLowerCase().includes(query);
      const matchesTags = accomplishment.tags?.some(tag => tag.toLowerCase().includes(query));
      
      if (!matchesTitle && !matchesDescription && !matchesTags) {
        return false;
      }
    }
    
    // Filter by impact level
    if (impactFilter !== 'all' && accomplishment.impact_level !== impactFilter) {
      return false;
    }
    
    return true;
  });
  
  // Sort accomplishments
  const sortedAccomplishments = [...filteredAccomplishments].sort((a, b) => {
    switch (sortBy) {
      case 'date-asc':
        return new Date(a.accomplishment_date) - new Date(b.accomplishment_date);
      case 'date-desc':
        return new Date(b.accomplishment_date) - new Date(a.accomplishment_date);
      case 'impact-high':
        const impactOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        return (impactOrder[b.impact_level] || 0) - (impactOrder[a.impact_level] || 0);
      case 'impact-low':
        const impactOrderAsc = { low: 1, medium: 2, high: 3, critical: 4 };
        return (impactOrderAsc[a.impact_level] || 0) - (impactOrderAsc[b.impact_level] || 0);
      case 'title':
        return a.title.localeCompare(b.title);
      default:
        return new Date(b.accomplishment_date) - new Date(a.accomplishment_date);
    }
  });
  
  // Get impact badge
  const getImpactBadge = (impact) => {
    const impacts = {
      low: { color: 'secondary', label: 'Low Impact' },
      medium: { color: 'primary', label: 'Medium Impact' },
      high: { color: 'success', label: 'High Impact' },
      critical: { color: 'warning', label: 'Critical Impact' }
    };
    
    const { color, label } = impacts[impact] || impacts.medium;
    return <Badge bg={color} className="impact-badge">{label}</Badge>;
  };
  
  return (
    <div className="accomplishments-list">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <InputGroup className="search-box">
            <InputGroup.Text>
              <FontAwesomeIcon icon={faSearch} />
            </InputGroup.Text>
            <Form.Control
              placeholder="Search accomplishments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </InputGroup>
        </div>
        <div className="d-flex">
          <Dropdown className="me-2">
            <Dropdown.Toggle variant="outline-secondary" id="impact-filter">
              <FontAwesomeIcon icon={faSortAmountDown} className="me-2" />
              {impactFilter === 'all' ? 'All Impact Levels' : `${impactFilter.charAt(0).toUpperCase() + impactFilter.slice(1)} Impact`}
            </Dropdown.Toggle>
            <Dropdown.Menu>
              <Dropdown.Item onClick={() => setImpactFilter('all')} active={impactFilter === 'all'}>
                All Impact Levels
              </Dropdown.Item>
              <Dropdown.Item onClick={() => setImpactFilter('critical')} active={impactFilter === 'critical'}>
                Critical Impact
              </Dropdown.Item>
              <Dropdown.Item onClick={() => setImpactFilter('high')} active={impactFilter === 'high'}>
                High Impact
              </Dropdown.Item>
              <Dropdown.Item onClick={() => setImpactFilter('medium')} active={impactFilter === 'medium'}>
                Medium Impact
              </Dropdown.Item>
              <Dropdown.Item onClick={() => setImpactFilter('low')} active={impactFilter === 'low'}>
                Low Impact
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
          <Button 
            variant="outline-primary" 
            className="me-2"
            onClick={() => setShowBragSheetModal(true)}
          >
            <FontAwesomeIcon icon={faDownload} className="me-2" />
            Brag Sheet
          </Button>
          <Button 
            variant="primary" 
            onClick={toggleNewForm}
          >
            <FontAwesomeIcon icon={faPlus} className="me-1" />
            New
          </Button>
        </div>
      </div>
      
      {/* New Accomplishment Form */}
      {showNewForm && (
        <Card className="mb-4">
          <Card.Body>
            <h5 className="mb-3">
              <FontAwesomeIcon icon={faTrophy} className="me-2" />
              Add New Accomplishment
            </h5>
            <Form onSubmit={handleSubmitAccomplishment}>
              <Form.Group className="mb-3">
                <Form.Label>Title</Form.Label>
                <Form.Control
                  type="text"
                  name="title"
                  value={newAccomplishment.title}
                  onChange={handleInputChange}
                  placeholder="What did you accomplish?"
                  required
                />
              </Form.Group>
              
              <Form.Group className="mb-3">
                <Form.Label>Description</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  name="description"
                  value={newAccomplishment.description}
                  onChange={handleInputChange}
                  placeholder="Describe your accomplishment in detail. What was the impact? What challenges did you overcome?"
                  required
                />
              </Form.Group>
              
              <Row className="mb-3">
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Date</Form.Label>
                    <Form.Control
                      type="date"
                      name="accomplishment_date"
                      value={newAccomplishment.accomplishment_date}
                      onChange={handleInputChange}
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Impact Level</Form.Label>
                    <Form.Select 
                      name="impact_level" 
                      value={newAccomplishment.impact_level}
                      onChange={handleInputChange}
                    >
                      <option value="low">Low Impact</option>
                      <option value="medium">Medium Impact</option>
                      <option value="high">High Impact</option>
                      <option value="critical">Critical Impact</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
              </Row>
              
              <Form.Group className="mb-3">
                <Form.Label>Tags</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="Type and press Enter to add tags"
                  onKeyDown={handleTagInput}
                />
                <div className="mt-2">
                  {newAccomplishment.tags.map((tag, index) => (
                    <Badge 
                      key={index} 
                      bg="light" 
                      text="dark" 
                      className="me-1 mb-1 p-2"
                      style={{ cursor: 'pointer' }}
                      onClick={() => removeTag(tag)}
                    >
                      {tag} &times;
                    </Badge>
                  ))}
                </div>
              </Form.Group>
              
              <Form.Group className="mb-3">
                <Form.Check
                  type="checkbox"
                  label="Feature this accomplishment"
                  name="is_featured"
                  checked={newAccomplishment.is_featured}
                  onChange={(e) => setNewAccomplishment({
                    ...newAccomplishment,
                    is_featured: e.target.checked
                  })}
                />
              </Form.Group>
              
              <div className="d-flex justify-content-end">
                <Button variant="secondary" className="me-2" onClick={toggleNewForm}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit">
                  Save Accomplishment
                </Button>
              </div>
            </Form>
          </Card.Body>
        </Card>
      )}
      
      {/* Accomplishments List */}
      {sortedAccomplishments.length === 0 ? (
        <div className="text-center p-4 bg-light rounded">
          <p>No accomplishments yet. Add some to build your brag sheet!</p>
        </div>
      ) : (
        <div>
          {sortedAccomplishments.map(accomplishment => (
            <div key={accomplishment.id} className="accomplishment-item">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <div className="accomplishment-date">
                  <FontAwesomeIcon icon={faCalendarAlt} className="me-1" />
                  {new Date(accomplishment.accomplishment_date).toLocaleDateString()}
                  {accomplishment.is_featured && (
                    <span className="ms-2">
                      <FontAwesomeIcon icon={faStar} className="text-warning" />
                    </span>
                  )}
                </div>
                {getImpactBadge(accomplishment.impact_level)}
              </div>
              <h5 className="accomplishment-title">{accomplishment.title}</h5>
              <p className="accomplishment-description">{accomplishment.description}</p>
              {accomplishment.tags && accomplishment.tags.length > 0 && (
                <div className="mb-2">
                  <FontAwesomeIcon icon={faTags} className="me-1 text-muted" />
                  {accomplishment.tags.map((tag, index) => (
                    <Badge key={index} bg="light" text="dark" className="me-1">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      {/* Brag Sheet Modal */}
      <Modal show={showBragSheetModal} onHide={() => setShowBragSheetModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Generate Brag Sheet</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Row className="mb-3">
            <Col md={4}>
              <Form.Group>
                <Form.Label>Time Period</Form.Label>
                <Form.Select 
                  name="time_period" 
                  value={bragSheetOptions.time_period}
                  onChange={handleBragSheetOptionChange}
                >
                  <option value="1 month">Past Month</option>
                  <option value="3 months">Past 3 Months</option>
                  <option value="6 months">Past 6 Months</option>
                  <option value="1 year">Past Year</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label>Format</Form.Label>
                <Form.Select 
                  name="format" 
                  value={bragSheetOptions.format}
                  onChange={handleBragSheetOptionChange}
                >
                  <option value="markdown">Markdown</option>
                  <option value="plaintext">Plain Text</option>
                  <option value="html">HTML</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label>Target Audience</Form.Label>
                <Form.Select 
                  name="target_audience" 
                  value={bragSheetOptions.target_audience}
                  onChange={handleBragSheetOptionChange}
                >
                  <option value="manager">Manager</option>
                  <option value="team">Team</option>
                  <option value="performance_review">Performance Review</option>
                  <option value="resume">Resume</option>
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>
          
          <div className="d-grid gap-2 mb-3">
            <Button 
              variant="primary" 
              onClick={handleGenerateBragSheet}
              disabled={generatingBragSheet || filteredAccomplishments.length === 0}
            >
              {generatingBragSheet ? 'Generating...' : 'Generate Brag Sheet'}
            </Button>
          </div>
          
          {bragSheetContent && (
            <Card className="mt-3">
              <Card.Header>
                <div className="d-flex justify-content-between align-items-center">
                  <h6 className="mb-0">Your Brag Sheet</h6>
                  <Button variant="outline-secondary" size="sm">
                    <FontAwesomeIcon icon={faDownload} className="me-1" />
                    Download
                  </Button>
                </div>
              </Card.Header>
              <Card.Body>
                <pre className="brag-sheet-content" style={{ whiteSpace: 'pre-wrap' }}>
                  {bragSheetContent}
                </pre>
              </Card.Body>
            </Card>
          )}
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default AccomplishmentsList; 