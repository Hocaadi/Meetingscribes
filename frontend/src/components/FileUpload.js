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
  // State variables
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [processingUpdates, setProcessingUpdates] = useState([]);
  const [uploadStrategy, setUploadStrategy] = useState('auto');
  const [socketStatus, setSocketStatus] = useState('disconnected');
  const [meetingTopic, setMeetingTopic] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');
  const [evaluationTemplate, setEvaluationTemplate] = useState('default');
  const [customEvaluationTemplate, setCustomEvaluationTemplate] = useState('');
  const [showEvaluationOptions, setShowEvaluationOptions] = useState(false);
  const [showCustomInstructions, setShowCustomInstructions] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [transcriptionModel, setTranscriptionModel] = useState(null);
  const [analysisModel, setAnalysisModel] = useState(null);
  const [transcript, setTranscript] = useState('');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [transcriptAvailable, setTranscriptAvailable] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [upgradePlan, setUpgradePlan] = useState('yearly');
  const [uploadedChunks, setUploadedChunks] = useState([]);
  const [sessionId, setSessionId] = useState(() => uuidv4());
  const [requestStatus, setRequestStatus] = useState(null);
  
  // References to maintain values across renders
  const socketRef = useRef(null);
  const fileInputRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const fileIdRef = useRef(null);
  const uploadStartTimeRef = useRef(null);
  const lastProgressUpdateRef = useRef(null);
  const lastPollTimeRef = useRef(null);
  const pollingIntervalRef = useRef(null);
  const consecutiveFailuresRef = useRef(0);
  const socketStatusRef = useRef('disconnected');
  
  // Auth context
  const { isSignedIn, isLoaded, user } = useUser();

  // Utility function to format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Initialize socket connection
  useEffect(() => {
    // Create socket connection
    const initSocket = () => {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      
      // Close existing socket if it exists
      if (socketRef.current) {
        socketRef.current.close();
      }
      
      // Create new socket instance with basic configuration
      const socket = io(apiUrl, {
        query: { sessionId },
        reconnection: true,
        reconnectionAttempts: maxReconnectAttempts,
        reconnectionDelay: 1000,
        timeout: 10000
      });
      
      // Basic event handlers
      socket.on('connect', () => {
        console.log('Socket connected:', socket.id);
        setSocketStatus('connected');
        socketStatusRef.current = 'connected';
        
        // Register for updates if we have a fileId (resuming upload)
        if (fileIdRef.current && uploading) {
          socket.emit('register_for_updates', { fileId: fileIdRef.current });
        }
      });
      
      socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
        setSocketStatus('disconnected');
        socketStatusRef.current = 'disconnected';
        
        // If disconnection during upload, show message
        if (uploading) {
          setProcessingUpdates(prev => [...prev, {
            id: Date.now(),
            status: 'warning',
            message: `Connection lost: ${reason}. Attempting to reconnect...`,
            timestamp: new Date().toISOString()
          }]);
        }
      });
      
      socket.on('reconnect_attempt', (attempt) => {
        console.log(`Socket reconnection attempt ${attempt}`);
        setSocketStatus('connecting');
        socketStatusRef.current = 'connecting';
      });
      
      socket.on('reconnect', (attempt) => {
        console.log(`Socket reconnected after ${attempt} attempts`);
        setSocketStatus('connected');
        socketStatusRef.current = 'connected';
        
        // Re-register for updates if needed
        if (fileIdRef.current && uploading) {
          socket.emit('register_for_updates', { fileId: fileIdRef.current });
        }
      });
      
      socket.on('reconnect_failed', () => {
        console.log('Socket reconnection failed');
        setSocketStatus('error');
        socketStatusRef.current = 'error';
        
        // Switch to polling if we have a file being processed
        if (fileIdRef.current && uploading) {
          startPollingForUpdates(fileIdRef.current);
        }
      });
      
      // Handle processing updates
      socket.on('processing_update', (data) => {
        console.log('Received processing update:', data);
        lastProgressUpdateRef.current = Date.now();
        
        // Store fileId for reconnection needs
        if (data.fileId) {
          fileIdRef.current = data.fileId;
        }
        
        // Parse progress if it's a string
        let progressValue = data.progress;
        if (typeof progressValue === 'string') {
          try {
            progressValue = parseInt(progressValue, 10);
          } catch (e) {
            progressValue = undefined;
          }
        }
        
        // Handle different processing statuses
        if (data.status === 'processing') {
          // Update progress if provided
          if (progressValue !== undefined && !isNaN(progressValue)) {
            // Scale progress to 50-100 range (upload was 0-50)
            const scaledProgress = 50 + (progressValue / 2);
            setProgress(Math.min(scaledProgress, 99)); // Cap at 99% until complete
          }
          
          // Add the update to our log with a unique ID
          setProcessingUpdates(prev => [...prev, {
            id: Date.now(),
            ...data,
            timestamp: new Date().toISOString()
          }]);
        }
        else if (data.status === 'completed') {
          // Upload completed
          setUploading(false);
          setProgress(100);
          
          // Format the result data
          const resultData = {
            message: 'Processing completed successfully',
            fileName: data.fileName || 'processed_file.docx',
            reportUrl: data.reportUrl || (data.fileId ? `/api/download/${data.fileId}` : null),
            format: data.format || 'docx'
          };
          
          setResult(resultData);
          
          // Store transcript if available
          if (data.transcript) {
            setTranscript(data.transcript);
            setTranscriptAvailable(true);
          }
          
          // Clear polling if it was active
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          
          // Add completion message
          setProcessingUpdates(prev => [...prev, {
            id: Date.now(),
            status: 'success',
            message: 'Processing completed successfully! You can now download your results.',
            timestamp: new Date().toISOString()
          }]);
        }
        else if (data.status === 'error') {
          // Handle errors
          setUploading(false);
          setError(data.error || 'An error occurred during processing');
          
          // Add error message
          setProcessingUpdates(prev => [...prev, {
            id: Date.now(),
            status: 'error',
            message: data.error || 'An error occurred during processing',
            timestamp: new Date().toISOString()
          }]);
          
          // Clear polling if it was active
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
        }
        else if (data.status === 'chunk_processing') {
          // Update chunk progress
          if (data.chunkIndex !== undefined && data.chunkProgress !== undefined) {
            // Update chunk progress
            setUploadedChunks(prev => {
              const newChunks = [...prev];
              if (newChunks[data.chunkIndex]) {
                newChunks[data.chunkIndex].progress = data.chunkProgress;
              }
              return newChunks;
            });
            
            // Calculate overall progress (0-50 for upload + scaled 0-50 for processing)
            const overallProgress = 50 + ((progressValue || 0) / 2);
            setProgress(Math.min(overallProgress, 99));
          }
          
          // Add to updates log
          setProcessingUpdates(prev => [...prev, {
            id: Date.now(),
            ...data,
            timestamp: new Date().toISOString()
          }]);
        }
        else {
          // Handle any other status updates
          console.log("Unhandled processing status:", data.status);
          
          // Add to updates log
          setProcessingUpdates(prev => [...prev, {
            id: Date.now(),
            ...data,
            timestamp: new Date().toISOString()
          }]);
        }
      });
      
      // Simple heartbeat check
      const heartbeatInterval = setInterval(() => {
        if (socket.connected) {
          socket.emit('ping');
        }
      }, 30000);
      
      // Store the socket and clear interval on cleanup
      socketRef.current = socket;
      
      return () => {
        clearInterval(heartbeatInterval);
        socket.disconnect();
      };
    };
    
    // Initialize the socket
    const cleanup = initSocket();
    
    // Cleanup on unmount
    return cleanup;
  }, [sessionId, uploading]);
  
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
      
      setRequestStatus(response.data);
      
      // Show upgrade modal if user has exceeded limit
      if (response.data.upgradeRequired) {
        setShowUpgradeModal(true);
      }
    } catch (error) {
      console.error('Error fetching user request status:', error);
    }
  };
  
  // Start polling for updates when WebSocket fails
  const startPollingForUpdates = (fileId) => {
    console.log("Starting polling for updates on file:", fileId);
    
    // Clear any existing polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    
    // Set last poll time
    lastPollTimeRef.current = Date.now();
    
    // Add message about polling
    setProcessingUpdates(prev => [...prev, {
      id: Date.now(),
      status: 'info',
      message: 'Switched to polling for processing updates',
      timestamp: new Date().toISOString()
    }]);
    
    // Poll every 5 seconds
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
        const response = await axios.get(`${apiUrl}/api/processing-status/${fileId}`);
        
        // Update last poll time
        lastPollTimeRef.current = Date.now();
        consecutiveFailuresRef.current = 0;
        
        // Process the update from polling
        processUpdate(response.data);
        
        // If processing is complete, stop polling
        if (response.data.status === 'completed' || response.data.status === 'error') {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      } catch (error) {
        console.error("Error polling for updates:", error);
        
        // Track consecutive failures
        consecutiveFailuresRef.current++;
        
        // After 3 consecutive failures, stop polling
        if (consecutiveFailuresRef.current >= 3) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
          
          setProcessingUpdates(prev => [...prev, {
            id: Date.now(),
            status: 'error',
            message: 'Failed to get processing updates. Please check the status in your account dashboard.',
            timestamp: new Date().toISOString()
          }]);
        }
      }
    }, 5000);
  };
  
  // If we're in the middle of an upload and WebSockets aren't working, begin polling
  const setupPollingFallback = () => {
    // Only set up polling if we're uploading and don't already have an interval
    if (uploading && !pollingIntervalRef.current && fileIdRef.current) {
      console.log('Setting up polling fallback for status updates');
      startPollingForUpdates(fileIdRef.current);
    } else if (uploading && !fileIdRef.current) {
      console.log('Cannot set up polling - no fileId available');
    }
  };
  
  // Process update from polling
  const processUpdate = (data) => {
    // Add the update to our updates log
    setProcessingUpdates(prev => [...prev, {
      id: Date.now(),
      ...data,
      timestamp: new Date().toISOString()
    }]);
    
    // Handle different status types
    if (data.status === 'completed') {
      setProgress(100);
      setUploading(false);
      
      setResult({
        message: 'Processing completed successfully',
        fileName: data.fileName || 'processed_file.docx',
        reportUrl: data.reportUrl || (data.fileId ? `/api/download/${data.fileId}` : null),
        format: data.format || 'docx'
      });
      
      if (data.transcript) {
        setTranscript(data.transcript);
        setTranscriptAvailable(true);
      }
    } 
    else if (data.status === 'error') {
      setError(data.error || 'An error occurred during processing');
      setUploading(false);
    } 
    else if (data.progress) {
      // Update progress (scale to 50-100 range)
      const scaledProgress = 50 + (data.progress / 2);
      setProgress(Math.min(scaledProgress, 99));
    }
  };

  // Calculate overall progress from chunk data
  const calculateOverallProgress = (chunks) => {
    if (!chunks.length) return 0;
    
    // Sum up progress across all chunks
    const totalProgress = chunks.reduce((sum, chunk) => sum + (chunk.progress || 0), 0);
    // Average progress (0-100)
    return totalProgress / chunks.length;
  };

  // Upload file chunk with retry functionality
  const uploadChunk = async (chunkIndex, totalChunks, fileId, commonFormData, headers, chunks) => {
    try {
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
      formData.append('chunk', chunks[chunkIndex].data);
      
      // Configure request
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      const requestConfig = {
        headers,
        timeout: 30000,
        onUploadProgress: (progressEvent) => {
          // Calculate progress for this chunk
          const chunkProgress = (progressEvent.loaded / progressEvent.total) * 100;
          
          // Update progress for this specific chunk
          const updatedChunks = [...chunks];
          updatedChunks[chunkIndex].progress = chunkProgress;
          setUploadedChunks(updatedChunks);
          
          // Calculate overall progress (up to 50% - the rest is for processing)
          const overallProgress = calculateOverallProgress(updatedChunks) / 2;
          setProgress(overallProgress);
        }
      };
      
      // Send the upload request
      const response = await axios.post(`${apiUrl}/api/upload/chunk`, formData, requestConfig);
      
      // Mark this chunk as uploaded
      const updatedChunks = [...chunks];
      updatedChunks[chunkIndex].uploaded = true;
      updatedChunks[chunkIndex].progress = 100;
      setUploadedChunks(updatedChunks);
      
      console.log(`Chunk ${chunkIndex + 1}/${totalChunks} uploaded successfully`);
      
      // Return response data
      return response.data;
    } catch (error) {
      console.error(`Error uploading chunk ${chunkIndex + 1}/${totalChunks}:`, error);
      
      // Track the attempt
      const updatedChunks = [...chunks];
      updatedChunks[chunkIndex].attempts += 1;
      setUploadedChunks(updatedChunks);
      
      // If we've exceeded retry attempts, throw the error
      if (updatedChunks[chunkIndex].attempts >= 3) {
        throw error;
      }
      
      // Otherwise, retry with a delay
      console.log(`Retrying chunk ${chunkIndex + 1}/${totalChunks} (attempt ${updatedChunks[chunkIndex].attempts + 1}/3)`);
      
      // Add a delay before retrying
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Retry with the same strategy
      return uploadChunk(chunkIndex, totalChunks, fileId, commonFormData, headers, updatedChunks);
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
      
      // Track key references
      uploadStartTimeRef.current = Date.now();
      lastProgressUpdateRef.current = Date.now();
      reconnectAttemptsRef.current = 0;
      consecutiveFailuresRef.current = 0;
      
      // Clear any existing polling interval
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      
      // Generate a unique file ID for tracking chunks
      const fileId = uuidv4();
      fileIdRef.current = fileId;
      
      // Prepare file for chunked upload 
      const chunkSize = CHUNK_SIZE;
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
        sessionId: sessionId,
        userId: user?.id || '',
        meetingTopic: meetingTopic || '',
        customInstructions: customInstructions || '',
        evaluationTemplate: evaluationTemplate || '',
        customEvaluationTemplate: customEvaluationTemplate || ''
      };
      
      // Common headers for all requests
      const headers = {
        'x-user-id': user?.id || '',
        'x-session-id': sessionId
      };
      
      console.log('Starting chunked upload with session ID:', sessionId);
      
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
      lastProgressUpdateRef.current = Date.now(); // Update progress timestamp
      console.log('Chunked upload completed. Waiting for server processing...');
      
      // Add a message about successful upload
      setProcessingUpdates(prev => [...prev, {
        id: Date.now(),
        status: 'success',
        message: 'File upload complete. Processing has begun.',
        timestamp: new Date().toISOString()
      }]);
      
      // Register for processing updates
      if (socketRef.current) {
        socketRef.current.emit('register_for_updates', { 
          fileId: fileId,
          sessionId: sessionId
        });
        console.log('Registered for processing updates with server');
      } else {
        console.warn('Socket not available for real-time updates, using polling fallback');
        startPollingForUpdates(fileId);
      }
      
      // Set up simple monitoring for stalled uploads
      const monitoringInterval = setInterval(() => {
        // Check if we're still processing
        if (!uploading) {
          clearInterval(monitoringInterval);
          return;
        }
        
        const now = Date.now();
        // If no updates for 30 seconds, try polling as backup
        if (lastProgressUpdateRef.current && (now - lastProgressUpdateRef.current > 30000)) {
          console.log('No updates for 30 seconds, setting up polling as backup');
          
          if (fileIdRef.current && !pollingIntervalRef.current) {
            startPollingForUpdates(fileIdRef.current);
          }
        }
      }, 30000);
      
      return () => clearInterval(monitoringInterval);
      
    } catch (error) {
      console.error('Upload failed:', error);
      
      setUploading(false);
      setProgress(0);
      
      // Determine what type of error occurred for better user feedback
      let errorMessage = 'An error occurred during upload.';
      
      if (config.isCorsError && config.isCorsError(error)) {
        errorMessage = config.ERROR_MESSAGES?.CORS_ERROR || 'CORS error occurred';
      } else if (error.message?.includes('Network Error')) {
        errorMessage = config.ERROR_MESSAGES?.NETWORK_ERROR || 'Network error occurred';
      } else if (error.response) {
        // Server returned an error
        if (error.response.status === 502) {
          errorMessage = config.ERROR_MESSAGES?.BAD_GATEWAY || 'Bad gateway error';
        } else if (error.response.status === 413) {
          errorMessage = config.ERROR_MESSAGES?.FILE_TOO_LARGE || 'File too large';
        } else if (error.response.status === 404) {
          errorMessage = config.ERROR_MESSAGES?.API_404 || 'API endpoint not found';
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

  // Handle file drag events
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  // Handle file drop event
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
      if (droppedFile.size > 100 * 1024 * 1024) {
        setError('File size exceeds 100MB limit');
        return;
      }
      
      setFile(droppedFile);
      setError(null);
    }
  };

  // Handle file input change
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      
      // Check if file is an audio file
      if (!selectedFile.type.startsWith('audio/')) {
        setError('Please upload an audio file (MP3, WAV, etc.)');
        return;
      }
      
      // Check file size (max 100MB)
      if (selectedFile.size > 100 * 1024 * 1024) {
        setError('File size exceeds 100MB limit');
        return;
      }
      
      setFile(selectedFile);
      setError(null);
    }
  };

  // Toggle evaluation options visibility
  const toggleEvaluationOptions = () => {
    setShowEvaluationOptions(!showEvaluationOptions);
  };

  // Handle evaluation template change
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
      // For custom template, start with an empty textarea
      setCustomEvaluationTemplate('');
    } else {
      // No template selected
      setCustomEvaluationTemplate('');
    }
  };

  // Handle custom evaluation template change
  const handleCustomEvaluationTemplateChange = (e) => {
    setCustomEvaluationTemplate(e.target.value);
  };

  // Initialize WebSocket connection and session ID
  useEffect(() => {
    // Skip reconnecting if we already have a connected socket
    if (socketRef.current && socketRef.current.connected) {
      console.log('Skipping WebSocket initialization - already connected');
      return;
    }
    
    // Initialize connection
    const initSocket2 = () => {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      
      // Close existing socket if it exists
      if (socketRef.current) {
        try {
          socketRef.current.close();
        } catch (e) {
          console.error('Error closing existing socket:', e);
        }
      }
      
      // Create new socket instance with basic configuration
      const socket = io(apiUrl, {
        query: { sessionId },
        reconnection: true,
        reconnectionAttempts: maxReconnectAttempts,
        reconnectionDelay: 1000,
        timeout: 10000
      });
      
      // Set up basic event handlers (full handlers are in the main initSocket)
      socket.on('connect', () => {
        console.log('Socket connected:', socket.id);
        setSocketStatus('connected');
        socketStatusRef.current = 'connected';
      });
      
      socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
        setSocketStatus('disconnected');
        socketStatusRef.current = 'disconnected';
      });
      
      // Store the socket
      socketRef.current = socket;
      
      // Return cleanup function
      return () => {
        try {
          socket.disconnect();
        } catch (e) {
          console.error('Error disconnecting socket:', e);
        }
      };
    };
    
    // Setup aggressive heartbeat ping every 8 seconds to keep connection alive
    const heartbeatInterval = setInterval(() => {
      // Access the current socket
      const currentSocket = socketRef.current;
      
      if (currentSocket && currentSocket.connected) {
        // Send heartbeat and track the time
        const pingTimestamp = Date.now();
        currentSocket.emit('ping', { timestamp: pingTimestamp });
        
        // Set a timeout to check if we got a pong back
        setTimeout(() => {
          // Check if socket is still connected and needs a reconnect
          if (currentSocket && currentSocket.connected && 
              (!currentSocket.lastPongTime || currentSocket.lastPongTime < pingTimestamp)) {
            console.log('No pong received in 5 seconds, reconnecting...');
            // Force reconnection
            try {
              currentSocket.disconnect();
              currentSocket.connect();
            } catch (e) {
              console.error('Error during socket reconnect:', e);
            }
          }
        }, 5000);
      } else if (currentSocket && !currentSocket.connected && socketStatus !== 'connecting') {
        // Try to reconnect if socket exists but isn't connected
        console.log('Heartbeat detected disconnected socket, attempting to reconnect...');
        try {
          currentSocket.connect();
        } catch (e) {
          console.error('Error reconnecting socket from heartbeat:', e);
          // If reconnection fails, try to set up a new socket
          if (reconnectAttemptsRef.current < 3) {
            reconnectAttemptsRef.current++;
            initSocket2();
          } else {
            // Fall back to polling
            setupPollingFallback();
          }
        }
      }
    }, 8000); // More frequent heartbeat
    
    // Set up polling fallback for when WebSockets fail completely
    const failedAttemptsBeforePolling = 2; // Reduced threshold
    
    // Initiate socket connection
    const cleanup = initSocket2();
    
    // Watch for socket state changes to set up polling when needed
    const socketStateWatcher = setInterval(() => {
      // If socket has been disconnected for a while during an upload, start polling
      if ((socketRef.current?.disconnected || !socketRef.current) && 
          reconnectAttemptsRef.current >= failedAttemptsBeforePolling && 
          uploading) {
        setupPollingFallback();
      }
      
      // If uploading has been going on for more than 5 minutes, force completion check
      if (uploading && uploadStartTimeRef.current && 
          (Date.now() - uploadStartTimeRef.current > 5 * 60 * 1000)) {
        // Check if there's been any progress update in the last 2 minutes
        const lastUpdateTime = lastProgressUpdateRef.current || 0;
        if (Date.now() - lastUpdateTime > 2 * 60 * 1000) {
          console.log('No progress updates for 2+ minutes, forcing status check');
          // Force a status check
          axios.get(`${config.API_URL}/api/status?sessionId=${sessionId}`, {
            headers: {
              'x-user-id': user?.id || '',
              'x-session-id': sessionId
            },
            withCredentials: true,
            timeout: 10000
          })
          .then(response => {
            if (response.data && response.data.status === 'completed') {
              console.log('Status check found completed processing');
              setProgress(100);
              setUploading(false);
              setResult({
                message: 'Processing completed successfully',
                fileName: response.data.reportFileName || response.data.fileName || 'meeting_report.docx',
                reportUrl: response.data.reportUrl,
                format: response.data.format || 'docx',
                transcript: response.data.transcript
              });
            }
          })
          .catch(err => console.error('Error in forced status check:', err));
        }
      }
    }, 10000);
    
    // Clean up on component unmount
    return () => {
      clearInterval(heartbeatInterval);
      clearInterval(socketStateWatcher);
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      if (cleanup && typeof cleanup === 'function') {
        cleanup();
      }
      
      // Explicitly close socket
      if (socketRef.current) {
        try {
          socketRef.current.disconnect();
          socketRef.current = null;
        } catch (e) {
          console.error('Error disconnecting socket during cleanup:', e);
        }
      }
    };
  }, [sessionId, uploading, user?.id, socketStatus]);

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
            {isSignedIn && requestStatus && (
              <div className="usage-info">
                <p>
                  You've used {requestStatus.used} of {requestStatus.limit} free transcriptions
                  {requestStatus.upgradeRequired && ' - Upgrade to continue using the service'}
                </p>
                
                {requestStatus.upgradeRequired && (
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
            requestStatus={requestStatus}
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