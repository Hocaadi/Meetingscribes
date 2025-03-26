import React, { useState, useRef, useEffect } from 'react';
import { Container, Row, Col, Form, Button, ProgressBar, Alert, Card, ListGroup } from 'react-bootstrap';
import axios from 'axios';
import { saveAs } from 'file-saver';
import config from '../config';
import 'bootstrap-icons/font/bootstrap-icons.css';
import { io } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';

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

// Status Icons for different processing stages
const STATUS_ICONS = {
  started: 'arrow-right-circle',
  converting: 'arrow-repeat',
  transcribing: 'mic',
  transcription_started: 'soundwave',
  transcription_retry: 'arrow-clockwise',
  transcription_completed: 'check-circle',
  transcription_error: 'exclamation-triangle',
  analyzing: 'brain',
  analysis_started: 'lightbulb',
  analysis_retry: 'arrow-clockwise',
  analysis_in_progress: 'hourglass-split',
  analysis_completed: 'check-circle',
  analysis_error: 'exclamation-triangle',
  generating_document: 'file-earmark-word',
  completed: 'check-circle-fill',
  error: 'x-circle-fill'
};

// Status Colors for different processing stages
const STATUS_COLORS = {
  started: 'primary',
  converting: 'primary',
  transcribing: 'info',
  transcription_started: 'info',
  transcription_retry: 'warning',
  transcription_completed: 'success',
  transcription_error: 'danger',
  analyzing: 'primary',
  analysis_started: 'info',
  analysis_retry: 'warning',
  analysis_in_progress: 'info',
  analysis_completed: 'success',
  analysis_error: 'danger',
  generating_document: 'primary',
  completed: 'success',
  error: 'danger'
};

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
  
  // WebSocket related state
  const [socket, setSocket] = useState(null);
  const [sessionId, setSessionId] = useState('');
  const [processingUpdates, setProcessingUpdates] = useState([]);
  const [transcriptionModel, setTranscriptionModel] = useState('');
  const [analysisModel, setAnalysisModel] = useState('');
  
  // Initialize WebSocket connection and session ID
  useEffect(() => {
    // Generate a unique session ID for this client
    const newSessionId = uuidv4();
    setSessionId(newSessionId);
    
    // Connect to WebSocket server
    const socketUrl = config.API_URL || 'http://localhost:5000';
    const newSocket = io(socketUrl, {
      query: { sessionId: newSessionId }
    });
    
    // Set up event listeners
    newSocket.on('connect', () => {
      console.log('Connected to WebSocket server');
    });
    
    newSocket.on('processing_update', (update) => {
      console.log('Processing update:', update);
      
      // Extract model info if available
      if (update.transcriptionModel) {
        setTranscriptionModel(update.transcriptionModel);
      }
      
      if (update.analysisModel) {
        setAnalysisModel(update.analysisModel);
      }
      
      // Auto-complete when final status is received
      if (update.status === 'completed') {
        setProgress(100);
        setUploading(false);
        if (update.fileName) {
          setResult({
            message: 'Processing completed successfully',
            fileName: update.fileName
          });
        }
      }
      
      // Handle errors
      if (update.status === 'error') {
        setError(update.message || 'An error occurred during processing');
        setUploading(false);
        setProgress(0);
      }
      
      // Add the update to our list of updates
      setProcessingUpdates(prev => [...prev, {
        ...update,
        id: Date.now()
      }]);
    });
    
    newSocket.on('disconnect', () => {
      console.log('Disconnected from WebSocket server');
    });
    
    // Save socket instance
    setSocket(newSocket);
    
    // Clean up on component unmount
    return () => {
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, []);

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
      setProcessingUpdates([]); // Clear previous updates
      
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
      
      // Add session ID for WebSocket updates
      if (sessionId) {
        formData.append('sessionId', sessionId);
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
      
      // If we're not receiving WebSocket updates, handle the response as before
      if (!socket || !socket.connected) {
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
      }
      
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
            <>
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
              
              {file && (
                <div className="file-info p-3 mt-3">
                  <p className="mb-1"><strong>Selected File:</strong> {file.name}</p>
                  <p className="mb-0"><strong>Size:</strong> {(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                </div>
              )}
              
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
                <Button variant="primary" onClick={handleUpload} disabled={!file}>
                  Process Audio
                </Button>
              </div>
            </>
          )}
          
          {uploading && (
            <div className="progress-container">
              <div className="mb-4">
                <h4 className="processing-message text-center">
                  {progress < 50 
                    ? 'Uploading your audio file...' 
                    : 'Processing your audio file...'}
                </h4>
                
                {(transcriptionModel || analysisModel) && (
                  <div className="models-info text-center mb-3">
                    {transcriptionModel && (
                      <p className="mb-1"><strong>Transcription Model:</strong> {transcriptionModel}</p>
                    )}
                    {analysisModel && (
                      <p className="mb-1"><strong>Analysis Model:</strong> {analysisModel}</p>
                    )}
                  </div>
                )}
                
                <ProgressBar 
                  animated
                  now={progress} 
                  label={`${progress}%`}
                  variant={progress < 50 ? 'info' : 'primary'}
                  className="mb-4"
                />
              </div>
              
              {processingUpdates.length > 0 && (
                <Card className="processing-updates-card mb-3">
                  <Card.Header>
                    <i className="bi bi-activity me-2" style={{ color: '#4a86e8' }}></i>
                    Processing Status Updates
                  </Card.Header>
                  <ListGroup variant="flush" className="processing-updates-list" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                    {processingUpdates.map(update => (
                      <ListGroup.Item key={update.id} className="d-flex align-items-center">
                        <div className={`update-icon text-${STATUS_COLORS[update.status] || 'secondary'} me-3`}>
                          <i className={`bi bi-${STATUS_ICONS[update.status] || 'arrow-right'}`} style={{ fontSize: '1.25rem' }}></i>
                        </div>
                        <div className="update-content flex-grow-1">
                          <p className="mb-0 fw-medium">{update.message}</p>
                          <p className="text-muted small mb-0">
                            {new Date(update.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                      </ListGroup.Item>
                    ))}
                  </ListGroup>
                </Card>
              )}
              
              <p className="text-muted small text-center">
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
                
                {(transcriptionModel || analysisModel) && (
                  <div className="models-info text-center mb-3">
                    {transcriptionModel && (
                      <p className="mb-1"><strong>Transcription Model:</strong> {transcriptionModel}</p>
                    )}
                    {analysisModel && (
                      <p className="mb-1"><strong>Analysis Model:</strong> {analysisModel}</p>
                    )}
                  </div>
                )}
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