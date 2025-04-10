import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, Button, Form, Row, Col, Dropdown, OverlayTrigger, Tooltip, Alert } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faPlay, 
  faStop, 
  faPause, 
  faClock, 
  faCalendarDay, 
  faCheckCircle,
  faLaptopCode,
  faMugHot,
  faUsers,
  faTasks,
  faFileAlt,
  faEllipsisH,
  faKeyboard,
  faExclamationTriangle,
  faHourglass,
  faUndo
} from '@fortawesome/free-solid-svg-icons';
import WorkProgressService from '../../services/WorkProgressService';
import axios from 'axios';
import config from '../../config';
import supabase from '../../supabaseClient';

// CSS styles for enhanced visual feedback
const styles = {
  activityTracker: {
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
    borderRadius: '8px',
    transition: 'all 0.3s ease'
  },
  successButton: {
    animation: 'pulse 1.5s',
    boxShadow: '0 0 0 0 rgba(40, 167, 69, 0.7)',
    transition: 'background-color 0.3s, transform 0.2s',
    transform: 'scale(1.05)'
  },
  activityCard: {
    backgroundColor: '#f8f9fa',
    borderLeft: '4px solid #007bff',
    borderRadius: '4px',
    padding: '12px',
    marginTop: '10px',
    transition: 'all 0.3s ease'
  },
  timerDisplay: {
    fontSize: '24px',
    fontWeight: 'bold',
    fontFamily: 'monospace',
    letterSpacing: '1px',
  },
  keyboardShortcut: {
    fontSize: '12px',
    opacity: 0.7,
    fontWeight: 'normal'
  },
  button: {
    borderRadius: '4px',
    fontWeight: '500'
  },
  timerSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '10px',
    background: '#f8f9fa',
    borderRadius: '5px',
    marginBottom: '15px'
  },
  totalTimerSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '10px',
    background: '#e9ecef',
    borderRadius: '5px',
    border: '1px solid #dee2e6',
    marginBottom: '15px'
  }
};

// Define keyboard shortcuts helper component
const KeyboardShortcut = ({ keys }) => (
  <span style={styles.keyboardShortcut}>
    <FontAwesomeIcon icon={faKeyboard} size="xs" className="me-1" />
    {keys}
  </span>
);

/**
 * Activity Tracker component for tracking work sessions and activities
 */
const ActivityTracker = ({ activeSession, onStartSession, onEndSession }) => {
  // State variables
  const [timer, setTimer] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [totalTimer, setTotalTimer] = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [description, setDescription] = useState('');
  const [activityType, setActivityType] = useState('work');
  const [currentActivity, setCurrentActivity] = useState(null);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [sessionError, setSessionError] = useState(null);
  const [hasActiveSession, setHasActiveSession] = useState(false);
  const [isLogging, setIsLogging] = useState(false);
  const [showSuccessFeedback, setShowSuccessFeedback] = useState(false);
  const [lastActivityEndTime, setLastActivityEndTime] = useState(null);
  
  // Refs
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const pausedTimeRef = useRef(0);
  const totalTimeRef = useRef(0);
  const inputRef = useRef(null);
  
  // Activity type options
  const activityTypes = [
    { value: 'work', label: 'Coding/Development', icon: faLaptopCode },
    { value: 'meeting', label: 'Meeting', icon: faUsers },
    { value: 'planning', label: 'Planning', icon: faTasks },
    { value: 'admin', label: 'Administrative', icon: faFileAlt },
    { value: 'break', label: 'Break', icon: faMugHot },
    { value: 'other', label: 'Other', icon: faEllipsisH }
  ];
  
  // Format timer values to two digits
  const formatTime = (value) => {
    return value.toString().padStart(2, '0');
  };
  
  // Define handleEndActivity first to avoid circular dependencies
  const handleEndActivity = async (activityToEnd) => {
    const targetActivity = activityToEnd || currentActivity;
    if (!targetActivity) return { success: false, error: 'No active activity to end' };
    
    try {
      console.log('Ending activity:', targetActivity.id);
      const result = await WorkProgressService.endActivity(targetActivity.id);
      
      if (result.error) {
        console.error('Error ending activity:', result.error);
        return { success: false, error: result.error };
      }
      
      if (targetActivity.id === currentActivity?.id) {
        setCurrentActivity(null);
      }
      return { success: true, data: result.data };
    } catch (error) {
      console.error('Error in handleEndActivity:', error);
      return { success: false, error: error.message || 'Failed to end activity' };
    }
  };
  
  /**
   * Log activity with fallback mechanisms to handle endpoint issues
   * @param {Object} activityData - The activity data to log
   * @returns {Promise<Object>} - Result of the logging operation
   */
  const logActivityWithFallbacks = async (activityData) => {
    // Start with normal service method
    let result = await WorkProgressService.logActivity(activityData);
    
    // If successful, return result
    if (!result.error) {
      console.log('Activity logged successfully with standard endpoint');
      return result;
    }
    
    // Log the error for debugging
    console.warn('Standard endpoint logActivity failed:', result.error);
    
    // If there was an error and it looks like a 404 (endpoint not found), try direct fallbacks
    if (result.error.details && 
        (result.error.details.includes('404') || 
         result.error.details.includes('not found'))) {
      console.warn('Standard endpoint failed, trying direct fallbacks');
      
      // Try each potential endpoint directly
      const fallbackEndpoints = [
        '/api/work-progress/activities',
        '/activities',
        '/api/activities'
      ];
      
      for (const endpoint of fallbackEndpoints) {
        try {
          console.log(`Trying fallback endpoint: ${endpoint}`);
          
          // For direct API calls, stringify the metadata if it's an object
          const payloadWithSafeMetadata = { ...activityData };
          
          if (payloadWithSafeMetadata.metadata && typeof payloadWithSafeMetadata.metadata === 'object') {
            try {
              // Ensure metadata is properly formatted as a string if needed
              payloadWithSafeMetadata.metadata = JSON.stringify(payloadWithSafeMetadata.metadata);
            } catch (err) {
              console.warn('Error stringifying metadata, removing it:', err.message);
              delete payloadWithSafeMetadata.metadata;
            }
          }
          
          const response = await axios.post(
            `${config.API_URL}${endpoint}`, 
            payloadWithSafeMetadata,
            {
              headers: {
                Authorization: `Bearer ${await WorkProgressService.getAuthToken()}`,
                'Content-Type': 'application/json',
                'x-user-id': activityData.user_id || ''  // Include user ID in header as fallback
              }
            }
          );
          
          if (response.data && response.data.activity) {
            console.log(`Activity logged successfully with fallback endpoint: ${endpoint}`);
            return { data: response.data.activity, error: null };
          } else if (response.data) {
            // If there's a response but no activity field, try to construct a result
            console.log(`Got response from ${endpoint} but no activity field, constructing result`);
            return { 
              data: response.data.data || response.data, 
              error: null 
            };
          }
        } catch (err) {
          console.warn(`Fallback endpoint ${endpoint} failed:`, err.message);
          
          // Try one more time without metadata if there's an error related to it
          if (err.message.includes('metadata') || err.response?.data?.error?.includes('metadata')) {
            try {
              console.log(`Trying ${endpoint} again without metadata...`);
              const simplePayload = { ...activityData };
              delete simplePayload.metadata;
              
              const simpleResponse = await axios.post(
                `${config.API_URL}${endpoint}`, 
                simplePayload,
                {
                  headers: {
                    Authorization: `Bearer ${await WorkProgressService.getAuthToken()}`,
                    'Content-Type': 'application/json',
                    'x-user-id': activityData.user_id || ''
                  }
                }
              );
              
              if (simpleResponse.data && (simpleResponse.data.activity || simpleResponse.data.data)) {
                console.log(`Activity logged successfully without metadata via ${endpoint}`);
                return { 
                  data: simpleResponse.data.activity || simpleResponse.data.data, 
                  error: null 
                };
              }
            } catch (simpleErr) {
              console.warn(`Simplified ${endpoint} also failed:`, simpleErr.message);
            }
          }
        }
      }
    }
    
    // If we got here, all attempts failed, try direct database insertion
    try {
      console.log('All API endpoints failed, attempting direct database insertion');
      
      // Create a minimal version of the activity data
      const minimalData = {
        session_id: activityData.session_id,
        user_id: activityData.user_id,
        activity_type: activityData.activity_type || 'work',
        description: activityData.description,
        start_time: activityData.start_time || new Date().toISOString()
      };
      
      // Try direct insertion through supabase
      const { data, error } = await supabase
        .from('activity_logs')
        .insert([minimalData])
        .select('*')
        .single();
      
      if (error) {
        console.error('Direct database insertion also failed:', error);
      } else if (data) {
        console.log('Activity logged successfully via direct database insertion');
        return { data, error: null };
      }
    } catch (dbError) {
      console.error('Error with direct database insertion:', dbError);
    }
    
    // If we got here, all attempts failed
    return result;
  };
  
  // Start a new activity - defined early with useCallback to avoid dependency issues
  const handleStartActivity = useCallback(async () => {
    if (!hasActiveSession) {
      setSessionError('No active work session. Please start a session first.');
      return;
    }
    
    const trimmedDescription = description.trim();
    if (!trimmedDescription) {
      setSessionError('Please enter a description of what you are working on');
      return;
    }
    
    if (trimmedDescription.length < 3) {
      setSessionError('Description must be at least 3 characters long');
      return;
    }
    
    try {
      setIsLogging(true);
      // Clear any previous error messages when attempting to log activity
      setSessionError(null);
      
      // End current activity if exists
      if (currentActivity) {
        const endResult = await handleEndActivity(currentActivity);
        if (endResult?.error) {
          console.warn('Warning: Failed to end previous activity:', endResult.error);
          // Continue anyway - we'll still try to log the new activity
        }
      }
      
      // Create a proper metadata object that will be safely handled by the database
      const metadataObj = {
        source: 'activity_tracker',
        client_timestamp: new Date().toISOString(),
        input_method: 'manual',
        browser: navigator.userAgent || 'unknown',
        app_version: '1.0' // You can update this with your actual app version
      };
      
      // Format the activity data to ensure it's complete
      const activityData = {
        session_id: activeSession.id,
        user_id: activeSession.user_id, // Include user_id directly from the session
        activity_type: activityType,
        description: trimmedDescription,
        start_time: new Date().toISOString(),
        metadata: metadataObj // Use the properly formatted metadata object
      };
      
      console.log('Logging activity:', {
        session_id: activityData.session_id,
        activity_type: activityData.activity_type,
        description: activityData.description
      });
      
      // Try to log activity with fallback mechanisms
      const result = await logActivityWithFallbacks(activityData);
      
      if (result.error) {
        // If there's a metadata error, try again without it
        if (result.error.message?.includes('metadata') || result.error.details?.includes('metadata')) {
          console.warn('Error with metadata field, attempting without it...');
          
          // Create a version without metadata
          const simpleActivityData = { ...activityData };
          delete simpleActivityData.metadata;
          
          const simpleResult = await logActivityWithFallbacks(simpleActivityData);
          
          if (!simpleResult.error) {
            // Success with simple version
            setShowSuccessFeedback(true);
            setTimeout(() => setShowSuccessFeedback(false), 3000);
            
            setCurrentActivity(simpleResult.data);
            setDescription('');
            
            // Focus back on the input field for the next entry
            document.querySelector('input[placeholder="Describe your current activity..."]')?.focus();
            
            console.log('Activity logged successfully without metadata:', simpleResult.data);
            setIsLogging(false);
            return;
          }
        }
        
        throw new Error(result.error.message || 'Failed to log activity');
      }
      
      // Show success feedback
      setShowSuccessFeedback(true);
      setTimeout(() => setShowSuccessFeedback(false), 3000);
      
      setCurrentActivity(result.data);
      setDescription('');
      
      // Focus back on the input field for the next entry
      document.querySelector('input[placeholder="Describe your current activity..."]')?.focus();
      
      // Log to console for debugging
      console.log('Activity logged successfully:', result.data);
    } catch (error) {
      console.error('Error logging activity:', error);
      
      // Provide more helpful error messages based on common error patterns
      if (error.message?.includes('session') || error.message?.includes('Session')) {
        setSessionError('Session error: Your work session may have expired. Try refreshing the page.');
      } else if (error.message?.includes('network') || error.message?.includes('Network')) {
        setSessionError('Network error: Please check your internet connection and try again.');
      } else if (error.message?.includes('404') || error.message?.includes('not found')) {
        setSessionError('API endpoint not found. The server may be down or misconfigured. Please check your network settings or contact support.');
      } else if (error.message?.includes('CORS') || error.message?.includes('cross-origin')) {
        setSessionError('Cross-origin error: There may be a configuration issue with the server. Please contact support.');
      } else if (error.message?.includes('metadata') || error.message?.includes('column')) {
        setSessionError('Database error: There may be an issue with the activity data format. Please try a different description or contact support.');
      } else {
        setSessionError(error.message || 'Failed to log activity. Please try again.');
      }
    } finally {
      setIsLogging(false);
    }
  }, [
    hasActiveSession, 
    description, 
    activityType, 
    activeSession, 
    currentActivity
  ]);
  
  // Start the timer
  const startTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    startTimeRef.current = Date.now() - pausedTimeRef.current;
    
    timerRef.current = setInterval(() => {
      const elapsedTime = Date.now() - startTimeRef.current;
      const seconds = Math.floor((elapsedTime / 1000) % 60);
      const minutes = Math.floor((elapsedTime / (1000 * 60)) % 60);
      const hours = Math.floor(elapsedTime / (1000 * 60 * 60));
      
      setTimer({ hours, minutes, seconds });
      
      // Update total time (previous accumulated time + current elapsed time)
      const totalSeconds = Math.floor((totalTimeRef.current + elapsedTime) / 1000);
      const totalHours = Math.floor(totalSeconds / 3600);
      const totalMinutes = Math.floor((totalSeconds % 3600) / 60);
      const remainingSeconds = totalSeconds % 60;
      
      setTotalTimer({ 
        hours: totalHours, 
        minutes: totalMinutes, 
        seconds: remainingSeconds 
      });
    }, 1000);
    
    setIsTimerRunning(true);
    setIsPaused(false);
  };
  
  // Pause the timer
  const pauseTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      const currentElapsedTime = Date.now() - startTimeRef.current;
      pausedTimeRef.current = currentElapsedTime;
      
      // Update total accumulated time
      totalTimeRef.current += currentElapsedTime;
    }
    
    setIsTimerRunning(false);
    setIsPaused(true);
  };
  
  // Stop the timer
  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      
      // If timer was running, add the final elapsed time to total
      if (isTimerRunning && startTimeRef.current) {
        totalTimeRef.current += (Date.now() - startTimeRef.current);
      }
    }
    
    setTimer({ hours: 0, minutes: 0, seconds: 0 });
    // Keep total timer as is when stopping - it preserves the cumulative time
    setIsTimerRunning(false);
    setIsPaused(false);
    pausedTimeRef.current = 0;
  };
  
  // Reset all timers and counters
  const resetTimers = useCallback(() => {
    setTimer({ hours: 0, minutes: 0, seconds: 0 });
    setTotalTimer({ hours: 0, minutes: 0, seconds: 0 });
    setLastActivityEndTime(null);
  }, []);
  
  // Initialize or reset when activeSession changes
  useEffect(() => {
    // Clear any previous errors whenever activeSession changes
    setSessionError(null);
    
    if (activeSession) {
      console.log('ActivityTracker received active session:', activeSession.id);
      setHasActiveSession(true);
      
      // Calculate elapsed time if session is active
      if (activeSession.start_time) {
        const startTime = new Date(activeSession.start_time).getTime();
        const now = Date.now();
        const elapsedTime = now - startTime;
        
        const seconds = Math.floor((elapsedTime / 1000) % 60);
        const minutes = Math.floor((elapsedTime / (1000 * 60)) % 60);
        const hours = Math.floor(elapsedTime / (1000 * 60 * 60));
        
        setTimer({ hours, minutes, seconds });
        
        // Start the timer
        startTimeRef.current = startTime;
        // Reset total time for new session
        resetTimers();
        startTimer();
      }
    } else {
      console.log('No active session provided to ActivityTracker');
      setHasActiveSession(false);
      // No active session, reset timer
      resetTimers();
    }
    
    // Cleanup timer on unmount
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [activeSession]);
  
  // Add global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Only trigger if Alt key is pressed with the shortcut
      if (e.altKey) {
        switch (e.key.toLowerCase()) {
          case 's':
            if (!hasActiveSession) handleStartSession();
            e.preventDefault();
            break;
          case 'p':
            if (hasActiveSession) pauseTimer();
            e.preventDefault();
            break;
          case 'e':
            if (hasActiveSession) handleEndSession();
            e.preventDefault();
            break;
          case 'l':
            if (hasActiveSession && description.trim() && !isLogging) {
              document.querySelector('input[placeholder="Describe your current activity..."]')?.focus();
              // Call the Log button action with a slight delay to avoid dependency issues
              setTimeout(() => {
                // Double-check conditions again in case they changed
                if (hasActiveSession && description.trim() && !isLogging) {
                  const logButton = document.querySelector('button.w-100');
                  if (logButton && !logButton.disabled) {
                    logButton.click();
                  }
                }
              }, 10);
            }
            e.preventDefault();
            break;
          default:
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [hasActiveSession, description, isLogging]);
  
  // Handle session start
  const handleStartSession = async () => {
    try {
      setSessionError(null);
      // Wait for the session to start completely
      const session = await onStartSession();
      
      if (session) {
        startTimer();
        // Only try to start the initial activity if needed
        // This prevents potential issues with handleStartActivity being called too early
        if (description && description.trim().length >= 3) {
          try {
            // Start the initial activity
            await handleStartActivity();
          } catch (activityError) {
            console.error("Error starting initial activity:", activityError);
            // Don't fail the whole session start if activity fails
          }
        }
      } else {
        setSessionError('Failed to start work session. Please try again.');
      }
    } catch (error) {
      console.error('Error in handleStartSession:', error);
      setSessionError(error.message || 'Failed to start work session');
    }
  };
  
  // Handle session end
  const handleEndSession = async () => {
    // End current activity if any
    if (currentActivity) {
      await handleEndActivity();
    }
    
    // If timer is running, add the final time to total
    if (isTimerRunning && startTimeRef.current) {
      totalTimeRef.current += (Date.now() - startTimeRef.current);
      
      // Update the total timer display one last time
      const totalSeconds = Math.floor(totalTimeRef.current / 1000);
      const totalHours = Math.floor(totalSeconds / 3600);
      const totalMinutes = Math.floor((totalSeconds % 3600) / 60);
      const remainingSeconds = totalSeconds % 60;
      
      setTotalTimer({ 
        hours: totalHours, 
        minutes: totalMinutes, 
        seconds: remainingSeconds 
      });
    }
    
    // End the session
    await onEndSession();
    stopTimer();
  };
  
  // Handle activity type selection
  const handleActivityTypeSelect = (type) => {
    setActivityType(type);
  };
  
  return (
    <Card className="activity-tracker" style={styles.activityTracker}>
      <Card.Body>
        <div className="activity-tracker-header">
          <h4 className="mb-0">
            <FontAwesomeIcon icon={faClock} className="me-2" />
            Work Tracker
          </h4>
          <div className="activity-status">
            {hasActiveSession ? (
              <>
                <div className={`status-indicator ${isTimerRunning ? 'active' : 'inactive'}`}></div>
                <span>{isTimerRunning ? 'Working' : 'Paused'}</span>
              </>
            ) : (
              <>
                <div className="status-indicator inactive"></div>
                <span>Not Working</span>
              </>
            )}
          </div>
        </div>
        
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div className="timer-section" style={styles.timerSection}>
            <small className="text-muted">Current:</small>
            <div className="timer-display" style={styles.timerDisplay}>
              {formatTime(timer.hours)}:{formatTime(timer.minutes)}:{formatTime(timer.seconds)}
            </div>
          </div>
          <div className="timer-section" style={{...styles.timerSection, ...styles.totalTimerSection}}>
            <small className="text-muted">
              <FontAwesomeIcon icon={faHourglass} className="me-1" />
              Total Session:
            </small>
            <div className="timer-display" style={{...styles.timerDisplay, color: '#28a745'}}>
              {formatTime(totalTimer.hours)}:{formatTime(totalTimer.minutes)}:{formatTime(totalTimer.seconds)}
            </div>
          </div>
        </div>
        
        <Row className="align-items-end mb-3">
          <Col md={7}>
            <Form.Group>
              <Form.Label>What are you working on?</Form.Label>
              <Form.Control
                ref={inputRef}
                type="text"
                placeholder="Describe your current activity..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={!hasActiveSession}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && hasActiveSession && description.trim() && !isLogging) {
                    e.preventDefault();
                    handleStartActivity();
                  }
                }}
              />
            </Form.Group>
          </Col>
          <Col md={3}>
            <Form.Group>
              <Form.Label>Activity Type</Form.Label>
              <Dropdown onSelect={handleActivityTypeSelect}>
                <Dropdown.Toggle variant="outline-secondary" id="activity-type-dropdown" disabled={!hasActiveSession}>
                  <FontAwesomeIcon icon={activityTypes.find(type => type.value === activityType)?.icon || faLaptopCode} className="me-2" />
                  {activityTypes.find(type => type.value === activityType)?.label || 'Work'}
                </Dropdown.Toggle>
                <Dropdown.Menu>
                  {activityTypes.map(type => (
                    <Dropdown.Item key={type.value} eventKey={type.value}>
                      <FontAwesomeIcon icon={type.icon} className="me-2" />
                      {type.label}
                    </Dropdown.Item>
                  ))}
                </Dropdown.Menu>
              </Dropdown>
            </Form.Group>
          </Col>
          <Col md={2}>
            <Button 
              variant={showSuccessFeedback ? "success" : "primary"}
              className="w-100" 
              onClick={handleStartActivity}
              disabled={!hasActiveSession || !description.trim() || isLogging}
              aria-busy={isLogging}
              aria-live="polite"
              style={showSuccessFeedback ? styles.successButton : {}}
            >
              {isLogging ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  Logging...
                </>
              ) : showSuccessFeedback ? (
                <>
                  <FontAwesomeIcon icon={faCheckCircle} className="me-2" />
                  Logged!
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faCheckCircle} className="me-2" />
                  Log
                  <KeyboardShortcut keys="Alt+L" />
                </>
              )}
            </Button>
          </Col>
        </Row>
        
        {sessionError && !hasActiveSession && (
          <Row className="mt-2 mb-3">
            <Col>
              <Alert variant="danger" dismissible onClose={() => setSessionError(null)}>
                {sessionError}
              </Alert>
            </Col>
          </Row>
        )}
        
        {sessionError && hasActiveSession && (
          <Row className="mt-2 mb-3">
            <Col>
              <Alert variant="warning" dismissible onClose={() => setSessionError(null)}>
                {sessionError}
              </Alert>
            </Col>
          </Row>
        )}
        
        <div className="d-flex gap-2 flex-wrap mt-3 mb-3">
          {!hasActiveSession ? (
            <Button 
              variant="success" 
              onClick={handleStartSession} 
              style={styles.button}
              disabled={isLogging}
            >
              <FontAwesomeIcon icon={faPlay} className="me-2" />
              Start Session <span style={styles.keyboardShortcut}>(Alt+S)</span>
            </Button>
          ) : (
            <>
              <Button 
                variant={isTimerRunning ? "warning" : "success"} 
                onClick={isTimerRunning ? pauseTimer : startTimer} 
                style={styles.button}
                disabled={isLogging}
              >
                <FontAwesomeIcon icon={isTimerRunning ? faPause : faPlay} className="me-2" />
                {isTimerRunning ? "Pause" : "Resume"} <span style={styles.keyboardShortcut}>(Alt+P)</span>
              </Button>
              
              <Button 
                variant="danger" 
                onClick={handleEndSession} 
                style={styles.button}
                disabled={isLogging}
              >
                <FontAwesomeIcon icon={faStop} className="me-2" />
                End Session <span style={styles.keyboardShortcut}>(Alt+E)</span>
              </Button>
              
              {(timer.hours > 0 || timer.minutes > 0 || timer.seconds > 0 ||
                totalTimer.hours > 0 || totalTimer.minutes > 0 || totalTimer.seconds > 0) && (
                <Button 
                  variant="outline-secondary" 
                  onClick={resetTimers} 
                  style={styles.button}
                  disabled={isLogging}
                >
                  <FontAwesomeIcon icon={faUndo} className="me-2" />
                  Reset Timers
                </Button>
              )}
            </>
          )}
        </div>
        
        {hasActiveSession && activeSession && (
          <Row className="mt-3">
            <Col>
              <span className="text-muted">
                <FontAwesomeIcon icon={faCalendarDay} className="me-1" />
                Started: {new Date(activeSession.start_time).toLocaleTimeString()}
              </span>
            </Col>
          </Row>
        )}
        
        {currentActivity && (
          <Row className="mt-3">
            <Col>
              <div className="current-activity" style={styles.activityCard}>
                <small className="text-muted">Currently working on:</small>
                <p className="mb-0">
                  <FontAwesomeIcon 
                    icon={activityTypes.find(type => type.value === currentActivity.activity_type)?.icon || faLaptopCode} 
                    className="me-2" 
                  />
                  <strong>{currentActivity.description}</strong>
                </p>
              </div>
            </Col>
          </Row>
        )}
      </Card.Body>
    </Card>
  );
};

export default ActivityTracker; 