const express = require('express');
const router = express.Router();
const { authenticateJWT } = require('../middleware/auth');
const { supabase } = require('../services/supabaseService');
const { OpenAI } = require('openai');
const config = require('../config');

// Configure OpenAI API with the latest client
const openai = new OpenAI({
  apiKey: config.OPENAI_API_KEY,
});

/**
 * Get tasks for the authenticated user
 */
router.get('/tasks', authenticateJWT, async (req, res) => {
  try {
    const { user_id } = req.user;
    
    // Extract query parameters for filtering
    const status = req.query.status;
    const priority = req.query.priority;
    const dueDate = req.query.due_date;
    
    // Build the query
    let query = supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user_id);
    
    // Apply filters if provided
    if (status) {
      // Check if status is an array (comma-separated string from query params)
      if (status.includes(',')) {
        query = query.in('status', status.split(','));
      } else {
        query = query.eq('status', status);
      }
    }
    
    if (priority) {
      query = query.eq('priority', Number(priority));
    }
    
    if (dueDate) {
      query = query.lte('due_date', dueDate);
    }
    
    // Execute the query
    const { data, error } = await query
      .order('priority', { ascending: true })
      .order('due_date', { ascending: true });
    
    if (error) {
      console.error('Error fetching tasks:', error);
      return res.status(500).json({ error: 'Failed to fetch tasks' });
    }
    
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error in /tasks route:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Create a new task
 */
router.post('/tasks', authenticateJWT, async (req, res) => {
  try {
    const { user_id } = req.user;
    const { title, description, priority, status, due_date, tags, estimated_minutes } = req.body;
    
    // Validate required fields
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    
    // Create the task
    const { data, error } = await supabase
      .from('tasks')
      .insert([{
        user_id,
        title,
        description,
        priority: priority || 3,
        status: status || 'not_started',
        due_date,
        tags,
        estimated_minutes
      }])
      .select();
    
    if (error) {
      console.error('Error creating task:', error);
      return res.status(500).json({ error: 'Failed to create task' });
    }
    
    return res.status(201).json(data[0]);
  } catch (error) {
    console.error('Error in POST /tasks route:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Update a task
 */
router.put('/tasks/:id', authenticateJWT, async (req, res) => {
  try {
    const { user_id } = req.user;
    const { id } = req.params;
    const updates = req.body;
    
    // Verify ownership of the task
    const { data: taskData, error: taskError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', id)
      .eq('user_id', user_id)
      .single();
    
    if (taskError || !taskData) {
      return res.status(404).json({ error: 'Task not found or unauthorized' });
    }
    
    // Update the task
    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .select();
    
    if (error) {
      console.error('Error updating task:', error);
      return res.status(500).json({ error: 'Failed to update task' });
    }
    
    return res.status(200).json(data[0]);
  } catch (error) {
    console.error('Error in PUT /tasks/:id route:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Delete a task
 */
router.delete('/tasks/:id', authenticateJWT, async (req, res) => {
  try {
    const { user_id } = req.user;
    const { id } = req.params;
    
    // Verify ownership of the task
    const { data: taskData, error: taskError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', id)
      .eq('user_id', user_id)
      .single();
    
    if (taskError || !taskData) {
      return res.status(404).json({ error: 'Task not found or unauthorized' });
    }
    
    // Delete the task
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error deleting task:', error);
      return res.status(500).json({ error: 'Failed to delete task' });
    }
    
    return res.status(204).send();
  } catch (error) {
    console.error('Error in DELETE /tasks/:id route:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Mark a task as completed
 */
router.post('/tasks/:id/complete', authenticateJWT, async (req, res) => {
  try {
    const { user_id } = req.user;
    const { id } = req.params;
    
    // Verify ownership of the task
    const { data: taskData, error: taskError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', id)
      .eq('user_id', user_id)
      .single();
    
    if (taskError || !taskData) {
      return res.status(404).json({ error: 'Task not found or unauthorized' });
    }
    
    // Mark the task as completed
    const { data, error } = await supabase
      .from('tasks')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', id)
      .select();
    
    if (error) {
      console.error('Error completing task:', error);
      return res.status(500).json({ error: 'Failed to complete task' });
    }
    
    return res.status(200).json(data[0]);
  } catch (error) {
    console.error('Error in POST /tasks/:id/complete route:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get work sessions for the authenticated user
 */
router.get('/sessions', authenticateJWT, async (req, res) => {
  try {
    const { user_id } = req.user;
    const { start_date, end_date } = req.query;
    
    // Build the query
    let query = supabase
      .from('work_sessions')
      .select('*')
      .eq('user_id', user_id);
    
    // Apply date range filter if provided
    if (start_date) {
      query = query.gte('start_time', start_date);
    }
    
    if (end_date) {
      query = query.lte('start_time', end_date);
    }
    
    // Execute the query
    const { data, error } = await query
      .order('start_time', { ascending: false });
    
    if (error) {
      console.error('Error fetching work sessions:', error);
      return res.status(500).json({ error: 'Failed to fetch work sessions' });
    }
    
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error in GET /sessions route:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Start a new work session
 */
router.post('/sessions/start', authenticateJWT, async (req, res) => {
  try {
    const { user_id } = req.user;
    
    // Check if there's already an active session
    const { data: existingSession, error: sessionError } = await supabase
      .from('work_sessions')
      .select('*')
      .eq('user_id', user_id)
      .eq('is_active', true)
      .maybeSingle();
    
    if (sessionError) {
      console.error('Error checking for active session:', sessionError);
      return res.status(500).json({ error: 'Failed to check for active session' });
    }
    
    // If there's an active session, return it
    if (existingSession) {
      return res.status(200).json({
        session: existingSession,
        message: 'There is already an active session'
      });
    }
    
    // Create a new work session
    const { data, error } = await supabase
      .from('work_sessions')
      .insert([{
        user_id,
        start_time: new Date().toISOString(),
        status: 'active',
        is_active: true
      }])
      .select();
    
    if (error) {
      console.error('Error starting work session:', error);
      return res.status(500).json({ error: 'Failed to start work session' });
    }
    
    return res.status(201).json(data[0]);
  } catch (error) {
    console.error('Error in POST /sessions/start route:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * End a work session
 */
router.post('/sessions/:id/end', authenticateJWT, async (req, res) => {
  try {
    const { user_id } = req.user;
    const { id } = req.params;
    
    // Verify ownership of the session
    const { data: sessionData, error: sessionError } = await supabase
      .from('work_sessions')
      .select('*')
      .eq('id', id)
      .eq('user_id', user_id)
      .single();
    
    if (sessionError || !sessionData) {
      return res.status(404).json({ error: 'Session not found or unauthorized' });
    }
    
    // End the session
    const { data, error } = await supabase
      .from('work_sessions')
      .update({
        end_time: new Date().toISOString(),
        status: 'completed',
        is_active: false
      })
      .eq('id', id)
      .select();
    
    if (error) {
      console.error('Error ending work session:', error);
      return res.status(500).json({ error: 'Failed to end work session' });
    }
    
    return res.status(200).json(data[0]);
  } catch (error) {
    console.error('Error in POST /sessions/:id/end route:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Generate a status report using AI
 */
router.post('/ai/generate-report', authenticateJWT, async (req, res) => {
  try {
    const { user_id } = req.user;
    const { report_type, tasks, accomplishments, date_range } = req.body;
    
    // Format tasks and accomplishments for GPT
    const formattedTasks = tasks.map(task => ({
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      due_date: task.due_date
    }));
    
    const formattedAccomplishments = accomplishments.map(acc => ({
      title: acc.title,
      description: acc.description,
      date: acc.accomplishment_date,
      impact: acc.impact_level
    }));
    
    // Prepare the prompt based on report type
    let prompt = '';
    let systemPrompt = '';
    
    if (report_type === 'morning') {
      systemPrompt = "You are an AI assistant helping a professional generate a morning plan. Your response should be concise, actionable, and focus on what they need to accomplish today.";
      prompt = `Please generate a morning plan based on the following tasks:
${JSON.stringify(formattedTasks, null, 2)}

Include:
1. A brief greeting and summary of the day ahead
2. Top 3 priority tasks to focus on
3. Any meetings or time-sensitive items
4. A brief motivational note

Format the response in a professional tone suitable for status updates.`;
    } else if (report_type === 'evening') {
      systemPrompt = "You are an AI assistant helping a professional summarize their day's accomplishments. Your response should be concise, highlight achievements, and note any remaining work.";
      prompt = `Please generate an evening summary based on the following tasks and accomplishments:
Tasks: ${JSON.stringify(formattedTasks, null, 2)}
Accomplishments: ${JSON.stringify(formattedAccomplishments, null, 2)}

Include:
1. A brief summary of what was accomplished today
2. Mention specific completed tasks and their impact
3. Note any blockers or issues encountered
4. Brief mention of what's planned for tomorrow

Format the response in a professional tone suitable for status updates.`;
    } else if (report_type === 'weekly') {
      systemPrompt = "You are an AI assistant helping a professional generate a weekly report. Your response should summarize achievements, progress on major projects, and outline next steps.";
      prompt = `Please generate a weekly report based on the following tasks and accomplishments:
Tasks: ${JSON.stringify(formattedTasks, null, 2)}
Accomplishments: ${JSON.stringify(formattedAccomplishments, null, 2)}
Time period: ${date_range.start_date} to ${date_range.end_date}

Include:
1. A summary of the week's achievements
2. Progress on key projects/tasks
3. Any blockers or issues encountered
4. Plan for the upcoming week
5. Any additional resources needed

Format the response in a professional tone suitable for management reviews.`;
    }
    
    // Call OpenAI API with the updated client
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ],
      max_tokens: 800,
      temperature: 0.7,
    });
    
    const reportContent = completion.choices[0].message.content;
    
    // Prepare the tasks lists for saving in the database
    const tasksCompleted = accomplishments.map(acc => acc.title);
    const tasksInProgress = tasks
      .filter(task => task.status === 'in_progress')
      .map(task => task.title);
    
    // Extract potential blockers from blocked tasks
    const blockers = tasks
      .filter(task => task.status === 'blocked')
      .map(task => `${task.title}: ${task.description || 'No description'}`);
    
    // Determine next steps from not started tasks with high priority
    const nextSteps = tasks
      .filter(task => (task.status === 'not_started' || task.status === 'in_progress') && (task.priority === 1 || task.priority === 2))
      .map(task => task.title)
      .slice(0, 5);
    
    // Return the generated report
    return res.status(200).json({
      content: reportContent,
      report_type: report_type,
      tasks_completed: tasksCompleted,
      tasks_in_progress: tasksInProgress,
      blockers: blockers,
      next_steps: nextSteps
    });
  } catch (error) {
    console.error('Error in POST /ai/generate-report route:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Analyze work patterns using AI
 */
router.post('/ai/analyze-work', authenticateJWT, async (req, res) => {
  try {
    const { user_id } = req.user;
    const { tasks, work_sessions, activity_logs, date_range } = req.body;
    
    // Prepare the prompt
    const systemPrompt = "You are an AI work productivity analyst. Analyze the user's work patterns and provide insights and recommendations to improve productivity.";
    
    const prompt = `Please analyze my work patterns based on the following data:
Tasks: ${JSON.stringify(tasks, null, 2)}
Date range: ${date_range.start_date} to ${date_range.end_date}

Please provide:
1. An insight about my productivity patterns
2. An insight about my task completion habits
3. 2-3 specific recommendations to improve my productivity
`;
    
    // Call OpenAI API with updated client
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ],
      max_tokens: 800,
      temperature: 0.7,
    });
    
    const analysisText = completion.choices[0].message.content;
    
    // Parse the analysis into sections (this is a simple approach; in production you might want more robust parsing)
    const sections = analysisText.split('\n\n');
    
    // Extract the sections (this is a simplistic approach)
    let productivityInsight = '';
    let accomplishmentInsight = '';
    let recommendations = '';
    
    for (const section of sections) {
      if (section.toLowerCase().includes('productivity') || section.toLowerCase().includes('pattern')) {
        productivityInsight = section;
      } else if (section.toLowerCase().includes('task completion') || section.toLowerCase().includes('accomplish')) {
        accomplishmentInsight = section;
      } else if (section.toLowerCase().includes('recommendation') || section.toLowerCase().includes('suggest')) {
        recommendations = section;
      }
    }
    
    // If we couldn't identify clear sections, use the whole text as recommendations
    if (!productivityInsight && !accomplishmentInsight && !recommendations) {
      recommendations = analysisText;
    }
    
    return res.status(200).json({
      productivity_insight: productivityInsight,
      accomplishment_insight: accomplishmentInsight,
      recommendations: recommendations,
      full_analysis: analysisText
    });
  } catch (error) {
    console.error('Error in POST /ai/analyze-work route:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Answer a natural language question about work
 */
router.post('/ai/ask', authenticateJWT, async (req, res) => {
  try {
    const { user_id } = req.user;
    const { query, date_range } = req.body;
    
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
    }
    
    // Prepare the prompt
    const systemPrompt = "You are an AI assistant that answers questions about a user's work data. Provide concise, accurate answers based on the data provided.";
    
    const prompt = `Please answer the following question based on my work data:
${query}

Data for time period ${date_range.start_date} to ${date_range.end_date}:
Tasks: ${JSON.stringify(tasksData, null, 2)}
Accomplishments: ${JSON.stringify(accomplishmentsData, null, 2)}

Provide a concise, factual answer based only on the data provided.`;
    
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
    
    return res.status(200).json({
      query: query,
      answer: answer,
      date_range: date_range
    });
  } catch (error) {
    console.error('Error in POST /ai/ask route:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get daily work information for the authenticated user
 */
router.get('/daily-info', authenticateJWT, async (req, res) => {
  try {
    const { user_id } = req.user;
    const { start_date, end_date } = req.query;
    
    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'Start and end dates are required' });
    }
    
    // Get work sessions for the date range
    const { data: sessions, error: sessionsError } = await supabase
      .from('work_sessions')
      .select('*')
      .eq('user_id', user_id)
      .gte('start_time', start_date)
      .lte('end_time', end_date);
    
    if (sessionsError) {
      console.error('Error fetching work sessions for daily info:', sessionsError);
      return res.status(500).json({ error: 'Failed to fetch work sessions' });
    }
    
    // Get tasks updated in the date range
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user_id)
      .gte('updated_at', start_date)
      .lte('updated_at', end_date);
    
    if (tasksError) {
      console.error('Error fetching tasks for daily info:', tasksError);
      return res.status(500).json({ error: 'Failed to fetch tasks' });
    }
    
    // Get accomplishments in the date range
    const { data: accomplishments, error: accompError } = await supabase
      .from('accomplishments')
      .select('*')
      .eq('user_id', user_id)
      .gte('accomplishment_date', start_date)
      .lte('accomplishment_date', end_date);
    
    if (accompError) {
      console.error('Error fetching accomplishments for daily info:', accompError);
      return res.status(500).json({ error: 'Failed to fetch accomplishments' });
    }
    
    // Get activity logs in the date range
    const { data: activityLogs, error: logsError } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('user_id', user_id)
      .gte('log_date', start_date)
      .lte('log_date', end_date);
    
    if (logsError) {
      console.error('Error fetching activity logs for daily info:', logsError);
      return res.status(500).json({ error: 'Failed to fetch activity logs' });
    }
    
    // Get status reports in the date range
    const { data: reports, error: reportsError } = await supabase
      .from('status_reports')
      .select('*')
      .eq('user_id', user_id)
      .gte('report_date', start_date)
      .lte('report_date', end_date);
    
    if (reportsError) {
      console.error('Error fetching status reports for daily info:', reportsError);
      return res.status(500).json({ error: 'Failed to fetch status reports' });
    }
    
    // Group data by date
    const dailyInfo = {};
    
    // Helper to get date only from datetime
    const getDateOnly = (datetime) => datetime.split('T')[0];
    
    // Process sessions
    sessions.forEach(session => {
      const date = getDateOnly(session.start_time);
      
      if (!dailyInfo[date]) {
        dailyInfo[date] = {
          date,
          sessions: [],
          tasks: [],
          accomplishments: [],
          activity_logs: [],
          status_reports: [],
          summary: ''
        };
      }
      
      dailyInfo[date].sessions.push(session);
    });
    
    // Process tasks
    tasks.forEach(task => {
      const date = getDateOnly(task.updated_at);
      
      if (!dailyInfo[date]) {
        dailyInfo[date] = {
          date,
          sessions: [],
          tasks: [],
          accomplishments: [],
          activity_logs: [],
          status_reports: [],
          summary: ''
        };
      }
      
      dailyInfo[date].tasks.push(task);
    });
    
    // Process accomplishments
    accomplishments.forEach(acc => {
      const date = getDateOnly(acc.accomplishment_date);
      
      if (!dailyInfo[date]) {
        dailyInfo[date] = {
          date,
          sessions: [],
          tasks: [],
          accomplishments: [],
          activity_logs: [],
          status_reports: [],
          summary: ''
        };
      }
      
      dailyInfo[date].accomplishments.push(acc);
    });
    
    // Process activity logs
    activityLogs.forEach(log => {
      const date = getDateOnly(log.log_date);
      
      if (!dailyInfo[date]) {
        dailyInfo[date] = {
          date,
          sessions: [],
          tasks: [],
          accomplishments: [],
          activity_logs: [],
          status_reports: [],
          summary: ''
        };
      }
      
      dailyInfo[date].activity_logs.push(log);
    });
    
    // Process status reports
    reports.forEach(report => {
      const date = getDateOnly(report.report_date);
      
      if (!dailyInfo[date]) {
        dailyInfo[date] = {
          date,
          sessions: [],
          tasks: [],
          accomplishments: [],
          activity_logs: [],
          status_reports: [],
          summary: ''
        };
      }
      
      dailyInfo[date].status_reports.push(report);
    });
    
    // Generate summaries for each day
    Object.keys(dailyInfo).forEach(date => {
      const day = dailyInfo[date];
      
      // Build a summary based on available data
      let summary = `On ${date}: `;
      
      // Add session info
      if (day.sessions.length > 0) {
        const totalHours = day.sessions.reduce((total, session) => {
          if (session.end_time) {
            const start = new Date(session.start_time);
            const end = new Date(session.end_time);
            const hoursWorked = (end - start) / (1000 * 60 * 60);
            return total + hoursWorked;
          }
          return total;
        }, 0).toFixed(1);
        
        summary += `Worked for ${totalHours} hours. `;
      }
      
      // Add accomplishments info
      if (day.accomplishments.length > 0) {
        summary += `Completed ${day.accomplishments.length} accomplishments: `;
        day.accomplishments.forEach((acc, index) => {
          if (index < 3) {
            summary += `${acc.title}${index < day.accomplishments.length - 1 && index < 2 ? ', ' : ''}`;
          }
        });
        if (day.accomplishments.length > 3) {
          summary += ` and ${day.accomplishments.length - 3} more. `;
        } else {
          summary += '. ';
        }
      }
      
      // Add tasks info
      if (day.tasks.length > 0) {
        const completedTasks = day.tasks.filter(task => task.status === 'completed');
        const inProgressTasks = day.tasks.filter(task => task.status === 'in_progress');
        
        if (completedTasks.length > 0) {
          summary += `Completed ${completedTasks.length} tasks. `;
        }
        
        if (inProgressTasks.length > 0) {
          summary += `Worked on ${inProgressTasks.length} in-progress tasks. `;
        }
      }
      
      // Add activity logs info
      if (day.activity_logs.length > 0) {
        summary += `Recorded ${day.activity_logs.length} activities. `;
      }
      
      // Add status report info
      if (day.status_reports.length > 0) {
        summary += `Generated ${day.status_reports.length} status reports. `;
      }
      
      day.summary = summary;
    });
    
    // Convert to array and sort by date
    const dailyInfoArray = Object.values(dailyInfo).sort((a, b) => 
      new Date(b.date) - new Date(a.date)
    );
    
    return res.status(200).json(dailyInfoArray);
  } catch (error) {
    console.error('Error in GET /daily-info route:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * AI-based answering from daily work info
 */
router.post('/ai/answer-from-context', authenticateJWT, async (req, res) => {
  try {
    const { user_id } = req.user;
    const { query, daily_info, date_range } = req.body;
    
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
    
    return res.status(200).json({
      query: query,
      answer: answer,
      date_range: date_range
    });
  } catch (error) {
    console.error('Error in POST /ai/answer-from-context route:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 