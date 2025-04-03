import React, { useState } from 'react';
import AskAIButton from './AskAIButton';
import AskAIChat from './AskAIChat';

/**
 * Container component for the Ask AI feature that manages state
 * and integrates both the button and chat components
 */
const AskAIContainer = () => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  
  const toggleChat = () => {
    setIsChatOpen(prevState => !prevState);
  };
  
  return (
    <>
      <AskAIButton 
        onClick={toggleChat} 
        isOpen={isChatOpen} 
      />
      <AskAIChat 
        isOpen={isChatOpen} 
        onClose={() => setIsChatOpen(false)} 
      />
    </>
  );
};

export default AskAIContainer; 