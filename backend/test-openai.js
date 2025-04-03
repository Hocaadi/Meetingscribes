const { OpenAI } = require('openai');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function testApiKey() {
  try {
    console.log('Testing OpenAI API key...');
    // Simple completion to test the API key
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "system", content: "You are a helpful assistant." }],
      max_tokens: 10
    });
    
    console.log('API key is valid. Response:', response);
    console.log('Success! Your OpenAI API key is working correctly.');
  } catch (error) {
    console.error('Error testing OpenAI API key:');
    console.error('Status:', error.status);
    console.error('Message:', error.message);
    console.error('Type:', error.type);
    
    // Check specific error types
    if (error.type === 'invalid_request_error') {
      console.error('This appears to be an invalid request. Check your API key format.');
    } else if (error.type === 'invalid_api_key') {
      console.error('Your API key is invalid or expired.');
    } else if (error.type === 'rate_limit_exceeded') {
      console.error('You have exceeded your API rate limit or quota.');
    }
  }
}

// Run the test
testApiKey(); 