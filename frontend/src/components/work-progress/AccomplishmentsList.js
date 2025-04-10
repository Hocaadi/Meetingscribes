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
  Dropdown,
  Alert,
  Spinner
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
import axios from 'axios';
import config from '../../config';

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
      
      console.log('Starting brag sheet generation with options:', bragSheetOptions);
      console.log('Using filtered accomplishments:', filteredAccomplishments.length);
      
      // Define endpoints to try in order - local endpoint first, then try mock/fallback
      const endpoints = [
        `${window.location.origin.replace(':3000', ':5000')}/api/work-progress/ai/generate-brag-sheet`,
        `${window.location.origin.replace(':3000', ':5000')}/api/ai/generate-brag-sheet`,
        `${config.API_URL}/api/work-progress/ai/generate-brag-sheet`,
        `${config.API_URL}/api/ai/generate-brag-sheet`,
        // Keep these as last resort fallbacks
        `https://meetingscribe-backend.onrender.com/api/work-progress/ai/generate-brag-sheet`,
        `https://meetingscribe-backend.onrender.com/api/ai/generate-brag-sheet`
      ];
      
      // Log the endpoints we'll try
      console.log('Will try these endpoints in order:', endpoints);
      
      let lastError = null;
      
      if (bragSheetOptions.format === 'pdf') {
        // For PDF format, try multiple endpoints with blob response
        let pdfBlob = null;
        let pdfUrl = null;
        
        for (const endpoint of endpoints) {
          try {
            console.log(`Attempting PDF generation with endpoint: ${endpoint}`);
            
            const response = await axios({
              url: endpoint,
              method: 'POST',
              data: {
                accomplishments: filteredAccomplishments,
                ...bragSheetOptions
              },
              responseType: 'blob', // Important for handling binary data
              withCredentials: false, // Try without credentials for cross-domain
              timeout: 30000, // Longer timeout for PDF generation
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/pdf'
              }
            });
            
            console.log(`Success with endpoint: ${endpoint}`, response);
            
            // Check if response contains actual PDF data
            if (response.data.type !== 'application/pdf') {
              console.warn('Response is not a PDF, skipping', response.data);
              continue; // Try next endpoint
            }
            
            // Store the blob for potential later use
            pdfBlob = new Blob([response.data], { type: 'application/pdf' });
            pdfUrl = window.URL.createObjectURL(pdfBlob);
            
            // Create a temporary link element to trigger the download
            const link = document.createElement('a');
            link.href = pdfUrl;
            link.setAttribute('download', `brag_sheet_${Date.now()}.pdf`);
            document.body.appendChild(link);
            link.click();
            
            // Don't revoke URL yet - keep it for the download button
            link.remove();
            
            // Set an indication that it was generated and store the URL for download button
            setBragSheetContent(JSON.stringify({
              message: 'PDF generated and downloaded successfully!',
              url: pdfUrl,
              timestamp: Date.now()
            }));
            return; // Exit after successful generation
          } catch (error) {
            console.error(`Failed with endpoint ${endpoint}:`, error);
            lastError = error;
            // Continue to the next endpoint
          }
        }
        
        // If we reach here, try a fallback approach - generate simple PDF client-side
        try {
          console.log('All API endpoints failed, trying client-side PDF generation');
          
          // Generate a very simple PDF using client-side library (would require adding a PDF generation library)
          // For now, just set an error message
          setBragSheetContent(`Failed to generate PDF from server. Server may be down or not responding.\n\nPlease try a different format or try again later.`);
        } catch (fallbackError) {
          console.error('Even fallback PDF generation failed:', fallbackError);
          throw lastError || fallbackError;
        }
      } else {
        // For non-PDF formats
        for (const endpoint of endpoints) {
          try {
            console.log(`Attempting ${bragSheetOptions.format} generation with endpoint: ${endpoint}`);
            
            const response = await axios.post(endpoint, {
              accomplishments: filteredAccomplishments,
              ...bragSheetOptions
            }, {
              headers: {
                'Content-Type': 'application/json'
              },
              withCredentials: false, // Try without credentials for cross-domain
              timeout: 20000
            });
            
            console.log(`Success with endpoint: ${endpoint}`);
            
            // Check if response has content property
            if (response.data && response.data.content) {
              setBragSheetContent(response.data.content);
              return; // Exit after successful generation
            } else {
              console.warn('Response missing content property:', response.data);
              // Try a different format from the response
              if (response.data) {
                if (typeof response.data === 'string') {
                  setBragSheetContent(response.data);
                  return;
                } else if (response.data.message || response.data.text) {
                  setBragSheetContent(response.data.message || response.data.text);
                  return;
                }
              }
              // Continue to next endpoint if content not found
            }
          } catch (error) {
            console.error(`Failed with endpoint ${endpoint}:`, error);
            lastError = error;
            // Continue to the next endpoint
          }
        }
        
        // If all endpoints fail, create a mock brag sheet content as fallback
        try {
          console.log('All endpoints failed, creating mock brag sheet content');
          
          // Create simple fallback content
          const mockContent = `# Brag Sheet (Fallback Mode)

## Summary
This is a fallback brag sheet generated locally. The server may be down or unreachable.

## Your Accomplishments
${filteredAccomplishments.map(acc => `
### ${acc.title}
**Impact Level:** ${acc.impact_level}
**Date:** ${new Date(acc.accomplishment_date).toLocaleDateString()}

${acc.description}
`).join('\n')}

*This content was generated offline due to server connectivity issues.*`;
          
          setBragSheetContent(mockContent);
          return;
        } catch (fallbackError) {
          console.error('Fallback content generation failed:', fallbackError);
          throw lastError || fallbackError;
        }
      }
    } catch (error) {
      console.error('Error generating brag sheet:', error);
      
      // Create a friendly error message
      const errorMessage = error.response ? 
        `Server error: ${error.response.status} ${error.response.statusText}` : 
        `Error: ${error.message || 'Unknown error'}`;
      
      setBragSheetContent(`Failed to generate brag sheet. ${errorMessage}\n\nPlease try again or use a different format.`);
    } finally {
      setGeneratingBragSheet(false);
    }
  };
  
  // Update the handleDownloadBragSheet function to be more resilient to formatting errors
  const handleDownloadBragSheet = () => {
    if (bragSheetOptions.format === 'pdf') {
      try {
        // For PDF, try to use the stored URL
        if (bragSheetContent) {
          let pdfData = null;
          
          // First check if the content is valid JSON
          try {
            // Only attempt to parse if it looks like JSON (starts with {)
            if (bragSheetContent.trim().startsWith('{')) {
              pdfData = JSON.parse(bragSheetContent);
            }
          } catch (e) {
            console.error('Error parsing PDF data:', e);
            // Continue with fallback - don't return here
          }
          
          // If we have valid PDF data with a URL, use it
          if (pdfData && pdfData.url) {
            // Create a link to download it again
            const link = document.createElement('a');
            link.href = pdfData.url;
            link.setAttribute('download', `brag_sheet_${Date.now()}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            return;
          }
        }
        
        // If we get here, we need to regenerate the PDF
        console.log('PDF URL not found or invalid, regenerating...');
        handleGenerateBragSheet();
      } catch (error) {
        console.error('Error re-downloading PDF:', error);
        alert('Could not download PDF. Please try generating again.');
      }
    } else {
      try {
        // For non-PDF formats
        const blob = new Blob([bragSheetContent], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        
        // Create a link and trigger download
        const link = document.createElement('a');
        link.href = url;
        
        // Set appropriate filename and extension based on format
        const extension = bragSheetOptions.format === 'html' ? 'html' : 
                          bragSheetOptions.format === 'markdown' ? 'md' : 'txt';
        
        link.setAttribute('download', `brag_sheet_${Date.now()}.${extension}`);
        document.body.appendChild(link);
        link.click();
        
        // Clean up
        window.URL.revokeObjectURL(url);
        link.remove();
      } catch (error) {
        console.error('Error downloading text content:', error);
        alert('Could not download content. Please try generating again.');
      }
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
  
  // Enhance the isPdfGeneratedAndValid function to handle more cases
  const isPdfGeneratedAndValid = () => {
    try {
      if (!bragSheetContent) return false;
      if (typeof bragSheetContent !== 'string') return false;
      
      // If the content is clearly an error message, it's not valid
      if (bragSheetContent.includes('Failed to generate') || 
          bragSheetContent.includes('Error:') ||
          bragSheetContent.includes('Server error:') ||
          bragSheetContent.includes('not responding')) {
        return false;
      }
      
      // For PDF format, check multiple conditions
      if (bragSheetOptions.format === 'pdf') {
        // First try to parse as JSON if it starts with {
        if (bragSheetContent.trim().startsWith('{')) {
          try {
            const pdfData = JSON.parse(bragSheetContent);
            // Valid if it has a URL and looks like a success message
            return pdfData && pdfData.url && 
                   (pdfData.message && pdfData.message.includes('success'));
          } catch (e) {
            // If parsing fails, it's not valid JSON
            return false;
          }
        }
        // If it's not JSON and doesn't have URL data, consider it invalid
        return false;
      }
      
      // For other formats, check if content exists and is reasonable length
      return bragSheetContent.length > 50;
    } catch (err) {
      console.error('Error checking PDF validity:', err);
      return false;
    }
  };

  // Create a component for the Download button with enhanced feedback
  const DownloadButton = () => {
    const isValid = isPdfGeneratedAndValid();
    const isEnabled = bragSheetContent && !generatingBragSheet;
    
    let buttonText = 'Download';
    let buttonVariant = 'outline-secondary';
    
    // For PDF, provide clearer text
    if (bragSheetOptions.format === 'pdf' && isValid) {
      buttonText = 'Download PDF Again';
      buttonVariant = 'outline-primary';
    }
    
    return (
      <Button 
        variant={buttonVariant}
        size="sm"
        onClick={handleDownloadBragSheet}
        disabled={!isEnabled}
        title={!isEnabled ? 'Generate a brag sheet first' : 'Download your brag sheet'}
      >
        <FontAwesomeIcon icon={faDownload} className="me-1" />
        {buttonText}
      </Button>
    );
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
          {filteredAccomplishments.length === 0 ? (
            <Alert variant="warning">
              <Alert.Heading>No Accomplishments Selected</Alert.Heading>
              <p>
                You need to have at least one accomplishment selected to generate a brag sheet.
                Please adjust your filters or add new accomplishments.
              </p>
            </Alert>
          ) : (
            <>
              <Row className="mb-3">
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>Time Period</Form.Label>
                    <Form.Select 
                      name="time_period" 
                      value={bragSheetOptions.time_period}
                      onChange={handleBragSheetOptionChange}
                      disabled={generatingBragSheet}
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
                      disabled={generatingBragSheet}
                    >
                      <option value="markdown">Markdown</option>
                      <option value="plaintext">Plain Text</option>
                      <option value="html">HTML</option>
                      <option value="pdf">PDF</option>
                    </Form.Select>
                    {bragSheetOptions.format === 'pdf' && (
                      <Form.Text className="text-muted">
                        PDF will download automatically when generated
                      </Form.Text>
                    )}
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>Target Audience</Form.Label>
                    <Form.Select 
                      name="target_audience" 
                      value={bragSheetOptions.target_audience}
                      onChange={handleBragSheetOptionChange}
                      disabled={generatingBragSheet}
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
                  {generatingBragSheet ? (
                    <>
                      <Spinner animation="border" size="sm" role="status" className="me-2" />
                      Generating Brag Sheet...
                    </>
                  ) : (
                    'Generate Brag Sheet'
                  )}
                </Button>
              </div>
              
              {generatingBragSheet && (
                <Alert variant="info">
                  <Alert.Heading>Generating Your Brag Sheet</Alert.Heading>
                  <p>
                    Please wait while we generate your brag sheet. This may take up to 30 seconds
                    depending on the number of accomplishments and the selected format.
                  </p>
                  <div className="d-flex justify-content-center">
                    <Spinner animation="border" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </Spinner>
                  </div>
                </Alert>
              )}
              
              {bragSheetContent && bragSheetContent.includes('Error') && (
                <Alert variant="danger">
                  <Alert.Heading>Error Generating Brag Sheet</Alert.Heading>
                  <p>{bragSheetContent}</p>
                  <hr />
                  <p className="mb-0">
                    Try selecting a different format or try again later. If the problem persists,
                    contact support.
                  </p>
                </Alert>
              )}
              
              {bragSheetContent && !bragSheetContent.includes('Error') && (
                <Card className="mt-3">
                  <Card.Header>
                    <div className="d-flex justify-content-between align-items-center">
                      <h6 className="mb-0">Your Brag Sheet</h6>
                      <DownloadButton />
                    </div>
                  </Card.Header>
                  <Card.Body>
                    {bragSheetOptions.format === 'pdf' ? (
                      isPdfGeneratedAndValid() ? (
                        <Alert variant="success">
                          <Alert.Heading>PDF Generated!</Alert.Heading>
                          <p>Your PDF brag sheet has been generated and should have downloaded automatically.</p>
                          <p>If the download didn't start, you can use the <strong>Download PDF Again</strong> button above to try again.</p>
                        </Alert>
                      ) : (
                        <Alert variant="warning">
                          <Alert.Heading>PDF Generation Issue</Alert.Heading>
                          <p>There was a problem generating or downloading your PDF.</p>
                          <hr/>
                          <ul>
                            <li>Try clicking the <strong>Generate Brag Sheet</strong> button again</li>
                            <li>Try a different format like Markdown or Plain Text</li>
                            <li>Check your network connection and ensure you can access the server</li>
                            <li>If using a corporate network, check if PDF downloads are allowed</li>
                          </ul>
                        </Alert>
                      )
                    ) : (
                      <pre className="brag-sheet-content" style={{ whiteSpace: 'pre-wrap' }}>
                        {bragSheetContent}
                      </pre>
                    )}
                  </Card.Body>
                </Card>
              )}
            </>
          )}
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default AccomplishmentsList; 