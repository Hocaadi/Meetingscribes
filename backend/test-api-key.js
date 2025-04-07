require('dotenv').config();
const { OpenAI } = require('openai');

// Load API key from .env
const apiKey = process.env.OPENAI_API_KEY;

console.log('Testing OpenAI API key...');
console.log('API Key (first 10 chars):', apiKey.substring(0, 10) + '...');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: apiKey
});

async function testApiKey() {
  try {
    // Attempt a simple completion to verify the API key works
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello, are you working?' }
      ],
      max_tokens: 50
    });

    console.log('API Key is valid! Response:');
    console.log(response.choices[0].message.content);
    return true;
  } catch (error) {
    console.error('Error testing API key:');
    console.error(error.message);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    
    return false;
  }
}

// Run the test
testApiKey()
  .then(isValid => {
    if (isValid) {
      console.log('✅ API key is configured correctly.');
    } else {
      console.log('❌ API key is not working. Please check your configuration.');
    }
  })
  .catch(err => {
    console.error('Unexpected error during testing:', err);
  }); 