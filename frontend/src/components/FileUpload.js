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

// Add these constants at the top of the file, after other constants
const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
const MAX_CHUNK_RETRIES = 3;

const FileUpload = () => {
  // States for file upload
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
  const [sessionId, setSessionId] = useState(() => {
    // Try to get existing session ID from localStorage
    const savedSessionId = localStorage.getItem('sessionId');
    return savedSessionId || uuidv4();
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
  
  // Debug - log component state on init
  useEffect(() => {
    console.log('Dashboard component initialized');
    
    // Reset any potentially problematic state
    if (document.querySelector('.dashboard-container') === null) {
      console.error('Dashboard container not found in the DOM');
    }
    
    if (document.querySelector('.upload-box') === null) {
      console.error('Upload box not found in the DOM');
    }
    
    // Force rendering of UI elements if they've been hidden
    const forceRerender = () => {
      setShowCustomInstructions(false);
      setShowEvaluationOptions(false);
      
      // Reset any CSS issues
      const dashboard = document.querySelector('.dashboard-container');
      if (dashboard) {
        dashboard.style.display = 'block';
        dashboard.style.visibility = 'visible';
        dashboard.style.opacity = '1';
      }
      
      const uploadBox = document.querySelector('.upload-box');
      if (uploadBox) {
        uploadBox.style.display = 'flex';
        uploadBox.style.visibility = 'visible';
      }
      
      const optionCards = document.querySelectorAll('.option-card');
      optionCards.forEach(card => {
        card.style.display = 'block';
        card.style.visibility = 'visible';
      });
    };
    
    // Call force rerender once
    forceRerender();
    
    // Schedule it to run again after a slight delay in case of async rendering issues
    const timeout = setTimeout(forceRerender, 50000);
    return () => clearTimeout(timeout);
  }, []);
  
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
  
  // Helper function to set up socket connection
  const connectSocket = () => {
    // Update both state and ref
    setSocketStatus('connecting');
    socketStatusRef.current = 'connecting';
    
    // Set up a reconnect counter
    let reconnectCount = 0;
    const maxReconnects = 5;
    
    // Track which config we're using
    let currentConfigIndex = 0;
    
    // Function to attempt socket connection with different strategies
    const attemptConnection = (configIndex = 0) => {
      try {
        // Get the current connection config to try
        const currentConfig = configIndex === 0 ? 
          config.SOCKET_CONFIG : 
          config.SOCKET_FALLBACK_CONFIGS[configIndex - 1] || config.SOCKET_CONFIG;
        
        console.log(`Attempting socket connection with config #${configIndex}:`, currentConfig);
        
        // Add session ID to the config
        const socketOptions = {
          ...currentConfig,
          query: { sessionId }
        };
        
        // Try different API URLs if needed
        let apiUrl = config.API_URL;
        if (configIndex > 2 && config.BACKUP_API_URLS.length > 0) {
          // Try backup URLs for later attempts
          const backupIndex = Math.min(configIndex - 3, config.BACKUP_API_URLS.length - 1);
          apiUrl = config.BACKUP_API_URLS[backupIndex];
          console.log(`Trying backup API URL: ${apiUrl}`);
        }
        
        // Try with proxy as last resort
        if (configIndex > config.SOCKET_FALLBACK_CONFIGS.length + 2) {
          apiUrl = config.getProxyUrl(apiUrl);
          console.log(`Trying with CORS proxy: ${apiUrl}`);
        }
        
        const newSocket = io(apiUrl, socketOptions);
        
        // Set up connection error handler
        newSocket.on('connect_error', (error) => {
          console.error('WebSocket connection error:', error);
          reconnectCount++;
          
          if (reconnectCount >= maxReconnects) {
            console.log('Max reconnect attempts reached with current config');
            
            // Try next configuration approach
            currentConfigIndex++;
            
            // If we've tried all configs, fall back to HTTP polling
            if (currentConfigIndex > config.SOCKET_FALLBACK_CONFIGS.length + 3) {
              console.log('All connection strategies failed, falling back to HTTP polling');
              setSocketStatus('error');
              socketStatusRef.current = 'error';
              setupPollingFallback();
              
              // Suppress further reconnection attempts
              newSocket.io.reconnection(false);
              return;
            }
            
            // Try the next configuration
            console.log(`Trying connection config #${currentConfigIndex}`);
            newSocket.disconnect();
            reconnectCount = 0;
            return attemptConnection(currentConfigIndex);
          }
        });
        
        // Set up successful connection handler
        newSocket.on('connect', () => {
          console.log('WebSocket connected successfully:', newSocket.id);
          setSocketStatus('connected');
          socketStatusRef.current = 'connected';
          reconnectCount = 0; // Reset counter on successful connection
          
          // Setup all the standard socket event handlers
          setupSocketEvents(newSocket);
        });
        
        // Set up disconnect handler
        newSocket.on('disconnect', (reason) => {
          console.log('WebSocket disconnected, reason:', reason);
          setSocketStatus('disconnected');
          socketStatusRef.current = 'disconnected';
        });
        
        // Set up server error handler
        newSocket.on('server_error', (data) => {
          console.error('Server reported an error:', data);
          setProcessingUpdates(prev => [...prev, {
            id: Date.now(),
            status: 'error',
            message: `Server error: ${data.message || 'Unknown error'}`,
            details: data.details,
            timestamp: new Date().toISOString()
          }]);
        });
        
        // Save socket instance to both state and ref
        setSocket(newSocket);
        socketRef.current = newSocket;
        
        return () => {
          if (newSocket) {
            newSocket.disconnect();
          }
        };
      } catch (error) {
        console.error('Error creating socket:', error);
        
        // Try next configuration approach if available
        currentConfigIndex++;
        if (currentConfigIndex <= config.SOCKET_FALLBACK_CONFIGS.length + 3) {
          console.log(`Trying connection config #${currentConfigIndex} after error`);
          reconnectCount = 0;
          return attemptConnection(currentConfigIndex);
        }
        
        // Fall back to polling if all socket attempts fail
        setupPollingFallback();
        return () => {};
      }
    };
    
    // Helper function to set up polling as fallback
    const setupPollingFallback = () => {
      console.log('Setting up HTTP polling fallback for updates');
      setProcessingUpdates(prev => [...prev, {
        id: Date.now(),
        status: 'info',
        message: 'WebSocket connection failed. Using HTTP polling for updates.',
        timestamp: new Date().toISOString()
      }]);
      
      // Start polling for updates
      startStatusPolling();
    };
    
    // Function to start polling for status updates
    const startStatusPolling = () => {
      // Clear any existing polling
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      
      // Set up new polling interval
      const interval = setInterval(() => {
        if (!uploading) {
          // Stop polling if no longer uploading
          clearInterval(interval);
          return;
        }
        
        // Poll for status
        axios.get(`${config.API_URL}/api/status?sessionId=${sessionId}`, {
          headers: {
            'x-user-id': user?.id || '',
            'x-session-id': sessionId
          },
          withCredentials: true,
          timeout: 1000000
        })
        .then(response => {
          if (response.data) {
            console.log('Received status update via polling:', response.data);
            handleProcessingUpdate(response.data);
          }
        })
        .catch(error => {
          console.error('Error polling for status:', error);
        });
      }, 10000); // Poll every 10 seconds
      
      // Save reference to interval
      pollingIntervalRef.current = interval;
    };
    
    // Start with the preferred connection method
    return attemptConnection(0);
  };

  // Helper function to set up socket event listeners
  const setupSocketEvents = (socket) => {
    socket.on('connect', () => {
      console.log('Connected to WebSocket server with socket ID:', socket.id);
      setSocketStatus('connected');
      socketStatusRef.current = 'connected';
      reconnectAttemptsRef.current = 0;
      
      // Clear any network error messages on successful connection
      if (error && error.includes('Network error detected')) {
        setError(null);
      }
      
      setProcessingUpdates(prev => [...prev, {
        id: Date.now(),
        status: 'success',
        message: 'Real-time connection established',
        timestamp: new Date().toISOString()
      }]);
    });
    
    socket.on('processing_update', (update) => {
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
    
    socket.on('disconnect', (reason) => {
      console.log('Disconnected from WebSocket server:', reason);
      setSocketStatus('disconnected');
      socketStatusRef.current = 'disconnected';
      
      // Add a message about the disconnection
      setProcessingUpdates(prev => [...prev, {
        id: Date.now(),
        status: 'warning',
        message: 'Real-time connection lost',
        details: 'Attempting to reconnect. Processing will continue in the background.',
        timestamp: new Date().toISOString()
      }]);
      
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
          if (socket && !socket.connected) {
            console.log('Reconnecting...');
            socket.connect();
            
            // Add a message about reconnection attempt
            setProcessingUpdates(prev => [...prev, {
              id: Date.now(),
              status: 'info',
              message: `Reconnection attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts}`,
              timestamp: new Date().toISOString()
            }]);
          }
        }, 2000 * reconnectAttemptsRef.current); // Increasingly longer delays
      } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
        console.error('Maximum reconnection attempts reached');
        setError(prev => prev || 'Connection lost. Please refresh the page to reconnect.');

        // Add fallback polling mechanism when WebSockets completely fail
        setProcessingUpdates(prev => [...prev, {
          id: Date.now(),
          status: 'info',
          message: 'Switching to alternative update method',
          details: 'Real-time connection failed. Using polling for updates instead.',
          timestamp: new Date().toISOString()
        }]);
        
        // Set up polling for updates
        const pollInterval = setInterval(() => {
          // Only poll if we're still in uploading state
          if (uploading) {
            console.log('Polling for file processing status...');
            
            // Try to get update via HTTP request instead of WebSocket
            axios.get(`${config.API_URL}/api/status?sessionId=${sessionId}`, {
              headers: {
                'x-user-id': user?.id || '',
                'x-session-id': sessionId
              },
              timeout: 1000000
            })
            .then(response => {
              if (response.data) {
                // Handle the update data
                const update = response.data;
                console.log('Received update via polling:', update);
                
                // Add the update to our list
                setProcessingUpdates(prev => [...prev, {
                  ...update,
                  id: Date.now(),
                  pollingUpdate: true
                }]);
                
                // Process completion status
                if (update.status === 'completed') {
                  setProgress(100);
                  setUploading(false);
                  setResult({
                    message: 'Processing completed successfully',
                    fileName: update.reportFileName || update.fileName || 'meeting_report.docx',
                    reportUrl: update.reportUrl || `/api/download/${update.reportFileName}`,
                    format: update.format || 'docx',
                    transcript: update.transcript
                  });
                  
                  // Clear polling interval when complete
                  clearInterval(pollInterval);
                }
              }
            })
            .catch(error => {
              console.error('Error polling for updates:', error);
            });
          } else {
            // Clear interval if we're no longer uploading
            clearInterval(pollInterval);
          }
        }, 10000); // Poll every 10 seconds
        
        // Make sure to clean up the interval
        return () => {
          clearInterval(pollInterval);
        };
      }
    });
  };

  // Add upload progress monitoring to detect stalled uploads
  useEffect(() => {
    let progressTimer;
    let lastProgress = 0;
    let stalledTime = 0;
    
    if (uploading && progress > 0 && progress < 100) {
      progressTimer = setInterval(() => {
        // Check if progress has changed in the last 30 seconds
        if (progress === lastProgress) {
          stalledTime += 500000;
          
          // After 60 seconds with no progress, warn the user
          if (stalledTime === 6000000) {
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

  // Utility function to format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Helper function to calculate overall progress from chunk data
  const calculateOverallProgress = (chunks) => {
    if (!chunks.length) return 0;
    
    // Sum up progress across all chunks
    const totalProgress = chunks.reduce((sum, chunk) => sum + (chunk.progress || 0), 0);
    // Average progress (0-100)
    return totalProgress / chunks.length;
  };

  // Upload file chunk with multiple fallback strategies for CORS issues
  const uploadChunk = async (chunkIndex, totalChunks, fileId, commonFormData, headers, uploadedChunks, strategyIndex = 0) => {
    // Get the appropriate strategy based on the current index
    const strategies = config.UPLOAD_CONFIG.FALLBACK_STRATEGIES;
    const strategy = strategies[strategyIndex] || strategies[0];
    
    console.log(`Uploading chunk ${chunkIndex + 1}/${totalChunks} (strategy ${strategyIndex + 1}, attempt ${uploadedChunks[chunkIndex].attempts})`);
    
    try {
      // Prepare URL - use proxy if specified in the strategy
      let uploadUrl = `${config.API_URL}/api/upload/chunk`;
      if (strategy.useProxy) {
        uploadUrl = config.getProxyUrl(uploadUrl);
        console.log(`Using CORS proxy for upload: ${uploadUrl}`);
      }
      
      // Prepare form data with chunk info
      const formData = new FormData();
      
      // Add common form data
      for (const [key, value] of Object.entries(commonFormData)) {
        formData.append(key, value);
      }
      
      // Add chunk-specific data
      formData.append('chunkIndex', chunkIndex);
      formData.append('totalChunks', totalChunks);
      formData.append('fileId', fileId);
      formData.append('chunk', uploadedChunks[chunkIndex].data);
      
      // Configure request headers based on strategy
      const requestConfig = {
        headers: { ...headers },
        withCredentials: strategy.withCredentials,
        timeout: config.UPLOAD_TIMEOUT,
        onUploadProgress: (progressEvent) => {
          // Calculate progress for this chunk
          const chunkProgress = (progressEvent.loaded / progressEvent.total) * 100;
          
          // Update progress for this specific chunk
          const updatedChunks = [...uploadedChunks];
          updatedChunks[chunkIndex].progress = chunkProgress;
          setUploadedChunks(updatedChunks);
          
          // Calculate overall progress (up to 50% - the rest is for processing)
          const overallProgress = calculateOverallProgress(updatedChunks) / 2;
          setProgress(overallProgress);
        }
      };
      
      // If strategy indicates to exclude Content-Type header, delete it
      // This can help with certain CORS configurations
      if (!strategy.includeContentType) {
        delete requestConfig.headers['Content-Type'];
      }
      
      // Send the upload request
      const response = await axios.post(uploadUrl, formData, requestConfig);
      
      // Mark this chunk as uploaded
      const updatedChunks = [...uploadedChunks];
      updatedChunks[chunkIndex].uploaded = true;
      updatedChunks[chunkIndex].progress = 100;
      setUploadedChunks(updatedChunks);
      
      console.log(`Chunk ${chunkIndex + 1}/${totalChunks} uploaded successfully`);
      
      // Return response data
      return response.data;
    } catch (error) {
      console.error(`Error uploading chunk ${chunkIndex + 1}/${totalChunks}:`, error);
      
      // Track the attempt
      const updatedChunks = [...uploadedChunks];
      updatedChunks[chunkIndex].attempts += 1;
      setUploadedChunks(updatedChunks);
      
      // Check if it's a CORS error
      const isCors = config.isCorsError(error);
      
      // If it's a CORS error or 502, try the next strategy if available
      if ((isCors || error?.response?.status === 502) && strategyIndex < strategies.length - 1) {
        console.log(`CORS or server error detected. Trying next upload strategy (${strategyIndex + 2}/${strategies.length})`);
        
        setProcessingUpdates(prev => [...prev, {
          id: Date.now(),
          status: 'warning',
          message: config.ERROR_MESSAGES.CORS_ISSUE,
          timestamp: new Date().toISOString()
        }]);
        
        // Add a small delay before retrying with the next strategy
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Try the next strategy
        return uploadChunk(chunkIndex, totalChunks, fileId, commonFormData, headers, uploadedChunks, strategyIndex + 1);
      }
      
      // For server errors, add retry delay
      if (error?.response?.status >= 500) {
        console.log('Server error. Adding delay before retry...');
        await new Promise(resolve => setTimeout(resolve, config.UPLOAD_CONFIG.RETRY_DELAY));
      }
      
      // If we've exceeded retry attempts, throw the error
      if (uploadedChunks[chunkIndex].attempts >= config.UPLOAD_CONFIG.MAX_RETRIES) {
        throw error;
      }
      
      // Otherwise, retry with the same strategy
      console.log(`Retrying chunk ${chunkIndex + 1}/${totalChunks} (attempt ${uploadedChunks[chunkIndex].attempts + 1}/${config.UPLOAD_CONFIG.MAX_RETRIES})`);
      
      setProcessingUpdates(prev => [...prev, {
        id: Date.now(),
        status: 'info',
        message: config.ERROR_MESSAGES.UPLOAD_RETRY,
        timestamp: new Date().toISOString()
      }]);
      
      // Add a delay before retrying
      await new Promise(resolve => setTimeout(resolve, config.UPLOAD_CONFIG.RETRY_DELAY));
      
      // Retry with the same strategy
      return uploadChunk(chunkIndex, totalChunks, fileId, commonFormData, headers, uploadedChunks, strategyIndex);
    }
  };

  // Handle the main file upload process
  const handleUpload = async () => {
    try {
      if (!file) {
        setError('Please select a file to upload.');
        return;
      }
      
      // Reset any previous state
      setError(null);
      setUploading(true);
      setProgress(0);
      setResult(null);
      setProcessingUpdates([]);
      
      // Create a unique session ID for this upload
      const newSessionId = uuidv4();
      setSessionId(newSessionId);
      
      // Initialize WebSocket connection with the session ID
      // This will allow us to receive processing updates
      const cleanup = connectSocket();
      
      // Generate a unique file ID for tracking chunks
      const fileId = uuidv4();
      
      // Prepare file for chunked upload 
      const chunkSize = config.UPLOAD_CONFIG.CHUNK_SIZE;
      const totalChunks = Math.ceil(file.size / chunkSize);
      
      console.log(`Preparing to upload file in ${totalChunks} chunks`);
      
      // Initialize chunks with their data slices
      const chunks = [];
      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(file.size, start + chunkSize);
        chunks.push({
          index: i,
          data: file.slice(start, end),
          uploaded: false,
          attempts: 0,
          progress: 0
        });
      }
      setUploadedChunks(chunks);
      
      // Common data for all chunk requests
      const commonFormData = {
        totalChunks: totalChunks,
        fileId: fileId,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        sessionId: newSessionId,
        userId: user?.id || '',
        meetingTopic: meetingTopic || '',
        customInstructions: customInstructions || '',
        evaluationTemplate: evaluationTemplate || '',
        customEvaluationTemplate: customEvaluationTemplate || ''
      };
      
      // Common headers for all requests
      const headers = {
        'x-user-id': user?.id || '',
        'x-session-id': newSessionId
      };
      
      console.log('Starting chunked upload with session ID:', newSessionId);
      
      // Log initial upload state
      setProcessingUpdates(prev => [...prev, {
        id: Date.now(),
        status: 'info',
        message: `Starting upload of ${file.name} (${formatFileSize(file.size)}) in ${totalChunks} chunks`,
        timestamp: new Date().toISOString()
      }]);
      
      // Upload each chunk in parallel with limits
      const results = await Promise.allSettled(
        // Create a limited number of concurrent uploads
        // For large numbers of chunks, we'll process them in smaller batches
        chunks.map(async (chunk, index) => {
          // Add a small delay for consecutive chunks to prevent overwhelming the server
          await new Promise(resolve => setTimeout(resolve, index * 300));
          
          // Upload the chunk with all our retry and fallback logic
          return uploadChunk(index, totalChunks, fileId, commonFormData, headers, chunks);
        })
      );
      
      // Check if all uploads were successful
      const allSuccessful = results.every(result => result.status === 'fulfilled');
      
      if (!allSuccessful) {
        // Find failed chunks
        const failedChunks = results
          .map((result, index) => result.status === 'rejected' ? index : null)
          .filter(index => index !== null);
        
        console.error(`Failed to upload chunks: ${failedChunks.join(', ')}`);
        
        // If all chunks failed, throw an error
        if (failedChunks.length === totalChunks) {
          throw new Error('All chunks failed to upload.');
        }
        
        // If some chunks failed, show a warning but continue
        setProcessingUpdates(prev => [...prev, {
          id: Date.now(),
          status: 'warning',
          message: `${failedChunks.length} of ${totalChunks} chunks failed to upload. Processing may be incomplete.`,
          timestamp: new Date().toISOString()
        }]);
      }
      
      // Mark upload as complete and transition to processing phase
      setProgress(50); // Upload is 50% of the total progress
      console.log('Chunked upload completed. Waiting for server processing...');
      
      // Add a message about successful upload
      setProcessingUpdates(prev => [...prev, {
        id: Date.now(),
        status: 'success',
        message: 'File upload complete. Processing has begun.',
        timestamp: new Date().toISOString()
      }]);
      
      // The rest of the processing will be handled via WebSocket updates
      
      // Return cleanup function
      return cleanup;
    } catch (error) {
      console.error('Upload failed:', error);
      
      setUploading(false);
      setProgress(0);
      
      // Determine what type of error occurred for better user feedback
      let errorMessage = 'An error occurred during upload.';
      
      if (config.isCorsError(error)) {
        errorMessage = config.ERROR_MESSAGES.CORS_ERROR;
      } else if (error.message?.includes('Network Error')) {
        errorMessage = config.ERROR_MESSAGES.NETWORK_ERROR;
      } else if (error.response) {
        // Server returned an error
        if (error.response.status === 502) {
          errorMessage = config.ERROR_MESSAGES.BAD_GATEWAY;
        } else if (error.response.status === 413) {
          errorMessage = config.ERROR_MESSAGES.FILE_TOO_LARGE;
        } else if (error.response.status === 404) {
          errorMessage = config.ERROR_MESSAGES.API_404;
        } else if (error.response.data?.error) {
          errorMessage = error.response.data.error;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
      
      // Add error to processing updates
      setProcessingUpdates(prev => [...prev, {
        id: Date.now(),
        status: 'error',
        message: errorMessage,
        details: error.stack,
        timestamp: new Date().toISOString()
      }]);
    }
  };

  // Initialize WebSocket connection and session ID
  useEffect(() => {
    // Skip reconnecting if we already have a connected socket
    if (socketRef.current && socketRef.current.connected) {
      console.log('Skipping WebSocket initialization - already connected');
      return;
    }
    
    // Initialize connection
    const cleanup = connectSocket();
    
    // Setup heartbeat ping every 15 seconds to keep connection alive
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
    
    // Set up polling fallback for when WebSockets fail completely
    let pollingInterval;
    const failedAttemptsBeforePolling = 3;
    
    // If we're in the middle of an upload and WebSockets aren't working, begin polling
    const setupPollingFallback = () => {
      // Only set up polling if we're uploading and don't already have an interval
      if (uploading && !pollingInterval) {
        console.log('Setting up polling fallback for status updates');
        
        pollingInterval = setInterval(() => {
          if (!uploading) {
            // If no longer uploading, clear the interval
            clearInterval(pollingInterval);
            pollingInterval = null;
            return;
          }
          
          // Poll for updates
          axios.get(`${config.API_URL}/api/status?sessionId=${sessionId}`, {
            headers: {
              'x-user-id': user?.id || '',
              'x-session-id': sessionId
            },
            withCredentials: true,
            timeout: 10000
          })
          .then(response => {
            if (response.data) {
              const update = response.data;
              console.log('Received update via polling:', update);
              
              // Process the update
              if (update.status === 'completed') {
                setProgress(100);
                setUploading(false);
                if (update.reportUrl) {
                  setResult({
                    message: 'Processing completed successfully',
                    fileName: update.reportFileName || update.fileName || 'meeting_report.docx',
                    reportUrl: update.reportUrl,
                    format: update.format || 'docx',
                    transcript: update.transcript
                  });
                }
              } else if (update.status === 'error') {
                setError(update.message || 'An error occurred during processing');
                setUploading(false);
              } else if (update.percentComplete) {
                // Update progress
                const scaledProgress = 50 + (update.percentComplete / 2);
                setProgress(Math.min(99, scaledProgress));
              }
              
              // Add update to processing updates
              setProcessingUpdates(prev => [...prev, {
                ...update,
                id: Date.now(),
                pollingUpdate: true
              }]);
            }
          })
          .catch(error => {
            console.error('Error polling for status:', error);
          });
        }, 10000); // Poll every 10 seconds
      }
    };
    
    // Watch for socket state changes to set up polling when needed
    const socketStateWatcher = setInterval(() => {
      if (socketRef.current?.disconnected && reconnectAttemptsRef.current >= failedAttemptsBeforePolling && uploading) {
        setupPollingFallback();
      }
    }, 5000);
    
    // Clean up on component unmount
    return () => {
      clearInterval(heartbeatInterval);
      clearInterval(socketStateWatcher);
      if (pollingInterval) clearInterval(pollingInterval);
      cleanup();
    };
  }, [sessionId, uploading]); // Add uploading as dependency

  // Add this function at the end of the component before the return statement
  const renderFallbackDashboard = () => {
    return (
      <div className="fallback-dashboard" style={{
        padding: '20px',
        maxWidth: '800px',
        margin: '0 auto',
        backgroundColor: '#fff',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        marginTop: '30px'
      }}>
        <h2>Meeting Transcription Dashboard</h2>
        <p>Upload your meeting audio files to get started with AI-powered transcription and analysis.</p>
        
        <div style={{
          border: '2px dashed #ccc',
          borderRadius: '8px',
          padding: '40px 20px',
          textAlign: 'center',
          marginTop: '20px'
        }}>
          <div style={{fontSize: '3rem', color: '#007bff', marginBottom: '20px'}}>
            <i className="bi bi-cloud-arrow-up"></i>
          </div>
          <h3>Upload Meeting Audio</h3>
          <p>Drag and drop your audio file here or click to browse</p>
          <button 
            style={{
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '4px',
              cursor: 'pointer',
              marginTop: '15px'
            }}
            onClick={() => {
              // Try to use the existing file input ref if available
              if (typeof fileInputRef !== 'undefined' && fileInputRef.current) {
                fileInputRef.current.click();
              } else {
                console.log('File input ref not available');
                // Create a temporary file input if the ref isn't available
                const tempInput = document.createElement('input');
                tempInput.type = 'file';
                tempInput.accept = 'audio/*';
                tempInput.click();
              }
            }}
          >
            Choose File
          </button>
        </div>
        
        <div style={{
          marginTop: '30px',
          padding: '15px',
          backgroundColor: '#e6f7ff',
          borderRadius: '4px',
          border: '1px solid #91d5ff'
        }}>
          <h4><i className="bi bi-info-circle me-2"></i>Having trouble?</h4>
          <p>If you're experiencing issues with the dashboard, please try:</p>
          <ol>
            <li>Refreshing the page</li>
            <li>Signing out and signing back in</li>
            <li>Clearing your browser cache</li>
            <li>Using a different browser</li>
          </ol>
        </div>
      </div>
    );
  };

  // Add this useEffect at the beginning of the component
  useEffect(() => {
    // Debug info to help diagnose rendering issues
    console.log('FileUpload component mounted');
    console.log('Window dimensions:', window.innerWidth, 'x', window.innerHeight);
    console.log('Dashboard container:', document.querySelector('.dashboard-container'));
    
    // Log any potential CSS issues
    setTimeout(() => {
      const dashboardContainer = document.querySelector('.dashboard-container');
      if (dashboardContainer) {
        const styles = window.getComputedStyle(dashboardContainer);
        console.log('Dashboard container computed styles:', {
          display: styles.display,
          visibility: styles.visibility,
          opacity: styles.opacity,
          height: styles.height,
          width: styles.width,
          position: styles.position,
          zIndex: styles.zIndex
        });
      } else {
        console.error('Dashboard container not found in DOM');
      }
    }, 500);
    
    // Add a resize listener to check if the container size changes
    const handleResize = () => {
      console.log('Window resized to:', window.innerWidth, 'x', window.innerHeight);
      const dashboardContainer = document.querySelector('.dashboard-container');
      if (dashboardContainer) {
        console.log('Dashboard container size after resize:', {
          offsetWidth: dashboardContainer.offsetWidth,
          offsetHeight: dashboardContainer.offsetHeight,
          clientWidth: dashboardContainer.clientWidth,
          clientHeight: dashboardContainer.clientHeight
        });
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Add as part of your component's state management at the top
  const pollingIntervalRef = useRef(null);

  // Add this function to process updates from both WebSocket and polling
  const handleProcessingUpdate = (data) => {
    // First add the update to our history
    setProcessingUpdates(prev => [...prev, {
      ...data,
      id: Date.now(),
      timestamp: data.timestamp || new Date().toISOString()
    }]);
    
    // Then process the update based on type
    if (data.status === 'completed') {
      setProgress(100);
      setUploading(false);
      if (data.reportUrl) {
        setResult({
          message: 'Processing completed successfully',
          fileName: data.reportFileName || data.fileName || 'meeting_report.docx',
          reportUrl: data.reportUrl,
          format: data.format || 'docx',
          transcript: data.transcript
        });
      }
    } else if (data.status === 'error') {
      setError(data.message || 'An error occurred during processing');
      setUploading(false);
    } else if (data.percentComplete) {
      // Update progress bar (second half of progress)
      const scaledProgress = 50 + (data.percentComplete / 2);
      setProgress(Math.min(99, scaledProgress));
    }
  };

  // Function to test CORS configuration - can be used for debugging
  const testCorsConfig = async () => {
    console.log('Testing CORS configuration...');
    
    setProcessingUpdates(prev => [...prev, {
      id: Date.now(),
      status: 'info',
      message: 'Testing connection to server...',
      timestamp: new Date().toISOString()
    }]);
    
    try {
      // Try each strategy in sequence
      for (const strategy of config.UPLOAD_CONFIG.FALLBACK_STRATEGIES) {
        console.log(`Testing with strategy: withCredentials=${strategy.withCredentials}, includeContentType=${strategy.includeContentType}`);
        
        try {
          // Basic headers
          const headers = {
            'x-user-id': user?.id || 'test-user',
            'x-session-id': sessionId
          };
          
          // Add content type if needed
          if (strategy.includeContentType) {
            headers['Content-Type'] = 'application/json';
          }
          
          // Test the CORS configuration
          const response = await axios.get(`${config.API_URL}/api/test/cors`, {
            headers,
            withCredentials: strategy.withCredentials
          });
          
          console.log('CORS test successful:', response.data);
          
          // Add success update
          setProcessingUpdates(prev => [...prev, {
            id: Date.now(),
            status: 'success',
            message: `Connection test successful with strategy ${strategy.withCredentials ? 'with' : 'without'} credentials`,
            details: 'Server connection is properly configured.',
            timestamp: new Date().toISOString()
          }]);
          
          // If successful, no need to try other strategies
          return true;
        } catch (error) {
          console.error('CORS test error with strategy:', strategy, error);
          
          // Continue to next strategy
          setProcessingUpdates(prev => [...prev, {
            id: Date.now(),
            status: 'warning',
            message: `Connection test failed with strategy ${strategy.withCredentials ? 'with' : 'without'} credentials`,
            details: `Error: ${error.message}. Trying next approach...`,
            timestamp: new Date().toISOString()
          }]);
        }
      }
      
      // If we get here, all strategies failed
      throw new Error('All connection test strategies failed');
    } catch (error) {
      console.error('CORS test final error:', error);
      
      setProcessingUpdates(prev => [...prev, {
        id: Date.now(),
        status: 'error',
        message: 'All connection tests failed',
        details: 'Please check if the server is running and CORS is properly configured.',
        timestamp: new Date().toISOString()
      }]);
      
      return false;
    }
  };

  // In the return statement, add a try-catch to render the fallback on error
  try {
    return (
      <div className="file-upload">
        <div className="dashboard-container">
          {/* Header section with title and upload form */}
          <header className="dashboard-header">
            <h1>MeetingScribe - Meeting Analysis Dashboard</h1>
            <p className="subheading">Upload your meeting audio to get a detailed analysis and summary</p>
          </header>

          {/* Main content area */}
          <div className="dashboard-content">
            {/* File upload section */}
            <div 
              className={`upload-box ${dragActive ? 'drag-active' : ''}`}
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
            >
              <div className="upload-icon">
                <i className="bi bi-cloud-arrow-up"></i>
              </div>
              <h3>Upload Meeting Audio</h3>
              <p>Drag and drop your audio file here or</p>
              <input
                type="file"
                onChange={handleFileChange}
                accept="audio/*"
                ref={fileInputRef}
                style={{ display: 'none' }}
              />
              <button 
                className="upload-button"
                onClick={() => fileInputRef.current && fileInputRef.current.click()}
              >
                Choose File
              </button>
              {file && (
                <div className="selected-file">
                  <p><strong>Selected:</strong> {file.name} ({(file.size / (1024 * 1024)).toFixed(2)} MB)</p>
                </div>
              )}
            </div>
            
            {/* Options section */}
            <div className="options-section">
              {/* Meeting Topic Selection */}
              <div className="option-card">
                <div className="option-header">
                  <i className="bi bi-chat-text"></i>
                  <h3>Meeting Topic</h3>
                </div>
                <select 
                  value={meetingTopic} 
                  onChange={e => setMeetingTopic(e.target.value)}
                  className="form-select"
                >
                  {MEETING_TOPICS.map(topic => (
                    <option key={topic.value} value={topic.value}>
                      {topic.label}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Custom Instructions */}
              <div className="option-card">
                <div className="option-header" onClick={() => setShowCustomInstructions(!showCustomInstructions)}>
                  <i className="bi bi-gear"></i>
                  <h3>Custom Instructions</h3>
                  <i className={`bi bi-chevron-${showCustomInstructions ? 'up' : 'down'} toggle-icon`}></i>
                </div>
                {showCustomInstructions && (
                  <div className="option-content">
                    <textarea
                      value={customInstructions}
                      onChange={e => setCustomInstructions(e.target.value)}
                      placeholder="Add any specific instructions for processing your audio..."
                      rows={4}
                      className="form-control"
                    />
                  </div>
                )}
              </div>
              
              {/* Guider Agent - Meeting Evaluation */}
              <div className="option-card">
                <div className="option-header" onClick={toggleEvaluationOptions}>
                  <i className="bi bi-clipboard-data"></i>
                  <h3>Guider Agent</h3>
                  <i className={`bi bi-chevron-${showEvaluationOptions ? 'up' : 'down'} toggle-icon`}></i>
                </div>
                {showEvaluationOptions && (
                  <div className="option-content">
                    <p>The Guider Agent will evaluate meeting performance based on the template below.</p>
                    <select 
                      value={evaluationTemplate} 
                      onChange={handleEvaluationTemplateChange}
                      className="form-select mb-3"
                    >
                      {EVALUATION_TEMPLATES.map(template => (
                        <option key={template.value} value={template.value}>
                          {template.label}
                        </option>
                      ))}
                    </select>
                    
                    {(evaluationTemplate && evaluationTemplate !== '') && (
                      <textarea
                        value={customEvaluationTemplate}
                        onChange={handleCustomEvaluationTemplateChange}
                        placeholder="Customize the evaluation template..."
                        rows={6}
                        className="form-control"
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
            
            {/* Progress and error display */}
            {uploading && (
              <div className="progress-container">
                <div className="progress">
                  <div 
                    className="progress-bar" 
                    role="progressbar" 
                    style={{width: `${progress}%`}}
                    aria-valuenow={progress} 
                    aria-valuemin="0" 
                    aria-valuemax="100"
                  ></div>
                </div>
                <p>{progress < 100 ? 'Processing...' : 'Almost done!'}</p>
              </div>
            )}
            
            {error && (
              <div className="error-message">
                <i className="bi bi-exclamation-triangle"></i>
                <p>{error}</p>
              </div>
            )}
            
            {/* Results section */}
            {result && (
              <div className="results-section">
                <h3>Processing Complete!</h3>
                <p>Your meeting transcript and analysis are ready.</p>
                
                <div className="result-buttons">
                  <a 
                    href={`${config.API_URL}${result.reportUrl}`} 
                    className="download-button"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <i className="bi bi-file-earmark-word"></i>
                    Download Report
                  </a>
                  
                  <button
                    className="chat-button"
                    onClick={() => setShowChat(true)}
                  >
                    <i className="bi bi-chat-dots"></i>
                    Ask AI about this meeting
                  </button>
                </div>
                
                {/* Transcript chat component */}
                {showChat && transcript && (
                  <TranscriptChat transcript={transcript} onClose={() => setShowChat(false)} />
                )}
              </div>
            )}
            
            {/* Usage information for logged-in users */}
            {isSignedIn && usageData && (
              <div className="usage-info">
                <p>
                  You've used {usageData.used} of {usageData.limit} free transcriptions
                  {usageData.upgradeRequired && ' - Upgrade to continue using the service'}
                </p>
                
                {usageData.upgradeRequired && (
                  <button
                    className="upgrade-button"
                    onClick={() => setShowUpgradeModal(true)}
                  >
                    Upgrade Now
                  </button>
                )}
              </div>
            )}
          </div>
          
          {/* Floating Process Button */}
          <div className="floating-process-button-container">
            <button 
              className="floating-process-button"
              onClick={handleUpload}
              disabled={!file || uploading}
            >
              {uploading ? (
                <>
                  <span className="process-text">Processing</span>
                  <span className="process-dots"><span>.</span><span>.</span><span>.</span></span>
                </>
              ) : (
                <>
                  <span className="process-icon"><i className="bi bi-play-circle-fill"></i></span>
                  <span className="process-text">Process File</span>
                </>
              )}
            </button>
          </div>
        </div>
        
        {/* Premium upgrade modal */}
        {showUpgradeModal && (
          <PremiumUpgrade 
            onClose={() => setShowUpgradeModal(false)}
            usageData={usageData}
          />
        )}
      </div>
    );
  } catch (error) {
    console.error('Error rendering FileUpload component:', error);
    return renderFallbackDashboard();
  }
};

export default FileUpload;