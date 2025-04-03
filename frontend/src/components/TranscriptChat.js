import React, { useState, useRef, useEffect } from 'react';
import { Form, Button, Spinner } from 'react-bootstrap';
import axios from 'axios';
import config from '../config';

/**
 * TranscriptChat component allows users to chat with an AI about their transcript
 * after the document has been generated.
 */
const TranscriptChat = ({ transcript, onClose }) => {
  const [messages, setMessages] = useState([
    { 
      id: 'welcome', 
      role: 'ai', 
      content: 'Hello! I can answer questions about your meeting transcript. What would you like to know?' 
    }
  ]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  
  // Focus input when component mounts
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);
  
  // Scroll to bottom of chat whenever messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);
  
  // Handle sending a new message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!newMessage.trim()) return;
    
    // Add user message to chat
    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: newMessage
    };
    
    setMessages(prev => [...prev, userMessage]);
    setNewMessage('');
    setIsLoading(true);
    
    try {
      // Prepare mock thinking message
      const thinkingMessage = {
        id: 'thinking',
        role: 'ai',
        content: '...',
        isThinking: true
      };
      
      setMessages(prev => [...prev, thinkingMessage]);
      
      // Send message to backend for LLM completion
      const response = await axios.post(`${config.API_URL}/api/chat`, {
        message: newMessage,
        transcript: transcript
      });
      
      // Remove thinking message and add real response
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== 'thinking');
        return [...filtered, {
          id: (Date.now() + 1).toString(),
          role: 'ai',
          content: response.data.response || 'I\'ve analyzed your transcript and here are my findings.'
        }];
      });
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Remove thinking message and add error message
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== 'thinking');
        return [...filtered, {
          id: (Date.now() + 1).toString(),
          role: 'ai',
          content: 'Sorry, I encountered an error processing your request. Please try again.'
        }];
      });
      
      // Try to give more specific error messages based on the error type
      let errorMessage = 'An error occurred while processing your request.';
      
      if (error.response) {
        // Server returned an error response
        if (error.response.status === 429) {
          errorMessage = 'You\'ve sent too many requests. Please wait a moment before trying again.';
        } else if (error.response.status === 500) {
          errorMessage = 'The server encountered an error. This might be due to high traffic or service limitations.';
        }
      } else if (error.request) {
        // Request was made but no response received
        errorMessage = 'Unable to reach the server. Please check your connection and try again.';
      }
      
      console.log('Error details:', errorMessage);
    } finally {
      setIsLoading(false);
      // Refocus on input
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  };
  
  const handleKeyDown = (e) => {
    // Send message on Enter (but not with Shift+Enter)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };
  
  // Examples of common questions to ask
  const exampleQuestions = [
    "What were the main topics discussed?",
    "Summarize the key decisions made",
    "Who were the main participants?",
    "What action items were assigned?",
    "When is the next meeting scheduled?"
  ];
  
  const handleExampleClick = (question) => {
    setNewMessage(question);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };
  
  return (
    <div className="transcript-chat">
      <div className="chat-message-container">
        {messages.map(message => (
          <div 
            key={message.id} 
            className={`chat-message ${message.role}`}
          >
            {message.isThinking ? (
              <div className="thinking-indicator">
                <Spinner animation="grow" size="sm" className="me-1" />
                <Spinner animation="grow" size="sm" className="me-1" />
                <Spinner animation="grow" size="sm" />
              </div>
            ) : (
              message.content
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      {messages.length === 1 && (
        <div className="example-questions mt-3 mb-3">
          <p className="text-muted mb-2">Try asking:</p>
          <div className="d-flex flex-wrap gap-2">
            {exampleQuestions.map((question, index) => (
              <Button 
                key={index}
                variant="outline-secondary"
                size="sm"
                onClick={() => handleExampleClick(question)}
                className="example-question-btn"
              >
                {question}
              </Button>
            ))}
          </div>
        </div>
      )}
      
      <Form onSubmit={handleSendMessage} className="chat-input-container">
        <Form.Control
          ref={inputRef}
          as="textarea"
          rows={1}
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question about your meeting..."
          disabled={isLoading}
        />
        <Button 
          variant="primary" 
          type="submit" 
          disabled={isLoading || !newMessage.trim()}
        >
          <i className="bi bi-send-fill"></i>
        </Button>
      </Form>
      
      <div className="chat-action-buttons">
        <Button 
          variant="outline-secondary" 
          size="sm" 
          onClick={onClose}
        >
          Close Chat
        </Button>
      </div>
    </div>
  );
};

export default TranscriptChat; 