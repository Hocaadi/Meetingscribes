import React, { useState, useEffect } from 'react';
import { Button } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faComment, faTimes } from '@fortawesome/free-solid-svg-icons';
import './AskAIButton.css';

const AskAIButton = ({ onClick, isOpen }) => {
  const [pulse, setPulse] = useState(false);
  
  // Add pulse animation effect every 10 seconds
  useEffect(() => {
    if (isOpen) return;
    
    const interval = setInterval(() => {
      setPulse(true);
      setTimeout(() => setPulse(false), 2000);
    }, 10000);
    
    return () => clearInterval(interval);
  }, [isOpen]);
  
  return (
    <Button 
      className={`ask-ai-button ${pulse ? 'pulse' : ''} ${isOpen ? 'open' : ''}`}
      onClick={onClick}
      aria-label={isOpen ? "Close AI Assistant" : "Open AI Assistant"}
    >
      <FontAwesomeIcon icon={isOpen ? faTimes : faComment} />
      {!isOpen && <span className="ask-ai-text">Ask AI</span>}
    </Button>
  );
};

export default AskAIButton; 