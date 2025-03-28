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

// Evaluation templates
const EVALUATION_TEMPLATES = [
  { 
    value: "", 
    label: "No evaluation template" 
  },
  { 
    value: "performance_evaluation", 
    label: "Employee/Leader Meeting Performance Evaluation",
    template: `Employee/Leader Meeting Performance Evaluation Template
Meeting Details
Date: [YYYY-MM-DD]
Meeting Topic: [Topic of Discussion]
Participants: [List of attendees]
Duration: [Meeting Length]
Evaluation Criteria (100 Points Total - Relative Grading)
Each participant will be scored out of 10 in the following categories, leading to a weighted total score.

Criteria	Description	Weightage (%)
Solving Complex Problems	Ability to tackle and resolve critical issues	10%
Proactiveness	Initiating discussions and taking ownership of tasks	10%
Discussing Roadblocks	Identifying challenges and suggesting solutions	10%
Professionalism & Communication	Clear, concise, and respectful discussion	10%
Task Accomplishments	Contribution towards tasks and complexity-based completion	10%
Decision-Making & Leadership	Taking charge, guiding discussions, and decisive actions	10%
Collaboration & Team Engagement	Interaction, supporting peers, and constructive feedback	10%
Innovation & Creativity	Bringing new ideas and approaches to challenges	10%
Adherence to Meeting Agenda	Staying on topic and time efficiency	10%
Actionable Takeaways & Execution	Providing clear next steps and follow-up actions	10%
Scoring Table (Relative Grading)
The LLM will analyze each participant's contribution and assign scores relative to their peers, ensuring no one scores 100.

Participant Name	Scores by Category (0-10)	Total Score
[Name 1]	[Scores for each criterion]	[Calculated]
[Name 2]	[Scores for each criterion]	[Calculated]
[Name 3]	[Scores for each criterion]	[Calculated]
Winner Announcement
Top Performer: [Name] (Highest Score)
Key Strengths: [Mention top strengths]
Areas for Improvement: [Mention scope for growth]`
  },
  { 
    value: "custom", 
    label: "Custom Evaluation Template" 
  }
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
  error: 'x-circle-fill',
  // Chunking-related status icons
  chunking: 'scissors',
  chunking_info: 'info-circle',
  creating_chunk: 'file-earmark-plus',
  processing_chunk: 'file-earmark-music',
  chunk_completed: 'check-square',
  chunk_error: 'exclamation-square',
  // Audio enhancement status icons
  audio_enhancing: 'music-note-beamed',
  audio_enhanced: 'filter-square',
  info: 'info-circle',
  warning: 'exclamation-triangle',
  success: 'check-circle',
  processing: 'arrow-repeat',
  completed: 'check-circle',
  started: 'play-circle'
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
  error: 'danger',
  // Chunking-related status colors
  chunking: 'primary',
  chunking_info: 'info',
  creating_chunk: 'primary',
  processing_chunk: 'info',
  chunk_completed: 'success',
  chunk_error: 'warning',
  // Audio enhancement status colors
  audio_enhancing: 'info',
  audio_enhanced: 'success',
  info: 'info',
  warning: 'warning',
  error: 'danger',
  success: 'success',
  processing: 'primary',
  completed: 'success',
  started: 'info'
};

const CONNECTION_STATUS = {
  connected: { color: 'success', text: 'Connected', icon: 'wifi' },
  disconnected: { color: 'danger', text: 'Disconnected', icon: 'wifi-off' },
  error: { color: 'danger', text: 'Connection Error', icon: 'exclamation-triangle' },
  connecting: { color: 'warning', text: 'Connecting...', icon: 'arrow-repeat' }
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
  const [evaluationTemplate, setEvaluationTemplate] = useState('');
  const [customEvaluationTemplate, setCustomEvaluationTemplate] = useState('');
  const [showEvaluationOptions, setShowEvaluationOptions] = useState(false);
  const fileInputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  
  // WebSocket related state
  const [socket, setSocket] = useState(null);
  const [sessionId] = useState(() => {
    // Try to get existing session ID from localStorage
    const existingId = localStorage.getItem('meetingScribeSessionId');
    if (existingId) {
      return existingId;
    }
    // Create new ID if none exists
    const newId = uuidv4();
    localStorage.setItem('meetingScribeSessionId', newId);
    return newId;
  });
  const [processingUpdates, setProcessingUpdates] = useState([]);
  const [transcriptionModel, setTranscriptionModel] = useState('');
  const [analysisModel, setAnalysisModel] = useState('');
  const [socketStatus, setSocketStatus] = useState('disconnected');
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  
  // Inside the FileUpload component state declarations, add:
  const [documentFormat, setDocumentFormat] = useState('docx');
  
  // Add new state variables for Q&A feature
  const [question, setQuestion] = useState('');
  const [answers, setAnswers] = useState([]);
  const [isAskingQuestion, setIsAskingQuestion] = useState(false);
  
  // Initialize WebSocket connection and session ID
  useEffect(() => {
    const connectSocket = () => {
      console.log('Initializing WebSocket connection with session ID:', sessionId);
      
      // Connect to WebSocket server
      const socketUrl = config.API_URL || 'http://localhost:5000';
      const newSocket = io(socketUrl, {
        query: { sessionId },
        reconnection: true,
        reconnectionAttempts: maxReconnectAttempts,
        reconnectionDelay: 1000,
        timeout: 20000
      });
      
      // Set up event listeners
      newSocket.on('connect', () => {
        console.log('Connected to WebSocket server with socket ID:', newSocket.id);
        setSocketStatus('connected');
        reconnectAttemptsRef.current = 0; // Reset counter on successful connection
      });
      
      newSocket.on('processing_update', (update) => {
        console.log('Processing update received:', update);
        
        // Extract model info if available
        if (update.transcriptionModel) {
          setTranscriptionModel(update.transcriptionModel);
        }
        
        if (update.analysisModel) {
          setAnalysisModel(update.analysisModel);
        }
        
        // Auto-complete when final status is received
        if (update.status === 'completed' || update.message === 'Processing completed successfully') {
          setProgress(100);
          setUploading(false);
          setResult({
            message: 'Processing completed successfully',
            fileName: update.reportName || update.fileName, 
            reportUrl: update.reportUrl || `/download/${update.reportName || update.fileName}`,
            format: update.format || (update.reportName?.endsWith('.pdf') ? 'pdf' : 'docx'),
            docxUrl: update.docxUrl,
            pdfUrl: update.pdfUrl,
            primaryUrl: update.primaryUrl
          });
        }
        
        // Handle errors
        if (update.status === 'error') {
          setError(update.message || 'An error occurred during processing');
          setUploading(false);
          setProgress(0);
        }
        
        // Update progress if available
        if (update.percentComplete && !isNaN(update.percentComplete)) {
          // Scale to 50-100% range since upload is 0-50%
          const scaledProgress = 50 + (update.percentComplete / 2);
          setProgress(Math.min(99, scaledProgress)); // Cap at 99% until complete
        }
        
        // Add the update to our list of updates
        setProcessingUpdates(prev => [...prev, {
          ...update,
          id: Date.now()
        }]);
      });
      
      newSocket.on('disconnect', (reason) => {
        console.log('Disconnected from WebSocket server:', reason);
        setSocketStatus('disconnected');
        
        // Attempt reconnection if not already reconnecting and haven't exceeded attempts
        if (reconnectAttemptsRef.current < maxReconnectAttempts && 
            reason !== 'io client disconnect') {
          reconnectAttemptsRef.current++;
          console.log(`Attempting to reconnect (${reconnectAttemptsRef.current}/${maxReconnectAttempts})...`);
          
          // Manual reconnection after delay
          setTimeout(() => {
            if (newSocket && !newSocket.connected) {
              console.log('Reconnecting...');
              newSocket.connect();
            }
          }, 2000);
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          console.error('Maximum reconnection attempts reached');
          setError(prev => prev || 'Connection lost. Please refresh the page to reconnect.');
        }
      });
      
      newSocket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
        setSocketStatus('error');
      });
      
      // Save socket instance
      setSocket(newSocket);
      
      // Return cleanup function
      return () => {
        console.log('Cleaning up socket connection');
        if (newSocket) {
          newSocket.disconnect();
        }
      };
    };
    
    // Initialize connection
    const cleanup = connectSocket();
    
    // Setup heartbeat ping every 30 seconds to keep connection alive
    const heartbeatInterval = setInterval(() => {
      if (socket && socket.connected) {
        socket.emit('ping', { timestamp: new Date().toISOString() });
      }
    }, 30000);
    
    // Clean up on component unmount
    return () => {
      clearInterval(heartbeatInterval);
      cleanup();
    };
  }, [sessionId]); // Only recreate the socket if sessionId changes

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
  
  const handleEvaluationTemplateChange = (e) => {
    const selectedTemplate = e.target.value;
    setEvaluationTemplate(selectedTemplate);
    
    // If a predefined template is selected, populate with the template content
    if (selectedTemplate && selectedTemplate !== 'custom') {
      const template = EVALUATION_TEMPLATES.find(t => t.value === selectedTemplate);
      if (template && template.template) {
        setCustomEvaluationTemplate(template.template);
      }
    } else if (selectedTemplate === 'custom') {
      // For custom template, start with an empty textarea or a basic structure
      setCustomEvaluationTemplate('');
    } else {
      // No template selected
      setCustomEvaluationTemplate('');
    }
  };
  
  const handleCustomEvaluationTemplateChange = (e) => {
    setCustomEvaluationTemplate(e.target.value);
  };
  
  const toggleEvaluationOptions = () => {
    setShowEvaluationOptions(!showEvaluationOptions);
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
      
      // Check socket connection and update UI accordingly
      const isSocketConnected = socket && socket.connected;
      if (!isSocketConnected) {
        console.warn('WebSocket not connected. Will use polling fallback for updates.');
        // Add a processing update to inform user
        setProcessingUpdates([{
          id: Date.now(),
          status: 'warning',
          message: 'WebSocket connection not available. Progress updates may be delayed.',
          timestamp: new Date().toISOString()
        }]);
        
        // Try to reconnect socket
        if (socket) {
          socket.connect();
        }
      } else {
        // Add a processing update to indicate WebSocket is working
        setProcessingUpdates([{
          id: Date.now(),
          status: 'info',
          message: 'Connected to server. Starting upload...',
          timestamp: new Date().toISOString()
        }]);
      }
      
      const formData = new FormData();
      formData.append('audioFile', file);
      
      // Add meeting topic if selected
      if (meetingTopic) {
        formData.append('meetingTopic', meetingTopic);
      }
      
      // Add custom instructions if provided
      let finalInstructions = customInstructions.trim();
      
      // If an evaluation template is selected, append it to custom instructions
      if (evaluationTemplate && customEvaluationTemplate) {
        // If there are already custom instructions, add the template at the end
        if (finalInstructions) {
          finalInstructions += '\n\n=== EVALUATION TEMPLATE ===\n' + customEvaluationTemplate;
        } else {
          finalInstructions = customEvaluationTemplate;
        }
      }
      
      if (finalInstructions) {
        formData.append('customInstructions', finalInstructions);
      }
      
      // Add session ID for WebSocket updates
      if (sessionId) {
        formData.append('sessionId', sessionId);
        console.log('Using session ID for upload:', sessionId);
      }
      
      // Add format preference
      formData.append('format', documentFormat);
      
      console.log('Starting file upload with WebSocket status:', socketStatus);
      
      const response = await axios.post(config.UPLOAD_ENDPOINT, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          // Only show progress up to 50% as the processing will take the remaining time
          const percentCompleted = Math.round((progressEvent.loaded * 50) / progressEvent.total);
          setProgress(percentCompleted);
        },
        // Set a longer timeout for large files
        timeout: 300000 // 5 minutes
      });
      
      console.log('Upload completed successfully, response:', response.data);
      
      // If we're not receiving WebSocket updates, handle the response directly
      if (!isSocketConnected) {
        // Simulate processing time (server is actually processing the file)
        let currentProgress = 50;
        const processingInterval = setInterval(() => {
          currentProgress += 1;
          setProgress(currentProgress);
          
          if (currentProgress >= 100) {
            clearInterval(processingInterval);
          }
        }, 500);
        
        // Set result based on response
        setResult({
          message: response.data.message,
          fileName: response.data.fileName,
          reportUrl: response.data.reportUrl,
          format: response.data.format || 'docx',
          docxUrl: response.data.docxUrl,
          pdfUrl: response.data.pdfUrl
        });
        
        // Clean up interval and complete
        setTimeout(() => {
          clearInterval(processingInterval);
          setProgress(100);
          setUploading(false);
        }, Math.min(60000, file.size / 1024)); // Scale with file size, max 1 minute
      }
      
    } catch (error) {
      console.error('Upload error:', error);
      setError(error.response?.data?.error || 'Error processing file');
      setUploading(false);
      setProgress(0);
      
      // Add error to processing updates
      setProcessingUpdates(prev => [...prev, {
        id: Date.now(),
        status: 'error',
        message: error.response?.data?.error || 'Error processing file',
        details: error.message,
        timestamp: new Date().toISOString()
      }]);
    }
  };

  const handleDownload = (format = 'primary') => {
    if (!result) return;
    
    let downloadUrl;
    let filename;
    
    // Log the available URLs for debugging
    console.log('Available download URLs:', {
      result,
      reportUrl: result.reportUrl,
      docxUrl: result.docxUrl,
      pdfUrl: result.pdfUrl,
      format: result.format,
      requestedFormat: format
    });
    
    if (format === 'primary') {
      // Use the main report URL
      downloadUrl = result.reportUrl;
      filename = result.fileName || result.reportName;
    } else if (format === 'docx' && result.docxUrl) {
      // Use the DOCX URL if specifically requested
      downloadUrl = result.docxUrl;
      filename = result.docxFileName;
    } else if (format === 'pdf' && result.pdfUrl) {
      // Use the PDF URL if specifically requested
      downloadUrl = result.pdfUrl;
      filename = result.pdfFileName;
    } else {
      // Fallback to the main report URL
      downloadUrl = result.reportUrl;
      filename = result.fileName || result.reportName;
    }
    
    // Ensure URL starts with API path if it's a relative URL
    if (downloadUrl && !downloadUrl.startsWith('http')) {
      const apiBase = `${window.location.protocol}//${window.location.host}`;
      // Ensure URL starts with slash
      if (!downloadUrl.startsWith('/')) {
        downloadUrl = '/' + downloadUrl;
      }
      downloadUrl = apiBase + downloadUrl;
    }
    
    console.log(`Initiating download for ${format} format: ${downloadUrl}`);
    
    if (downloadUrl) {
      try {
        // Create a direct download link instead of opening in a new window
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.setAttribute('download', filename || 'meeting_report');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (error) {
        console.error('Download error:', error);
        setError('Error initiating download. Please try again.');
      }
    } else {
      setError(`No download URL available for ${format} format`);
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
    setEvaluationTemplate('');
    setCustomEvaluationTemplate('');
    setShowEvaluationOptions(false);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const toggleCustomInstructions = () => {
    setShowCustomInstructions(!showCustomInstructions);
  };

  // Add new function to handle question submission
  const handleAskQuestion = async () => {
    if (!question.trim() || !result || !result.reportName) {
      setError('Please enter a question and ensure a document has been generated.');
      return;
    }
    
    try {
      setIsAskingQuestion(true);
      
      // Get document name from the result
      const documentName = result.reportName || result.fileName;
      
      console.log(`Asking question about document: ${documentName}`);
      console.log(`Question: ${question}`);
      
      // Send question to backend
      const response = await axios.post(`${config.API_URL}/api/ask-question`, {
        question: question,
        documentName: documentName,
        format: result.format || 'docx'
      });
      
      if (response.data && response.data.answer) {
        // Add new answer to the list, preserving previous answers
        setAnswers(prevAnswers => [
          {
            id: Date.now(),
            question: question,
            answer: response.data.answer,
            timestamp: new Date().toISOString()
          },
          ...prevAnswers
        ]);
        
        // Clear the question input
        setQuestion('');
      } else {
        setError('Received an invalid response from the server.');
      }
    } catch (err) {
      console.error('Error asking question:', err);
      setError(`Failed to get an answer: ${err.message || 'Unknown error'}`);
    } finally {
      setIsAskingQuestion(false);
    }
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
              
              {/* Document Format Selection */}
              <Form.Group className="mb-3">
                <Form.Label>Document Format</Form.Label>
                <div className="d-flex">
                  <Form.Check
                    type="radio"
                    id="format-docx"
                    name="documentFormat"
                    label="Word Document (DOCX)"
                    className="me-3"
                    checked={documentFormat === 'docx'}
                    onChange={() => setDocumentFormat('docx')}
                    disabled={uploading}
                  />
                  <Form.Check
                    type="radio"
                    id="format-pdf"
                    name="documentFormat" 
                    label="PDF Document"
                    checked={documentFormat === 'pdf'}
                    onChange={() => setDocumentFormat('pdf')}
                    disabled={uploading}
                  />
                </div>
              </Form.Group>
              
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
              
              <Card className="mt-3 evaluation-options-card">
                <Card.Header 
                  className="d-flex justify-content-between align-items-center evaluation-options-header"
                  style={{ cursor: 'pointer', backgroundColor: '#f8f9fa', borderBottom: showEvaluationOptions ? '1px solid #dee2e6' : 'none' }}
                  onClick={toggleEvaluationOptions}
                >
                  <div>
                    <i className="bi bi-award me-2" style={{ color: '#ffc107' }}></i>
                    <span>Meeting Evaluation by Guider</span>
                  </div>
                  <i className={`bi ${showEvaluationOptions ? 'bi-chevron-up' : 'bi-chevron-down'}`}></i>
                </Card.Header>
                
                {showEvaluationOptions && (
                  <Card.Body>
                    <Form.Group>
                      <Form.Label>
                        <strong>Select an evaluation template:</strong>
                      </Form.Label>
                      <Form.Select 
                        value={evaluationTemplate}
                        onChange={handleEvaluationTemplateChange}
                        className="evaluation-template-select mb-3"
                      >
                        {EVALUATION_TEMPLATES.map(template => (
                          <option key={template.value} value={template.value}>
                            {template.label}
                          </option>
                        ))}
                      </Form.Select>
                      <Form.Text className="text-muted mb-3 d-block">
                        The Guider agent will evaluate meeting participants based on the selected template.
                      </Form.Text>
                      
                      {(evaluationTemplate === 'custom' || evaluationTemplate === 'performance_evaluation') && (
                        <div className="mt-3">
                          <Form.Label>
                            <strong>{evaluationTemplate === 'custom' ? 'Custom Evaluation Template:' : 'Performance Evaluation Template:'}</strong>
                          </Form.Label>
                          <Form.Control
                            as="textarea"
                            rows={10}
                            placeholder="Enter your custom evaluation template here..."
                            value={customEvaluationTemplate}
                            onChange={handleCustomEvaluationTemplateChange}
                            className="font-monospace small"
                          />
                          <Form.Text className="text-muted mt-2">
                            {evaluationTemplate === 'custom' 
                              ? 'Create your own evaluation criteria and format for the Guider agent to follow.' 
                              : 'You can customize the default template to fit your specific meeting requirements.'}
                          </Form.Text>
                        </div>
                      )}
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
                
                {/* WebSocket connection status indicator */}
                <div className="socket-status text-center mb-2">
                  <span className={`badge bg-${CONNECTION_STATUS[socketStatus]?.color || 'secondary'} d-inline-flex align-items-center`}>
                    <i className={`bi bi-${CONNECTION_STATUS[socketStatus]?.icon || 'question-circle'} me-1`}></i>
                    {CONNECTION_STATUS[socketStatus]?.text || 'Unknown Status'}
                  </span>
                </div>
                
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
              
              {/* Connection recovery button */}
              {socketStatus !== 'connected' && (
                <div className="text-center mt-3">
                  <Button 
                    variant="outline-primary" 
                    size="sm"
                    onClick={() => {
                      if (socket) {
                        setSocketStatus('connecting');
                        socket.connect();
                        
                        // Add a status update
                        setProcessingUpdates(prev => [...prev, {
                          id: Date.now(),
                          status: 'info',
                          message: 'Attempting to reconnect to server...',
                          timestamp: new Date().toISOString()
                        }]);
                      }
                    }}
                  >
                    <i className="bi bi-arrow-repeat me-1"></i> Reconnect
                  </Button>
                </div>
              )}
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
              
              <div className="d-flex flex-column align-items-center mt-4">
                <div className="mb-3">
                  {/* Main Download Button */}
                  <Button 
                    variant="primary" 
                    onClick={() => handleDownload('primary')}
                    className="mb-2 d-block"
                    style={{ minWidth: '220px' }}
                  >
                    <i className={`bi ${(result.format === 'pdf') ? 'bi-file-earmark-pdf' : 'bi-file-earmark-word'} me-2`}></i>
                    Download Report ({(result.format || 'DOCX').toUpperCase()})
                  </Button>
                  
                  {/* Alternative Format Download Buttons */}
                  {result.format === 'pdf' && result.docxUrl && (
                    <Button 
                      variant="outline-secondary" 
                      onClick={() => handleDownload('docx')}
                      size="sm"
                      className="d-block mt-2"
                      style={{ minWidth: '220px' }}
                    >
                      <i className="bi bi-file-earmark-word me-2"></i>
                      Download as DOCX
                    </Button>
                  )}
                  
                  {result.format === 'docx' && result.pdfUrl && (
                    <Button 
                      variant="outline-secondary" 
                      onClick={() => handleDownload('pdf')}
                      size="sm"
                      className="d-block mt-2"
                      style={{ minWidth: '220px' }}
                    >
                      <i className="bi bi-file-earmark-pdf me-2"></i>
                      Download as PDF
                    </Button>
                  )}
                  
                  {/* PDF Error Message */}
                  {result.pdfError && (
                    <Alert variant="warning" className="mt-2 text-start" style={{ fontSize: '0.85rem' }}>
                      <i className="bi bi-exclamation-triangle me-2"></i>
                      PDF generation encountered an issue. Only DOCX is available.
                    </Alert>
                  )}
                </div>
                
                <Button 
                  variant="outline-secondary" 
                  className="mt-3" 
                  onClick={handleReset}
                  style={{ minWidth: '220px' }}
                >
                  <i className="bi bi-arrow-repeat me-2"></i>
                  Process Another File
                </Button>
              </div>
            </div>
          )}
          
          {/* Document Q&A Section */}
          {result && !uploading && (
            <div className="mt-4">
              <div className="card mt-4">
                <div className="card-header bg-primary text-white d-flex align-items-center">
                  <i className="bi bi-question-circle me-2"></i>
                  <h5 className="mb-0">Ask Questions About Your Document</h5>
                </div>
                <div className="card-body">
                  <p className="text-muted mb-3">
                    Have questions about your transcribed content? Ask away and our AI will provide answers based on your document.
                  </p>
                  
                  <div className="input-group mb-3">
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Ask a question about your document..."
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      disabled={isAskingQuestion}
                      onKeyPress={(e) => e.key === 'Enter' && handleAskQuestion()}
                    />
                    <button
                      className="btn btn-primary"
                      type="button"
                      onClick={handleAskQuestion}
                      disabled={isAskingQuestion || !question.trim()}
                    >
                      {isAskingQuestion ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                          Processing...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-send me-2"></i>
                          Ask
                        </>
                      )}
                    </button>
                  </div>
                  
                  {/* Q&A Results */}
                  {answers.length > 0 && (
                    <div className="mt-4">
                      <h6 className="mb-3">Answers:</h6>
                      <div className="qa-container">
                        {answers.map((item) => (
                          <div key={item.id} className="card mb-3 border-0 shadow-sm">
                            <div className="card-header bg-light">
                              <div className="d-flex justify-content-between align-items-center">
                                <span><i className="bi bi-question-circle text-primary me-2"></i> {item.question}</span>
                                <small className="text-muted">{new Date(item.timestamp).toLocaleTimeString()}</small>
                              </div>
                            </div>
                            <div className="card-body">
                              <div className="d-flex">
                                <i className="bi bi-robot text-success me-2 mt-1"></i>
                                <div className="answer-text" style={{ whiteSpace: "pre-wrap" }}>
                                  {item.answer}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </Col>
      </Row>
    </Container>
  );
};

export default FileUpload; 