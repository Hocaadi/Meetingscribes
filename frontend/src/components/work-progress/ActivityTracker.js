import React, { useState, useEffect, useRef } from 'react';
import { Card, Button, Form, Row, Col, Dropdown } from 'react-bootstrap';
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
  faEllipsisH
} from '@fortawesome/free-solid-svg-icons';
import WorkProgressService from '../../services/WorkProgressService';

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
    if (!activeSession || !description.trim()) return;
    
    try {
      // End current activity if exists
      if (currentActivity) {
        await handleEndActivity();
      }
      
      // Create new activity
      const activity = await WorkProgressService.logActivity({
        session_id: activeSession.id,
        activity_type: activityType,
        description: description
      });
      
      setCurrentActivity(activity);
      setDescription('');
    } catch (error) {
      console.error('Error starting activity:', error);
    }
  };
  
  // End the current activity
  const handleEndActivity = async () => {
    if (!currentActivity) return;
    
    try {
      await WorkProgressService.endActivity(currentActivity.id);
      setCurrentActivity(null);
    } catch (error) {
      console.error('Error ending activity:', error);
    }
  };
  
  return (
    <Card className="activity-tracker">
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
        
        <div className="timer-display">
          {formatTime(timer.hours)}:{formatTime(timer.minutes)}:{formatTime(timer.seconds)}
        </div>
        
        <Row className="align-items-end mb-3">
          <Col md={7}>
            <Form.Group>
              <Form.Label>What are you working on?</Form.Label>
              <Form.Control
                type="text"
                placeholder="Describe your current activity..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={!activeSession}
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
              variant="primary" 
              className="w-100" 
              onClick={handleStartActivity}
              disabled={!activeSession || !description.trim()}
            >
              <FontAwesomeIcon icon={faCheckCircle} className="me-2" />
              Log
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
              <div className="current-activity p-2 bg-light rounded border">
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