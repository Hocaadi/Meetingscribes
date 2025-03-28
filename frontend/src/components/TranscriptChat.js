import React, { useState, useRef, useEffect } from 'react';
import { Card, Form, Button, Spinner } from 'react-bootstrap';
import axios from 'axios';
import config from '../config';

/**
 * TranscriptChat component allows users to chat with an AI about their transcript
 * after the document has been generated.
 */
const TranscriptChat = ({ transcript, sessionId }) => {
  const [messages, setMessages] = useState([
    { 
      id: 'welcome', 
      role: 'assistant', 
      content: 'Hello! I can answer questions about your meeting transcript. What would you like to know?' 
    }
  ]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  
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
      // Send message to backend for LLM completion
      const response = await axios.post(`${config.API_URL}/api/chat`, {
        message: newMessage,
        sessionId,
        transcript
      });
      
      // Add assistant response to chat
      const assistantMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.data.response
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Add error message to chat
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request. Please try again.'
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleKeyDown = (e) => {
    // Send message on Enter (but not with Shift+Enter)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };
  
  return (
    <Card className="mt-4 mb-4 transcript-chat">
      <Card.Header className="d-flex justify-content-between align-items-center">
        <div>
          <i className="bi bi-chat-dots-fill me-2" style={{ color: '#4a86e8' }}></i>
          <span>Chat with Transcript</span>
        </div>
      </Card.Header>
      
      <Card.Body>
        <div className="messages-container" style={{ height: '300px', overflowY: 'auto', marginBottom: '15px' }}>
          {messages.map(message => (
            <div 
              key={message.id} 
              className={`message ${message.role === 'user' ? 'user-message' : 'assistant-message'}`}
              style={{
                padding: '10px 15px',
                marginBottom: '10px',
                borderRadius: '10px',
                maxWidth: '80%',
                alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
                backgroundColor: message.role === 'user' ? '#e9f0ff' : '#f0f2f5',
                marginLeft: message.role === 'user' ? 'auto' : '0',
                marginRight: message.role === 'user' ? '0' : 'auto',
                display: 'block'
              }}
            >
              {message.content}
            </div>
          ))}
          <div ref={messagesEndRef} />
          
          {isLoading && (
            <div className="text-center mt-2 mb-2">
              <Spinner animation="border" variant="primary" size="sm" />
              <span className="ms-2">Thinking...</span>
            </div>
          )}
        </div>
        
        <Form onSubmit={handleSendMessage}>
          <div className="d-flex">
            <Form.Control
              as="textarea"
              rows={2}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about your meeting transcript..."
              disabled={isLoading}
              style={{ resize: 'none' }}
            />
            <Button 
              variant="primary" 
              type="submit" 
              disabled={isLoading || !newMessage.trim()} 
              className="ms-2"
              style={{ alignSelf: 'flex-end' }}
            >
              <i className="bi bi-send"></i>
            </Button>
          </div>
        </Form>
      </Card.Body>
    </Card>
  );
};

export default TranscriptChat; 