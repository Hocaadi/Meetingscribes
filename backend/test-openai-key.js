// Test script to verify OpenAI API key
const { OpenAI } = require('openai');
const config = require('./config');

async function testOpenAIKey() {
  console.log('Testing OpenAI API key connection...');
  console.log('Using OpenAI API key:', config.OPENAI_API_KEY.substring(0, 10) + '...');
  
  try {
    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: config.OPENAI_API_KEY,
    });
    
    // Make a simple API call
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Test message to verify API key." }
      ],
      max_tokens: 50,
    });
    
    console.log('OpenAI API key is working! Received response:');
    console.log('--------------------------------------------');
    console.log(completion.choices[0].message.content);
    console.log('--------------------------------------------');
    console.log('Model used:', completion.model);
    console.log('Request successful!');
    return true;
  } catch (error) {
    console.error('Error with OpenAI API key:', error);
    console.error('Please check your API key and try again.');
    return false;
  }
}

// Execute the test function
testOpenAIKey()
  .then(success => {
    if (success) {
      console.log('Test completed successfully.');
    } else {
      console.log('Test failed. Check the error message above.');
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('Unexpected error:', err);
    process.exit(1);
  }); 