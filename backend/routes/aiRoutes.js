/**
 * AI Routes for chat functionality
 */

const express = require('express');
const router = express.Router();
const { authenticateJWT } = require('../middleware/auth');
const { supabase } = require('../supabaseClient');
const { OpenAI } = require('openai');
const config = require('../config');

// Configure OpenAI API with the latest client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || config.OPENAI_API_KEY,
});

/**
 * Health check endpoint for AI service
 */
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'AI API is running' });
});

/**
 * Answer a natural language question about work
 */
router.post('/ask', authenticateJWT, async (req, res) => {
  try {
    const { user_id } = req.user;
    const { query, date_range } = req.body;
    
    console.log(`Processing AI query for user ${user_id}: ${query}`);
    
    // Fetch relevant data based on the query and date range
    let tasksData = [];
    let accomplishmentsData = [];
    
    // Fetch tasks
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user_id)
      .gte('created_at', date_range.start_date)
      .lte('created_at', date_range.end_date);
    
    if (tasksError) {
      console.error('Error fetching tasks for AI query:', tasksError);
    } else {
      tasksData = tasks;
      console.log(`Retrieved ${tasksData.length} tasks for AI context`);
    }
    
    // Fetch accomplishments
    const { data: accomplishments, error: accompError } = await supabase
      .from('accomplishments')
      .select('*')
      .eq('user_id', user_id)
      .gte('accomplishment_date', date_range.start_date)
      .lte('accomplishment_date', date_range.end_date);
    
    if (accompError) {
      console.error('Error fetching accomplishments for AI query:', accompError);
    } else {
      accomplishmentsData = accomplishments;
      console.log(`Retrieved ${accomplishmentsData.length} accomplishments for AI context`);
    }
    
    // Prepare the prompt
    const systemPrompt = "You are an AI assistant that answers questions about a user's work data. Provide concise, accurate answers based on the data provided.";
    
    const prompt = `Please answer the following question based on my work data:
${query}

Data for time period ${date_range.start_date} to ${date_range.end_date}:
Tasks: ${JSON.stringify(tasksData, null, 2)}
Accomplishments: ${JSON.stringify(accomplishmentsData, null, 2)}

Provide a concise, factual answer based only on the data provided.`;
    
    console.log('Calling OpenAI API...');
    
    // Call OpenAI API with updated client
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ],
      max_tokens: 500,
      temperature: 0.3,
    });
    
    const answer = completion.choices[0].message.content;
    console.log('Received answer from OpenAI');
    
    return res.status(200).json({
      query: query,
      answer: answer,
      date_range: date_range
    });
  } catch (error) {
    console.error('Error in POST /ai/ask route:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

/**
 * AI-based answering from daily work info
 */
router.post('/answer-from-context', authenticateJWT, async (req, res) => {
  try {
    const { user_id } = req.user;
    const { query, daily_info, date_range } = req.body;
    
    console.log(`Processing context-based AI query for user ${user_id}: ${query}`);
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    // Extract summaries from daily info
    const dailySummaries = daily_info && Array.isArray(daily_info) 
      ? daily_info.map(day => day.summary).join('\n')
      : 'No daily information available.';
    
    // Prepare the prompt
    const systemPrompt = "You are an AI assistant that answers questions about a user's work activities. Provide concise, accurate answers based on the daily work summaries provided. If the data doesn't contain a clear answer, be honest about the limitations.";
    
    const userPrompt = `Please answer the following question based on my work data:
${query}

Here are summaries of my daily work activities:
${dailySummaries}

Time period: ${date_range?.start_date || 'unknown'} to ${date_range?.end_date || 'unknown'}

Please provide a concise, factual answer based only on the information provided. If you can't answer clearly from the provided data, acknowledge the limitations.`;
    
    console.log('Calling OpenAI API for context-based answer...');
    
    // Call OpenAI API with updated client
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      max_tokens: 500,
      temperature: 0.3,
    });
    
    const answer = completion.choices[0].message.content;
    console.log('Received context-based answer from OpenAI');
    
    return res.status(200).json({
      query: query,
      answer: answer,
      date_range: date_range
    });
  } catch (error) {
    console.error('Error in POST /ai/answer-from-context route:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

module.exports = router; 