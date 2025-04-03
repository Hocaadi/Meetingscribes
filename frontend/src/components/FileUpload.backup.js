import React, { useState, useRef, useEffect } from 'react';
import { Container, Row, Col, Form, Button, ProgressBar, Alert, Card, ListGroup } from 'react-bootstrap';
import axios from 'axios';
import { saveAs } from 'file-saver';
import config from '../config';
import 'bootstrap-icons/font/bootstrap-icons.css';
import { io } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import TranscriptChat from './TranscriptChat';
import { useUser } from '../contexts/AuthContext';
import PremiumUpgrade from './PremiumUpgrade';
import './FileUpload.css';

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
  // Add refs to prevent dependency cycle in useEffect
  const socketRef = useRef(null);
  const socketStatusRef = useRef('disconnected');
  
  // Add transcript state to store the transcript text
  const [transcript, setTranscript] = useState('');
  const [showChat, setShowChat] = useState(false);
  
  // User related state
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [usageData, setUsageData] = useState(null);
  const { isLoaded, isSignedIn, user } = useUser();
  
  // Fetch user request status on component mount or when user changes
  useEffect(() => {
    if (isLoaded && isSignedIn && user) {
      fetchUserRequestStatus();
    }
  }, [isLoaded, isSignedIn, user]);
  
  // Function to fetch user request status from backend
  const fetchUserRequestStatus = async () => {
    try {
      const response = await axios.get(`${config.API_URL}/api/user/request-status`, {
        headers: {
          'x-user-id': user.id
        }
      });
      
      setUsageData(response.data);
      
      // Show upgrade modal if user has exceeded limit
      if (response.data.upgradeRequired) {
        setShowUpgradeModal(true);
      }
    } catch (error) {
      console.error('Error fetching user request status:', error);
    }
  };
  
  // Clean up all resources when component unmounts
  useEffect(() => {
    return () => {
      console.log('Component unmounting - cleaning up all resources');
      
      // Clean up socket connection
      if (socketRef.current) {
        console.log('Disconnecting socket on component unmount');
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      
      // Clear any pending intervals or timeouts
      reconnectAttemptsRef.current = maxReconnectAttempts; // Prevent reconnection attempts
    };
  }, []); // Empty dependency array means this runs only on mount/unmount
  
  // Initialize WebSocket connection and session ID
  useEffect(() => {
    // Skip reconnecting if we already have a connected socket
    if (socketRef.current && socketRef.current.connected) {
      console.log('Skipping WebSocket initialization - already connected');
      return;
    }

    const connectSocket = () => {
      console.log('Initializing WebSocket connection with session ID:', sessionId);
      
      // Update both state and ref
      setSocketStatus('connecting');
      socketStatusRef.current = 'connecting';
      
      // Connect to WebSocket server
      const socketUrl = config.API_URL;
      const newSocket = io(socketUrl, {
        query: { sessionId },
        reconnection: true,
        reconnectionAttempts: 10,  // Increased from 5 to 10
        reconnectionDelay: 2000,   // Increased from 1000 to 2000
        timeout: 30000,            // Increased from 20000 to 30000
        transports: ['websocket', 'polling'],  // Try websocket first, then fall back to polling
        forceNew: true,            // Force a new connection each time
        autoConnect: true
      });
      
      // Set up event listeners
      newSocket.on('connect', () => {
        console.log('Connected to WebSocket server with socket ID:', newSocket.id);
        setSocketStatus('connected');
        socketStatusRef.current = 'connected';
        reconnectAttemptsRef.current = 0; // Reset counter on successful connection
        
        // Also clear any network error messages on successful connection
        if (error && error.includes('Network error detected')) {
          setError(null);
        }
      });
      
      newSocket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
        setSocketStatus('error');
        socketStatusRef.current = 'error';
        
        // Check for timeout specifically
        if (error.message?.includes('timeout')) {
          console.log('WebSocket connection timed out, will try polling');
          
          // Only show error if we keep failing
          if (reconnectAttemptsRef.current > 2) {
            setError(config.ERROR_MESSAGES.SERVICE_UNAVAILABLE);
          }
        }
        // Show user-friendly error message based on error type
        else if (error.message?.includes('xhr poll error')) {
          setError(config.ERROR_MESSAGES.SERVICE_UNAVAILABLE);
        } else if (error.message?.includes('CORS')) {
          setError(config.ERROR_MESSAGES.CORS_ERROR);
        } else {
          // Don't immediately show network errors, wait for a few reconnection attempts
          if (reconnectAttemptsRef.current > 2) {
            setError(config.ERROR_MESSAGES.NETWORK_ERROR);
          }
        }
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
        
        // Save transcript if it's included in the update
        if (update.transcript) {
          setTranscript(update.transcript);
        }
        
        // Auto-complete when final status is received
        if (update.status === 'completed' || update.message === 'Processing completed successfully') {
          setProgress(100);
          setUploading(false);
          
          // Log all available properties for debugging
          console.log('Completed update with file details:', {
            reportFileName: update.reportFileName,
            docxFileName: update.docxFileName,
            reportPath: update.reportPath,
            reportUrl: update.reportUrl
          });
          
          setResult({
            message: 'Processing completed successfully',
            fileName: update.reportFileName || update.docxFileName || update.fileName || 'meeting_report.docx', 
            reportUrl: update.reportUrl || `/api/download/${update.reportFileName}`,
            format: update.format || (update.reportFileName?.endsWith('.pdf') ? 'pdf' : 'docx'),
            docxUrl: update.docxUrl || `/api/download/${update.docxFileName || update.reportFileName}`,
            pdfUrl: update.pdfUrl,
            primaryUrl: update.primaryUrl,
            transcript: update.transcript,
            // Preserve the raw update data for debugging
            rawUpdate: update
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
        socketStatusRef.current = 'disconnected';
        
        // Don't show errors immediately on disconnect - we'll try to reconnect first
        if (reconnectAttemptsRef.current > 3) {
          setError(prev => prev || config.ERROR_MESSAGES.NETWORK_ERROR);
        }
        
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
          }, 2000 * reconnectAttemptsRef.current); // Increasingly longer delays
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          console.error('Maximum reconnection attempts reached');
          setError(prev => prev || 'Connection lost. Please refresh the page to reconnect.');
        }
      });
      
      // Save socket instance to both state and ref
      setSocket(newSocket);
      socketRef.current = newSocket;
      
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
    
    // Setup heartbeat ping every 15 seconds (reduced from 30) to keep connection alive
    const heartbeatInterval = setInterval(() => {
      // Access the current values from refs instead of state
      const currentSocket = socketRef.current;
      const currentSocketStatus = socketStatusRef.current;
      
      if (currentSocket && currentSocket.connected) {
        currentSocket.emit('ping', { timestamp: new Date().toISOString() });
      } else if (currentSocket && !currentSocket.connected && currentSocketStatus !== 'connecting') {
        // Try to reconnect if socket exists but isn't connected
        console.log('Heartbeat detected disconnected socket, attempting to reconnect...');
        currentSocket.connect();
      }
    }, 15000);
    
    // Clean up on component unmount
    return () => {
      clearInterval(heartbeatInterval);
      cleanup();
    };
  }, [sessionId]); // Remove error from dependencies to prevent reconnection cycles

  // Add upload progress monitoring to detect stalled uploads
  useEffect(() => {
    let progressTimer;
    let lastProgress = 0;
    let stalledTime = 0;
    
    if (uploading && progress > 0 && progress < 100) {
      progressTimer = setInterval(() => {
        // Check if progress has changed in the last 30 seconds
        if (progress === lastProgress) {
          stalledTime += 5000;
          
          // After 60 seconds with no progress, warn the user
          if (stalledTime === 60000) {
            setProcessingUpdates(prev => [...prev, {
              id: Date.now(),
              status: 'warning',
              message: 'Upload seems to be slow',
              details: 'The upload has not progressed for 60 seconds. This may be due to network issues or server load.',
              timestamp: new Date().toISOString()
            }]);
          }
        } else {
          // Reset stalled time if progress changed
          stalledTime = 0;
          lastProgress = progress;
        }
      }, 5000); // Check every 5 seconds
    }
    
    return () => {
      if (progressTimer) clearInterval(progressTimer);
    };
  }, [uploading, progress]);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      
      // Check if file is an audio file
      if (!selectedFile.type.startsWith('audio/')) {
        setError('Please upload an audio file (MP3, WAV, etc.)');
        return;
      }
      
      // Check file size (max 100MB)
      if (selectedFile.size > config.MAX_FILE_SIZE) {
        setError('File size exceeds 100MB limit');
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
      
      // Check file size (max 100MB)
      if (droppedFile.size > config.MAX_FILE_SIZE) {
        setError('File size exceeds 100MB limit');
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
    
    // If user is not signed in, show error
    if (!isSignedIn) {
      setError('Please sign in to use this feature');
      return;
    }
    
    // Check if user has exceeded free tier limit
    if (usageData?.upgradeRequired) {
      setShowUpgradeModal(true);
      return;
    }
    
    try {
      setError(null);
      setUploading(true);
      setProgress(0);
      setProcessingUpdates([]); // Clear previous updates
      
      // Add a check for backend availability
      try {
        // Make a preflight request to check if the backend is available
        const healthCheck = await axios.get(`${config.API_URL}/api/health`, { 
          timeout: 10000, // 10 second timeout
          retry: 3,      // Retry 3 times
          retryDelay: 1000 // 1 second between retries
        });
        console.log('Backend health check:', healthCheck.data);
      } catch (healthError) {
        console.error('Backend health check failed:', healthError);
        
        if (healthError.response?.status === 503) {
          throw new Error(config.ERROR_MESSAGES.SERVICE_UNAVAILABLE);
        } else if (healthError.message?.includes('Network Error')) {
          // Add a message about possible backend sleep
          setProcessingUpdates(prev => [...prev, {
            id: Date.now(),
            status: 'warning',
            message: 'Waking up the server...',
            details: 'Our server may be in sleep mode. This is normal for free-tier hosting. It may take 30-60 seconds to wake up.',
            timestamp: new Date().toISOString()
          }]);
          
          // Don't throw error immediately - we'll still try the upload
          console.log('Server may be in sleep mode - continuing with upload attempt');
        }
      }
      
      // Check socket connection and update UI accordingly
      const isSocketConnected = socketRef.current && socketRef.current.connected;
      if (!isSocketConnected) {
        console.warn('WebSocket not connected. Will use polling fallback for updates.');
        // Add a processing update to inform user
        setProcessingUpdates(prev => [...prev, {
          id: Date.now(),
          status: 'warning',
          message: 'WebSocket connection not available. Progress updates may be delayed.',
          timestamp: new Date().toISOString()
        }]);
        
        // Try to reconnect socket
        if (socketRef.current) {
          socketRef.current.connect();
        }
      } else {
        // Add a processing update to indicate WebSocket is working
        setProcessingUpdates(prev => [...prev, {
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
      
      // Add user ID for request tracking
      const headers = {
        'Content-Type': 'multipart/form-data',
        'x-user-id': user.id
      };
      
      console.log('Starting file upload with WebSocket status:', socketStatus);
      
      // Implement upload with automatic retry logic for network errors
      let uploadAttempt = 0;
      const maxUploadAttempts = 3;
      let uploadResponse = null;
      
      while (uploadAttempt < maxUploadAttempts && !uploadResponse) {
        try {
          uploadAttempt++;
          
          if (uploadAttempt > 1) {
            // Notify user of retry
            setProcessingUpdates(prev => [...prev, {
              id: Date.now(),
              status: 'info',
              message: `Retrying upload (attempt ${uploadAttempt}/${maxUploadAttempts})...`,
              timestamp: new Date().toISOString()
            }]);
          }
          
          uploadResponse = await axios.post(config.UPLOAD_ENDPOINT, formData, {
            headers: headers,
            onUploadProgress: (progressEvent) => {
              // Only show progress up to 50% as the processing will take the remaining time
              const percentCompleted = Math.round((progressEvent.loaded * 50) / progressEvent.total);
              setProgress(percentCompleted);
            },
            // Increase timeout for large files
            timeout: 600000 // 10 minutes
          });
        } catch (uploadError) {
          console.error(`Upload attempt ${uploadAttempt} failed:`, uploadError);
          
          // If it's the last attempt, rethrow the error
          if (uploadAttempt >= maxUploadAttempts) {
            throw uploadError;
          }
          
          // For network errors, wait a bit before retrying
          if (uploadError.message?.includes('Network Error')) {
            await new Promise(resolve => setTimeout(resolve, 3000 * uploadAttempt));
          } else {
            // For non-network errors (like 4xx/5xx), don't retry
            throw uploadError;
          }
        }
      }
      
      // At this point we have a successful response
      const response = uploadResponse;
      
      console.log('Upload completed successfully, response:', response.data);
      
      // Update usage data if returned in response
      if (response.data.requestInfo) {
        setUsageData(response.data.requestInfo);
        
        // Show upgrade modal if user has used all free requests
        if (response.data.requestInfo.remaining <= 0) {
          setTimeout(() => {
            setShowUpgradeModal(true);
          }, 1000); // Show after a short delay
        }
      }
      
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
          format: 'docx',
          docxUrl: response.data.docxUrl
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
      
      // Handle timeout errors specifically
      if (error.code === 'ECONNABORTED' && error.message && error.message.includes('timeout')) {
        setError(config.ERROR_MESSAGES.TIMEOUT);
        
        // Add specific timeout error to processing updates
        setProcessingUpdates(prev => [...prev, {
          id: Date.now(),
          status: 'error',
          message: 'Upload timeout',
          details: 'The server took too long to respond. This can happen with larger files on our free tier servers.',
          timestamp: new Date().toISOString(),
          code: 'TIMEOUT'
        }]);
        
        setUploading(false);
        setProgress(0);
        return;
      }
      
      // Check if error is due to free tier limit
      if (error.response?.status === 403 && error.response?.data?.upgradeRequired) {
        setError('You have reached your free tier limit');
        setShowUpgradeModal(true);
        return;
      }
      
      // More detailed error messaging based on the server response
      let errorMessage = 'Error processing file';
      let errorDetails = '';
      
      if (error.response?.data) {
        const errorData = error.response.data;
        errorMessage = errorData.error || errorMessage;
        errorDetails = errorData.details || '';
        
        // Handle specific error types
        if (errorData.apiKeyStatus === 'invalid') {
          errorMessage = 'OpenAI API key error: ' + errorDetails;
          errorDetails = errorData.solution || 'Please contact support to fix this issue.';
        } else if (errorData.apiKeyStatus === 'quota_exceeded') {
          errorMessage = 'OpenAI API quota exceeded';
          errorDetails = 'Your account has reached its API usage limits. ' + (errorData.solution || 'Please check your OpenAI account billing details.');
        }
      }
      
      // Network specific errors with better handling
      if (error.message?.includes('Network Error')) {
        // Instead of preventing the user from trying, just show a warning
        setError(config.ERROR_MESSAGES.NETWORK_ERROR);
        
        setProcessingUpdates(prev => [...prev, {
          id: Date.now(),
          status: 'warning',
          message: 'Network connection issue',
          details: 'Please check your internet connection. If your connection is stable, our server might be temporarily unavailable.',
          timestamp: new Date().toISOString()
        }]);
        
        // Add a "retry" button hint
        setProcessingUpdates(prev => [...prev, {
          id: Date.now(),
          status: 'info',
          message: 'You can refresh the page and try again in 1-2 minutes.',
          timestamp: new Date().toISOString()
        }]);
      }
      // More specific error messages for common issues
      else if (error.message?.includes('Service Unavailable') || error.response?.status === 503) {
        setError(config.ERROR_MESSAGES.SERVICE_UNAVAILABLE);
        
        // Add a more detailed explanation in the processing updates
        setProcessingUpdates(prev => [...prev, {
          id: Date.now(),
          status: 'info',
          message: 'Free tier services sleep after inactivity',
          details: 'Our server uses Render free tier which goes to sleep after 15 minutes of inactivity. It takes 30-60 seconds to wake up.',
          timestamp: new Date().toISOString()
        }]);
      } else {
        // Original error handling
        setError(`${errorMessage}${errorDetails ? `: ${errorDetails}` : ''}`);
      }
      
      setUploading(false);
      setProgress(0);
      
      // Add error to processing updates with more context
      setProcessingUpdates(prev => [...prev, {
        id: Date.now(),
        status: 'error',
        message: errorMessage,
        details: errorDetails || error.message,
        timestamp: new Date().toISOString(),
        code: error.response?.status || 'UNKNOWN'
      }]);
      
      // Display troubleshooting information in the console for developers
      console.log('Troubleshooting information:');
      console.log('- Check if the backend server is running');
      console.log('- Verify OpenAI API key is valid');
      console.log('- Check audio file format and size');
      console.log('- Review server logs for detailed error information');
    }
  };

  const handleDownload = () => {
    if (!result) return;
    
    console.log('Download initiated with result:', result);
    
    // Get the document URL and correct filename from the result
    // Try multiple properties to find a valid URL and filename
    const downloadUrl = result.docxUrl || result.reportUrl || result.primaryUrl || '';
    const filename = result.fileName || result.reportFileName || result.docxFileName || 'meeting_report.docx';
    
    console.log(`Initiating download: ${downloadUrl}, filename: ${filename}`);
    
    // Check if we have a valid downloadUrl, if not try to construct one
    let finalUrl = downloadUrl;
    if (!downloadUrl || downloadUrl.includes('undefined')) {
      console.log('Invalid download URL detected, attempting to create one from filename');
      
      if (filename && filename !== 'undefined') {
        finalUrl = `/api/download/${filename}`;
        console.log(`Created download URL from filename: ${finalUrl}`);
      } else {
        setError('Unable to download file: Missing filename information');
        console.error('Missing filename information for download');
        return;
      }
    }
    
    // Always use the explicit backend URL in production
    const backendUrl = config.API_URL || 'https://meetingscribe-backend.onrender.com';
    
    // Ensure URL starts with API path if it's a relative URL
    if (finalUrl && !finalUrl.startsWith('http')) {
      // Format the URL path properly
      let urlPath = finalUrl;
      if (!urlPath.startsWith('/')) {
        urlPath = `/${urlPath}`;
      }
      
      // In production, always use the explicit backend URL
      finalUrl = `${backendUrl}${urlPath}`;
    }
    
    console.log(`Final download URL: ${finalUrl}`);
    
    if (finalUrl) {
      try {
        // Show in-progress message to user
        setError(null);
        setProcessingUpdates(prev => [...prev, {
          id: Date.now(),
          status: 'info',
          message: 'Downloading file...',
          details: `Attempting to download ${filename}`,
          timestamp: new Date().toISOString()
        }]);
        
        // Declare serverFilename in a higher scope
        let serverFilename = filename;
        
        // Create a fetch request to handle as blob
        fetch(finalUrl)
          .then(response => {
            if (!response.ok) {
              console.error(`Download response error: Status ${response.status}`);
              
              // Special handling for 404 errors
              if (response.status === 404) {
                // Try alternative URLs
                const alternativeUrl = `${backendUrl}/download/${filename}`;
                console.log(`Trying alternative URL: ${alternativeUrl}`);
                
                setProcessingUpdates(prev => [...prev, {
                  id: Date.now(),
                  status: 'warning',
                  message: 'File not found at primary URL, trying alternative...',
                  timestamp: new Date().toISOString()
                }]);
                
                return fetch(alternativeUrl);
              }
              
              throw new Error(`HTTP error! Status: ${response.status}`);
            }
            
            return response;
          })
          .then(response => {
            if (!response.ok) {
              throw new Error(`HTTP error! Status: ${response.status}`);
            }
            
            // Log headers for debugging
            const headers = {};
            response.headers.forEach((value, key) => {
              headers[key] = value;
            });
            console.log('Response headers:', headers);
            
            // Get filename from Content-Disposition header if available
            const contentDisposition = response.headers.get('Content-Disposition');
            if (contentDisposition) {
              const filenameMatch = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
              if (filenameMatch && filenameMatch[1]) {
                serverFilename = filenameMatch[1].replace(/['"]/g, '');
                console.log(`Server provided filename: ${serverFilename}`);
              }
            }
            
            return response.blob();
          })
          .then(blob => {
            console.log(`Blob received: ${blob.size} bytes, type: ${blob.type}`);
            
            // Add success message
            setProcessingUpdates(prev => [...prev, {
              id: Date.now(),
              status: 'success',
              message: 'File downloaded successfully',
              timestamp: new Date().toISOString()
            }]);
            
            // Force correct mime type for DOCX
            const docxBlob = new Blob([blob], {
              type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            });
            
            // Create object URL and trigger download
            const blobUrl = window.URL.createObjectURL(docxBlob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.setAttribute('download', serverFilename);
            document.body.appendChild(link);
            link.click();
            
            // Clean up
            setTimeout(() => {
              window.URL.revokeObjectURL(blobUrl);
              document.body.removeChild(link);
            }, 100);
          })
          .catch(error => {
            console.error('Download error:', error);
            setError(`Error downloading file: ${error.message}`);
            
            // Show detailed error and recovery options
            setProcessingUpdates(prev => [...prev, {
              id: Date.now(),
              status: 'error',
              message: 'Download failed',
              details: `Error: ${error.message}. Please try refreshing the page or contact support if the issue persists.`,
              timestamp: new Date().toISOString()
            }]);
          });
      } catch (error) {
        console.error('Download error:', error);
        setError('Error initiating download. Please try again.');
      }
    } else {
      setError('No download URL available');
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

  // Add a handler to toggle the chat interface
  const toggleChat = () => {
    setShowChat(!showChat);
  };

  return (
    <div className="dashboard-container">
      <Container className="upload-container">
        <div className="dashboard-header">
          <h1>Meeting Dashboard</h1>
          <p>Upload your meeting recordings for AI-powered transcription and analysis</p>
        </div>
        
        {showUpgradeModal && (
          <PremiumUpgrade 
            usageData={usageData} 
            onClose={() => setShowUpgradeModal(false)} 
          />
        )}
        
        {!showUpgradeModal && (
          <Row className="justify-content-center">
            <Col lg={10}>
              {isLoaded && isSignedIn && usageData && (
                <div className="usage-tracker">
                  <p>
                    <strong>Usage:</strong> {usageData.used} of {usageData.limit} free requests used
                    {usageData.remaining > 0 ? 
                      ` (${usageData.remaining} remaining)` : 
                      ' - Upgrade to Premium for unlimited processing'}
                  </p>
                </div>
              )}
              
              {error && (
                <Alert variant="danger" onClose={() => setError(null)} dismissible>
                  {error}
                </Alert>
              )}
              
              {!result && !uploading && (
                <>
                  <div className="upload-card">
                    <div 
                      className={`upload-box ${dragActive ? 'active' : ''}`}
                      onDragEnter={handleDrag}
                      onDragOver={handleDrag}
                      onDragLeave={handleDrag}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current.click()}
                    >
                      <i className="bi bi-cloud-arrow-up"></i>
                      <h3>Upload Audio File</h3>
                      <p className="text-muted">
                        Drag & drop your audio file here, or click to browse
                      </p>
                      <p className="text-muted small">
                        Supported formats: MP3, WAV, M4A, FLAC, etc. (Max 100MB)
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
                      <div className="file-info">
                        <p className="mb-1"><strong>Selected File:</strong> {file.name}</p>
                        <p className="mb-0"><strong>Size:</strong> {(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                      </div>
                    )}
                  </div>
                  
                  <Card className="option-card">
                    <Card.Header className="option-card-header">
                      <div>
                        <i className="bi bi-tag header-icon" style={{ color: '#4a86e8' }}></i>
                        <span className="option-card-title">Meeting Topic</span>
                      </div>
                    </Card.Header>
                    <Card.Body className="option-card-body">
                      <Form.Group>
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
                  
                  <Card className="option-card">
                    <Card.Header 
                      className="option-card-header"
                      onClick={toggleCustomInstructions}
                    >
                      <div>
                        <i className="bi bi-lightbulb header-icon" style={{ color: '#ffc107' }}></i>
                        <span className="option-card-title">Custom Analysis Instructions</span>
                      </div>
                      <i className={`bi ${showCustomInstructions ? 'bi-chevron-up' : 'bi-chevron-down'}`}></i>
                    </Card.Header>
                    
                    {showCustomInstructions && (
                      <Card.Body className="option-card-body">
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
                  
                  <Card className="option-card">
                    <Card.Header 
                      className="option-card-header"
                      onClick={toggleEvaluationOptions}
                    >
                      <div>
                        <i className="bi bi-file-earmark-text header-icon" style={{ color: '#ffc107' }}></i>
                        <span className="option-card-title">Evaluation Template</span>
                      </div>
                      <i className={`bi ${showEvaluationOptions ? 'bi-chevron-up' : 'bi-chevron-down'}`}></i>
                    </Card.Header>
                    
                    {showEvaluationOptions && (
                      <Card.Body className="option-card-body">
                        <Form.Group>
                          <Form.Select 
                            value={evaluationTemplate}
                            onChange={handleEvaluationTemplateChange}
                          >
                            {EVALUATION_TEMPLATES.map(template => (
                              <option key={template.value} value={template.value}>
                                {template.label}
                              </option>
                            ))}
                          </Form.Select>
                          <Form.Text className="text-muted">
                            Select an evaluation template to enhance the AI analysis of your meeting transcript.
                          </Form.Text>
                        </Form.Group>
                      </Card.Body>
                    )}
                  </Card>
                </>
              )}
            </Col>
          </Row>
        )}
      </Container>
    </div>
  );
};

export default FileUpload;