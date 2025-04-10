import React, { useState, useEffect, useRef } from 'react';
import { Card, Button, Form, Row, Col, Dropdown, OverlayTrigger, Tooltip } from 'react-bootstrap';
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
  faKeyboard
} from '@fortawesome/free-solid-svg-icons';
import WorkProgressService from '../../services/WorkProgressService';

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
    fontSize: '2rem',
    fontWeight: 'bold',
    textAlign: 'center',
    margin: '15px 0',
    fontFamily: 'monospace'
  },
  keyboardShortcut: {
    fontSize: '0.8rem',
    color: '#6c757d',
    marginLeft: '5px'
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
  const [description, setDescription] = useState('');
  const [activityType, setActivityType] = useState('work');
  const [currentActivity, setCurrentActivity] = useState(null);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [sessionError, setSessionError] = useState(null);
  
  // Refs
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const pausedTimeRef = useRef(0);
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
  
  // Add these state declarations at the top with the other state variables
  const [isLogging, setIsLogging] = useState(false);
  const [showSuccessFeedback, setShowSuccessFeedback] = useState(false);
  
  // Format timer values to two digits
  const formatTime = (value) => {
    return value.toString().padStart(2, '0');
  };
  
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
    }, 1000);
    
    setIsTimerRunning(true);
    setIsPaused(false);
  };
  
  // Pause the timer
  const pauseTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      pausedTimeRef.current = Date.now() - startTimeRef.current;
    }
    
    setIsTimerRunning(false);
    setIsPaused(true);
  };
  
  // Stop the timer
  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    setTimer({ hours: 0, minutes: 0, seconds: 0 });
    setIsTimerRunning(false);
    setIsPaused(false);
    pausedTimeRef.current = 0;
  };
  
  // Initialize or reset when activeSession changes
  useEffect(() => {
    if (activeSession) {
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
        startTimer();
      }
    } else {
      // No active session, reset timer
      stopTimer();
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
      // Alt+L to log activity if session is active
      if (e.altKey && e.key === 'l' && activeSession && description.trim() && !isLogging) {
        e.preventDefault();
        handleStartActivity();
      }
      // Alt+P to pause/resume timer if session is active
      else if (e.altKey && e.key === 'p' && activeSession) {
        e.preventDefault();
        isTimerRunning ? pauseTimer() : startTimer();
      }
      // Alt+S to start session if no active session
      else if (e.altKey && e.key === 's' && !activeSession) {
        e.preventDefault();
        handleStartSession();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSession, description, isLogging, isTimerRunning]);
  
  // Handle session start
  const handleStartSession = async () => {
    try {
      setSessionError(null);
      const session = await onStartSession();
      
      if (session) {
        startTimer();
        // Start the initial activity
        handleStartActivity();
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
    
    // End the session
    await onEndSession();
    stopTimer();
  };
  
  // Handle activity type selection
  const handleActivityTypeSelect = (type) => {
    setActivityType(type);
  };
  
  // Start a new activity
  const handleStartActivity = async () => {
    if (!activeSession) {
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
      setSessionError(null);
      
      // End current activity if exists
      if (currentActivity) {
        const endResult = await handleEndActivity();
        if (endResult?.error) {
          console.warn('Warning: Failed to end previous activity:', endResult.error);
          // Continue anyway - we'll still try to log the new activity
        }
      }
      
      // Format the activity data to ensure it's complete
      const activityData = {
        session_id: activeSession.id,
        activity_type: activityType,
        description: trimmedDescription,
        start_time: new Date().toISOString(),
        metadata: {
          source: 'activity_tracker',
          client_timestamp: new Date().toISOString(),
          input_method: 'manual'
        }
      };
      
      console.log('Logging activity:', activityData);
      
      // Create new activity using the service
      const result = await WorkProgressService.logActivity(activityData);
      
      if (result.error) {
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
      } else {
        setSessionError(error.message || 'Failed to log activity. Please try again.');
      }
    } finally {
      setIsLogging(false);
    }
  };
  
  // End the current activity
  const handleEndActivity = async () => {
    if (!currentActivity) return { success: false, error: 'No active activity to end' };
    
    try {
      console.log('Ending activity:', currentActivity.id);
      const result = await WorkProgressService.endActivity(currentActivity.id);
      
      if (result.error) {
        console.error('Error ending activity:', result.error);
        return { success: false, error: result.error };
      }
      
      setCurrentActivity(null);
      return { success: true, data: result.data };
    } catch (error) {
      console.error('Error in handleEndActivity:', error);
      return { success: false, error: error.message || 'Failed to end activity' };
    }
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
            {activeSession ? (
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
        
        <div className="timer-display" style={styles.timerDisplay}>
          {formatTime(timer.hours)}:{formatTime(timer.minutes)}:{formatTime(timer.seconds)}
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
                disabled={!activeSession}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && activeSession && description.trim() && !isLogging) {
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
                <Dropdown.Toggle variant="outline-secondary" id="activity-type-dropdown" disabled={!activeSession}>
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
              disabled={!activeSession || !description.trim() || isLogging}
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
        
        {sessionError && (
          <Row className="mt-2 mb-3">
            <Col>
              <div className="text-danger">{sessionError}</div>
            </Col>
          </Row>
        )}
        
        <Row>
          <Col>
            {!activeSession ? (
              // Start session button
              <Button variant="success" className="me-2" onClick={handleStartSession}>
                <FontAwesomeIcon icon={faPlay} className="me-2" />
                Start Work Session
              </Button>
            ) : (
              // Session control buttons
              <>
                {isTimerRunning ? (
                  <Button variant="warning" className="me-2" onClick={pauseTimer}>
                    <FontAwesomeIcon icon={faPause} className="me-2" />
                    Pause
                  </Button>
                ) : (
                  <Button variant="primary" className="me-2" onClick={startTimer}>
                    <FontAwesomeIcon icon={faPlay} className="me-2" />
                    Resume
                  </Button>
                )}
                <Button variant="danger" onClick={handleEndSession}>
                  <FontAwesomeIcon icon={faStop} className="me-2" />
                  End Session
                </Button>
              </>
            )}
          </Col>
          {activeSession && (
            <Col className="text-end">
              <span className="text-muted">
                <FontAwesomeIcon icon={faCalendarDay} className="me-1" />
                Started: {new Date(activeSession.start_time).toLocaleTimeString()}
              </span>
            </Col>
          )}
        </Row>
        
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