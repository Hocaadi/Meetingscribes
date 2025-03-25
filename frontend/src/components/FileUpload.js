import React, { useState, useRef } from 'react';
import { Container, Row, Col, Form, Button, ProgressBar, Alert, Card } from 'react-bootstrap';
import axios from 'axios';
import { saveAs } from 'file-saver';
import config from '../config';

// Meeting topics options
const MEETING_TOPICS = [
  { value: "", label: "Select a topic (optional)" },
  { value: "project_update", label: "Project Update/Status" },
  { value: "strategy", label: "Strategy/Planning" },
  { value: "sales", label: "Sales/Revenue" },
  { value: "marketing", label: "Marketing/Campaigns" },
  { value: "product", label: "Product Development" },
  { value: "hr", label: "HR/People Management" },
  { value: "finance", label: "Finance/Budget" },
  { value: "operations", label: "Operations" },
  { value: "customer", label: "Customer Relations" },
  { value: "technical", label: "Technical Discussion" },
  { value: "brainstorming", label: "Brainstorming Session" },
  { value: "training", label: "Training/Learning" },
  { value: "other", label: "Other" }
];

const FileUpload = () => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [customInstructions, setCustomInstructions] = useState('');
  const [showCustomInstructions, setShowCustomInstructions] = useState(false);
  const [meetingTopic, setMeetingTopic] = useState('');
  const fileInputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      
      // Check if file is an audio file
      if (!selectedFile.type.startsWith('audio/')) {
        setError('Please upload an audio file (MP3, WAV, etc.)');
        return;
      }
      
      // Check file size (max 50MB)
      if (selectedFile.size > config.MAX_FILE_SIZE) {
        setError('File size exceeds 50MB limit');
        return;
      }
      
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      
      // Check if file is an audio file
      if (!droppedFile.type.startsWith('audio/')) {
        setError('Please upload an audio file (MP3, WAV, etc.)');
        return;
      }
      
      // Check file size (max 50MB)
      if (droppedFile.size > config.MAX_FILE_SIZE) {
        setError('File size exceeds 50MB limit');
        return;
      }
      
      setFile(droppedFile);
      setError(null);
    }
  };

  const handleTopicChange = (e) => {
    setMeetingTopic(e.target.value);
  };

  const handleCustomInstructionsChange = (e) => {
    setCustomInstructions(e.target.value);
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file to upload');
      return;
    }
    
    try {
      setError(null);
      setUploading(true);
      setProgress(0);
      
      const formData = new FormData();
      formData.append('audioFile', file);
      
      // Add meeting topic if selected
      if (meetingTopic) {
        formData.append('meetingTopic', meetingTopic);
      }
      
      // Add custom instructions if provided
      if (customInstructions.trim()) {
        formData.append('customInstructions', customInstructions.trim());
      }
      
      const response = await axios.post(config.UPLOAD_ENDPOINT, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          // Only show progress up to 50% as the processing will take the remaining time
          const percentCompleted = Math.round((progressEvent.loaded * 50) / progressEvent.total);
          setProgress(percentCompleted);
        }
      });
      
      // Simulate processing time (server is actually processing the file)
      let currentProgress = 50;
      const processingInterval = setInterval(() => {
        currentProgress += 1;
        setProgress(currentProgress);
        
        if (currentProgress >= 100) {
          clearInterval(processingInterval);
        }
      }, 500);
      
      setResult({
        message: response.data.message,
        fileName: response.data.fileName
      });
      
      // Clean up interval
      setTimeout(() => {
        clearInterval(processingInterval);
        setProgress(100);
        setUploading(false);
      }, 20000); // 20 seconds max for processing simulation
      
    } catch (error) {
      setError(error.response?.data?.error || 'Error processing file');
      setUploading(false);
      setProgress(0);
    }
  };

  const handleDownload = async () => {
    if (!result || !result.fileName) {
      setError('No file available for download');
      return;
    }
    
    try {
      const response = await axios.get(`${config.API_URL}/api/download/${result.fileName}`, {
        responseType: 'blob'
      });
      
      saveAs(response.data, result.fileName);
    } catch (error) {
      setError('Error downloading file');
    }
  };

  const handleReset = () => {
    setFile(null);
    setResult(null);
    setError(null);
    setProgress(0);
    setUploading(false);
    setCustomInstructions('');
    setShowCustomInstructions(false);
    setMeetingTopic('');
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const toggleCustomInstructions = () => {
    setShowCustomInstructions(!showCustomInstructions);
  };

  return (
    <Container className="upload-container">
      <Row className="justify-content-center">
        <Col md={10}>
          {error && (
            <Alert variant="danger" onClose={() => setError(null)} dismissible>
              {error}
            </Alert>
          )}
          
          {!result && !uploading && (
            <div 
              className={`upload-box ${dragActive ? 'active' : ''}`}
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current.click()}
            >
              <i className="bi bi-cloud-arrow-up" style={{ fontSize: '3rem', color: '#4a86e8' }}></i>
              <h3 className="mt-3">Upload Audio File</h3>
              <p className="text-muted">
                Drag & drop your audio file here, or click to browse
              </p>
              <p className="text-muted small">
                Supported formats: MP3, WAV, M4A, FLAC, etc. (Max 50MB)
              </p>
              <Form.Control
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="audio/*"
                style={{ display: 'none' }}
              />
            </div>
          )}
          
          {file && !uploading && !result && (
            <>
              <div className="file-info p-3 mt-3">
                <p className="mb-1"><strong>Selected File:</strong> {file.name}</p>
                <p className="mb-0"><strong>Size:</strong> {(file.size / (1024 * 1024)).toFixed(2)} MB</p>
              </div>
              
              <Card className="mt-3 topic-selection-card">
                <Card.Body>
                  <Form.Group>
                    <Form.Label>
                      <i className="bi bi-tag me-2" style={{ color: '#4a86e8' }}></i>
                      Meeting Topic
                    </Form.Label>
                    <Form.Select 
                      value={meetingTopic}
                      onChange={handleTopicChange}
                      className="meeting-topic-select"
                    >
                      {MEETING_TOPICS.map(topic => (
                        <option key={topic.value} value={topic.value}>
                          {topic.label}
                        </option>
                      ))}
                    </Form.Select>
                    <Form.Text className="text-muted">
                      Selecting a topic helps the AI better understand the context of your meeting.
                    </Form.Text>
                  </Form.Group>
                </Card.Body>
              </Card>
              
              <Card className="mt-3 custom-instructions-card">
                <Card.Header 
                  className="d-flex justify-content-between align-items-center custom-instructions-header"
                  style={{ cursor: 'pointer', backgroundColor: '#f8f9fa', borderBottom: showCustomInstructions ? '1px solid #dee2e6' : 'none' }}
                  onClick={toggleCustomInstructions}
                >
                  <div>
                    <i className="bi bi-lightbulb me-2" style={{ color: '#ffc107' }}></i>
                    <span>Custom Analysis Instructions</span>
                  </div>
                  <i className={`bi ${showCustomInstructions ? 'bi-chevron-up' : 'bi-chevron-down'}`}></i>
                </Card.Header>
                
                {showCustomInstructions && (
                  <Card.Body>
                    <Form.Group>
                      <Form.Label>Add your custom instructions for the analysis:</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={3}
                        placeholder="E.g., Focus on action items related to marketing, Extract all client names mentioned, Identify budget discussions..."
                        value={customInstructions}
                        onChange={handleCustomInstructionsChange}
                      />
                      <Form.Text className="text-muted">
                        Your instructions will be used to enhance the AI analysis of your meeting transcript.
                      </Form.Text>
                    </Form.Group>
                  </Card.Body>
                )}
              </Card>
              
              <div className="d-flex justify-content-end mt-3">
                <Button variant="secondary" className="me-2" onClick={handleReset}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleUpload}>
                  Process Audio
                </Button>
              </div>
            </>
          )}
          
          {uploading && (
            <div className="progress-container">
              <p className="processing-message">
                {progress < 50 
                  ? 'Uploading your audio file...' 
                  : 'Processing your audio file...'}
              </p>
              <ProgressBar 
                animated
                now={progress} 
                label={`${progress}%`}
                variant={progress < 50 ? 'info' : 'primary'}
              />
              <p className="text-muted small text-center mt-2">
                This may take a few minutes depending on the audio length
              </p>
            </div>
          )}
          
          {result && (
            <div className="results-container text-center">
              <div className="mb-4">
                <i className="bi bi-check-circle-fill" style={{ fontSize: '3rem', color: '#28a745' }}></i>
                <h3 className="mt-3">Processing Complete!</h3>
                <p>Your audio has been successfully transcribed and analyzed.</p>
              </div>
              
              <div className="d-flex justify-content-center mt-4">
                <Button variant="outline-secondary" className="me-3" onClick={handleReset}>
                  Process Another File
                </Button>
                <Button variant="primary" onClick={handleDownload}>
                  <i className="bi bi-download me-2"></i>
                  Download Report
                </Button>
              </div>
            </div>
          )}
        </Col>
      </Row>
    </Container>
  );
};

export default FileUpload; 