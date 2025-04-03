import React, { useState, useEffect, useRef } from 'react';
import { Card, Form, Button, Spinner } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPaperPlane, faRobot, faUser, faLightbulb, faSearch } from '@fortawesome/free-solid-svg-icons';
import WorkAIService from '../../services/WorkAIService';
import './AskAIChat.css';

const AskAIChat = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      text: 'Hi there! I can answer questions about your work progress, tasks, and accomplishments. What would you like to know?',
      type: 'ai',
      timestamp: new Date(),
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to the most recent message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus the input field when the chat opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Submit a question to the AI
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!inputValue.trim()) return;
    
    const userMessage = {
      id: `user-${Date.now()}`,
      text: inputValue,
      type: 'user',
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('Submitting question to AI:', inputValue);
      
      // Get date range for the query (last 30 days)
      const today = new Date();
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(today.getDate() - 30);
      
      const dateRange = {
        start_date: thirtyDaysAgo.toISOString().split('T')[0],
        end_date: today.toISOString().split('T')[0]
      };
      
      console.log('Using date range:', dateRange);
      
      // Send the query to the API
      const response = await WorkAIService.askWorkQuestion(
        inputValue, 
        { 
          date_range: dateRange,
          include_tasks: true,
          include_accomplishments: true,
          include_sessions: true
        }
      );
      
      console.log('Received AI response:', response);
      
      // Add AI response to messages
      const aiMessage = {
        id: `ai-${Date.now()}`,
        text: response.answer,
        type: 'ai',
        timestamp: new Date(),
        source: response.source || 'ai',
        data: response.data || null
      };
      
      setMessages(prev => [...prev, aiMessage]);
    } catch (err) {
      console.error('Error getting AI response:', err);
      console.error('Error details:', err.response?.data || err.message);
      
      // Create a user-friendly error message
      let errorMessage = 'Sorry, I encountered an error while processing your question. Please try again.';
      
      // If it's a network error
      if (err.message?.includes('Network Error')) {
        errorMessage = 'Unable to connect to the server. Please check your internet connection and try again.';
      } 
      // If it's a timeout error
      else if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        errorMessage = 'The request took too long to complete. The server might be busy, please try again later.';
      }
      // If it's an authorization error
      else if (err.response?.status === 401 || err.response?.status === 403) {
        errorMessage = 'You are not authorized to use this feature. Please log in again or contact support.';
      }
      // If it's a 404 error (endpoint not found)
      else if (err.response?.status === 404) {
        errorMessage = 'The API endpoint was not found. This could be a configuration issue or the backend service is not running properly.';
      }
      
      setError(errorMessage);
      
      // Add error message
      const errorMsg = {
        id: `error-${Date.now()}`,
        text: errorMessage,
        type: 'error',
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Helper to format timestamp
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  // Get appropriate icon based on message type and source
  const getMessageIcon = (message) => {
    if (message.type === 'user') {
      return faUser;
    } else if (message.type === 'ai') {
      if (message.source === 'database') {
        return faSearch; // Database/RAG source
      } else if (message.source === 'fallback') {
        return faLightbulb; // Client-side fallback
      } else {
        return faRobot; // AI source
      }
    } else {
      return faLightbulb; // Error or other
    }
  };
  
  // Get source label for AI messages
  const getSourceLabel = (message) => {
    if (message.type !== 'ai' || !message.source) return null;
    
    switch (message.source) {
      case 'database':
        return 'Based on your work data';
      case 'ai':
        return 'AI-generated response';
      case 'fallback':
        return 'Offline mode - AI assistant';
      default:
        return null;
    }
  };
  
  // Check if chat should be displayed
  if (!isOpen) return null;
  
  return (
    <div className={`ask-ai-chat-container ${isOpen ? 'open' : ''}`}>
      <Card className="ask-ai-chat-card">
        <Card.Header className="ask-ai-chat-header">
          <div className="ask-ai-chat-title">
            <FontAwesomeIcon icon={faRobot} className="ask-ai-chat-icon" />
            <span>Ask AI Assistant</span>
          </div>
          <div className="ask-ai-chat-subtitle">
            Ask me anything about your work progress
          </div>
        </Card.Header>
        
        <Card.Body className="ask-ai-chat-body">
          <div className="ask-ai-chat-messages">
            {messages.map((message) => (
              <div 
                key={message.id} 
                className={`ask-ai-chat-message ${message.type} ${message.source ? `source-${message.source}` : ''}`}
              >
                <div className="ask-ai-chat-message-icon">
                  <FontAwesomeIcon icon={getMessageIcon(message)} />
                </div>
                <div className="ask-ai-chat-message-content">
                  <div className="ask-ai-chat-message-text">{message.text}</div>
                  {getSourceLabel(message) && (
                    <div className="ask-ai-chat-message-source">{getSourceLabel(message)}</div>
                  )}
                  <div className="ask-ai-chat-message-time">{formatTime(message.timestamp)}</div>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="ask-ai-chat-message ai loading">
                <div className="ask-ai-chat-message-icon">
                  <FontAwesomeIcon icon={faRobot} />
                </div>
                <div className="ask-ai-chat-message-content">
                  <div className="ask-ai-chat-message-text">
                    <Spinner animation="border" size="sm" /> Thinking...
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </Card.Body>
        
        <Card.Footer className="ask-ai-chat-footer">
          <Form onSubmit={handleSubmit}>
            <div className="ask-ai-chat-input-container">
              <Form.Control
                ref={inputRef}
                type="text"
                placeholder="Ask a question about your work..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                disabled={isLoading}
                className="ask-ai-chat-input"
              />
              <Button 
                variant="primary"
                type="submit" 
                disabled={isLoading || !inputValue.trim()}
                className="ask-ai-chat-send-button"
              >
                <FontAwesomeIcon icon={faPaperPlane} />
              </Button>
            </div>
            {error && <div className="ask-ai-chat-error">{error}</div>}
          </Form>
        </Card.Footer>
      </Card>
    </div>
  );
};

export default AskAIChat; 