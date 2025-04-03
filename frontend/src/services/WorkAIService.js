import axios from 'axios';
import config from '../config';

/**
 * Service for handling AI interactions for the Work & Progress module
 */
class WorkAIService {
  /**
   * Generate an AI-powered status report based on work data
   * @param {Object} data - Work data to use for generating the report
   * @returns {Promise<Object>} The generated status report
   */
  async generateStatusReport(data) {
    try {
      const response = await axios.post(`${config.API_URL}/api/ai/generate-report`, {
        report_type: data.report_type,
        tasks: data.tasks,
        accomplishments: data.accomplishments,
        date_range: data.date_range,
        user_info: data.user_info
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        withCredentials: true
      });
      
      return response.data;
    } catch (error) {
      console.error('Error generating AI status report:', error);
      throw error;
    }
  }
  
  /**
   * Analyze work patterns and provide insights
   * @param {Object} data - Work data to analyze
   * @returns {Promise<Object>} Analysis results and recommendations
   */
  async analyzeWorkPatterns(data) {
    try {
      const response = await axios.post(`${config.API_URL}/api/ai/analyze-work`, {
        work_sessions: data.work_sessions,
        tasks: data.tasks,
        activity_logs: data.activity_logs,
        date_range: data.date_range
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        withCredentials: true
      });
      
      return response.data;
    } catch (error) {
      console.error('Error analyzing work patterns:', error);
      throw error;
    }
  }
  
  /**
   * Predict a task's duration based on historical data
   * @param {Object} task - Task to predict duration for
   * @returns {Promise<Object>} Prediction results
   */
  async predictTaskDuration(task) {
    try {
      const response = await axios.post(`${config.API_URL}/api/ai/predict-duration`, {
        task_title: task.title,
        task_description: task.description,
        task_tags: task.tags,
        similar_completed_tasks: task.similar_completed_tasks
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        withCredentials: true
      });
      
      return response.data;
    } catch (error) {
      console.error('Error predicting task duration:', error);
      throw error;
    }
  }
  
  /**
   * Suggest task prioritization based on deadlines, importance, and dependencies
   * @param {Array} tasks - Tasks to prioritize
   * @returns {Promise<Array>} Prioritized tasks with reasoning
   */
  async suggestTaskPriorities(tasks) {
    try {
      const response = await axios.post(`${config.API_URL}/api/ai/prioritize-tasks`, {
        tasks
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        withCredentials: true
      });
      
      return response.data;
    } catch (error) {
      console.error('Error suggesting task priorities:', error);
      throw error;
    }
  }
  
  /**
   * Generate a professional brag sheet from accomplishments
   * @param {Array} accomplishments - Accomplishments to include
   * @param {Object} options - Formatting options
   * @returns {Promise<Object>} Generated brag sheet
   */
  async generateBragSheet(accomplishments, options = {}) {
    try {
      const response = await axios.post(`${config.API_URL}/api/ai/generate-brag-sheet`, {
        accomplishments,
        time_period: options.time_period || '3 months',
        format: options.format || 'markdown',
        target_audience: options.target_audience || 'manager',
        highlight_metrics: options.highlight_metrics !== false
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        withCredentials: true
      });
      
      return response.data;
    } catch (error) {
      console.error('Error generating brag sheet:', error);
      throw error;
    }
  }
  
  /**
   * Retrieve work information from daily logs
   * @param {Object} dateRange - Date range to retrieve info for
   * @returns {Promise<Array>} Daily work information
   */
  async getDailyWorkInfo(dateRange) {
    try {
      const response = await axios.get(`${config.API_URL}/api/work-progress/daily-info`, {
        params: {
          start_date: dateRange.start_date,
          end_date: dateRange.end_date
        },
        headers: {
          'Content-Type': 'application/json'
        },
        withCredentials: true
      });
      
      return response.data;
    } catch (error) {
      console.error('Error retrieving daily work info:', error);
      throw error;
    }
  }
  
  /**
   * Natural language query about work history and stats, with dual workflow:
   * 1. RAG (Retrieval-Augmented Generation) using Supabase data
   * 2. AI-based answers using daily work info
   * 3. Enhanced client-side fallback when both server endpoints fail
   * @param {string} query - The user's question
   * @param {Object} context - Additional context (date range, etc.)
   * @returns {Promise<Object>} The answer with supporting data
   */
  async askWorkQuestion(query, context = {}) {
    try {
      console.log('Starting askWorkQuestion with API URL:', config.API_URL);
      
      // Try all endpoint combinations for maximum compatibility
      const endpoints = [
        // Primary endpoints
        `${config.API_URL}/api/ai/ask`,
        `${config.API_URL}/api/work-progress/ai/ask`,
        // Fallback to production if in development
        config.isDev ? `${config.BACKUP_API_URL || 'https://meetingscribe-backend.onrender.com'}/api/ai/ask` : null,
        config.isDev ? `${config.BACKUP_API_URL || 'https://meetingscribe-backend.onrender.com'}/api/work-progress/ai/ask` : null
      ].filter(Boolean); // Remove null entries

      console.log('Will try endpoints in this order:', endpoints);
      
      // Try each endpoint until one succeeds
      let lastError = null;
      for (const endpoint of endpoints) {
        try {
          console.log(`Trying endpoint: ${endpoint}`);
          const response = await axios.post(endpoint, {
            query,
            date_range: context.date_range,
            include_tasks: context.include_tasks !== false,
            include_sessions: context.include_sessions !== false,
            include_accomplishments: context.include_accomplishments !== false
          }, {
            headers: {
              'Content-Type': 'application/json'
            },
            withCredentials: true,
            timeout: 15000 // 15 second timeout
          });
          
          console.log(`Success with endpoint: ${endpoint}`);
          // If successful, return the answer
          return {
            answer: response.data.answer,
            source: 'database',
            data: response.data
          };
        } catch (error) {
          console.warn(`Failed with endpoint ${endpoint}:`, error.message);
          lastError = error;
          // Continue to the next endpoint
        }
      }
      
      // If we get here, all RAG endpoints failed
      console.warn('All RAG endpoints failed, falling back to context-based approach');
      
      // Try context-based approach as fallback
      // Retrieve daily work info for context
      let dailyInfo = [];
      try {
        dailyInfo = await this.getDailyWorkInfo(context.date_range);
      } catch (dailyInfoError) {
        console.warn('Failed to retrieve daily work info:', dailyInfoError);
        // Continue with empty daily info as fallback
      }
      
      // Try context endpoints
      const contextEndpoints = [
        `${config.API_URL}/api/ai/answer-from-context`,
        `${config.API_URL}/api/work-progress/ai/answer-from-context`,
        // Fallback to production if in development
        config.isDev ? `${config.BACKUP_API_URL || 'https://meetingscribe-backend.onrender.com'}/api/ai/answer-from-context` : null,
        config.isDev ? `${config.BACKUP_API_URL || 'https://meetingscribe-backend.onrender.com'}/api/work-progress/ai/answer-from-context` : null
      ].filter(Boolean);
      
      for (const endpoint of contextEndpoints) {
        try {
          console.log(`Trying context endpoint: ${endpoint}`);
          const contextResponse = await axios.post(endpoint, {
            query,
            daily_info: dailyInfo,
            date_range: context.date_range
          }, {
            headers: {
              'Content-Type': 'application/json'
            },
            withCredentials: true,
            timeout: 15000
          });
          
          console.log(`Success with context endpoint: ${endpoint}`);
          // If successful, return the answer
          return {
            answer: contextResponse.data.answer,
            source: 'ai',
            data: {
              query,
              date_range: context.date_range,
              workflow: 'ai-only'
            }
          };
        } catch (error) {
          console.warn(`Failed with context endpoint ${endpoint}:`, error.message);
          // Continue to the next endpoint
        }
      }
      
      // If we get here, all endpoints failed - use client-side fallback
      console.warn('All AI endpoints failed, using enhanced client-side fallback');
      
      // Enhanced client-side fallback (unchanged from original)
      const { start_date, end_date } = context.date_range || {};
      const dateRangeText = start_date && end_date 
        ? `between ${start_date} and ${end_date}` 
        : 'in your recent history';
      
      // Improved intelligent fallback responses based on query types (unchanged)
      let answer = "";
      
      // Query type detection and fallback responses (existing code)
      if (/task|todo|priority|backlog/i.test(query)) {
        answer = `I don't have access to your task data right now due to connectivity issues, but regarding "${query}":
        
Task management best practices suggest:
• Organize by priority (high/medium/low) and deadline
• Use the Eisenhower matrix - urgent+important tasks first
• Break large tasks into smaller, actionable items
• Set realistic deadlines with buffer time
• Review and reprioritize tasks daily

For your specific tasks ${dateRangeText}, check your Tasks tab when the connection is restored. The most effective task management combines good planning with regular review and adjustment.`;
      } 
      // Accomplishment-related queries
      else if (/accomplish|complete|finish|achieve/i.test(query)) {
        answer = `I can't access your specific accomplishment data ${dateRangeText} due to connectivity issues, but regarding "${query}":

Best practices for tracking accomplishments:
• Categorize by impact (high/medium/low)
• Include quantifiable metrics when possible (e.g., "increased X by 20%")
• Connect achievements to business goals
• Note collaborative efforts and your specific contributions
• Maintain an ongoing accomplishment log for future reference

This information is valuable for performance reviews, resume updates, and personal motivation. View your completed work in the Accomplishments tab when the connection is restored.`;
      }
      // Time tracking queries
      else if (/time|hour|session|track|pomodoro/i.test(query)) {
        answer = `I can't access your work session data ${dateRangeText} due to connectivity issues, but regarding "${query}":

Effective time management strategies:
• Identify your 2-3 daily peak productivity periods
• Try the Pomodoro technique (25min work/5min break)
• Time-block your calendar for focused work
• Group similar tasks to reduce context switching
• Schedule breaks to prevent burnout
• Track and analyze your productive vs. unproductive time

You can monitor your active work time using the Activity Tracker when connection is restored.`;
      }
      // Reporting queries
      else if (/report|status|update|summary/i.test(query)) {
        answer = `I can't access your report data ${dateRangeText} due to connectivity issues, but regarding "${query}":

Effective status reports should:
• Be concise with bullet points for scanning
• Highlight achievements and completed deliverables
• Address blockers and how they're being handled
• Outline next steps and priorities
• Include timeline updates for key projects
• Avoid unnecessary details but provide links to more information

Try morning reports for planning your day or evening reports to reflect on accomplishments. Generate new reports in the Status Reports tab when connection is restored.`;
      }
      // Productivity and insights queries
      else if (/insight|pattern|productivity|efficiency|work style/i.test(query)) {
        answer = `I can't access your specific work patterns ${dateRangeText} due to connectivity issues, but regarding "${query}":

Research-backed productivity insights:
• Regular breaks increase overall productivity
• Multitasking reduces effectiveness by up to 40%
• Most people have only 2-3 truly productive hours per day
• Decision fatigue builds throughout the day
• Environmental factors (noise, lighting, etc.) impact focus
• Sleep quality directly affects cognitive performance

Check the Insights panel for personalized analysis when connection is restored.`;
      }
      // General work progress queries
      else if (/progress|improve|roadblock|blocker|challenge/i.test(query)) {
        answer = `I can't access your work progress data ${dateRangeText} due to connectivity issues, but regarding "${query}":

Effective progress tracking includes:
• Regular review of completed vs. planned work
• Identifying and documenting blockers early
• Breaking down large goals into measurable milestones
• Celebrating small wins along the way
• Learning from both successes and setbacks
• Adjusting timelines when necessary

The Work & Progress dashboard provides visualization of your productivity trends when connection is restored.`;
      }
      // Collaboration queries
      else if (/team|collaborat|meet|colleague|share/i.test(query)) {
        answer = `I can't access your collaboration data ${dateRangeText} due to connectivity issues, but regarding "${query}":

Collaboration best practices:
• Clearly define roles and responsibilities
• Set explicit expectations for deliverables
• Document decisions and action items
• Use shared workspaces for transparency
• Schedule regular check-ins
• Provide constructive feedback

The MeetingScribe platform helps capture and organize collaborative work when connection is restored.`;
      }
      // General fallback for other queries
      else {
        answer = `I can't access your work data ${dateRangeText} due to connectivity issues, but I'd be happy to help with "${query}" when connection is restored.

The Ask AI feature normally provides personalized answers from your:
• Task history and current priorities
• Accomplishments and their impact
• Work sessions and productivity patterns
• Status reports and progress tracking

In the meantime, you can explore the Tasks, Accomplishments, and Status Reports tabs directly for this information. Please try your question again later when the backend connection is working.`;
      }
      
      return {
        answer: answer,
        source: 'fallback',
        data: {
          query,
          date_range: context.date_range,
          workflow: 'enhanced-fallback'
        }
      };
    } catch (error) {
      console.error('Error asking work question:', error);
      throw error;
    }
  }
  
  /**
   * Generate task descriptions from a brief title
   * @param {string} title - Brief task title
   * @param {Array} tags - Optional tags for context
   * @returns {Promise<Object>} Generated task details
   */
  async expandTaskDescription(title, tags = []) {
    try {
      const response = await axios.post(`${config.API_URL}/api/ai/expand-task`, {
        title,
        tags
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        withCredentials: true
      });
      
      return response.data;
    } catch (error) {
      console.error('Error expanding task description:', error);
      throw error;
    }
  }
  
  /**
   * Identify potential blockers or risks for a task
   * @param {Object} task - Task to analyze
   * @returns {Promise<Array>} Potential blockers or risks
   */
  async identifyTaskRisks(task) {
    try {
      const response = await axios.post(`${config.API_URL}/api/ai/identify-risks`, {
        task_title: task.title,
        task_description: task.description,
        task_tags: task.tags,
        due_date: task.due_date,
        dependencies: task.dependencies
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        withCredentials: true
      });
      
      return response.data;
    } catch (error) {
      console.error('Error identifying task risks:', error);
      throw error;
    }
  }
}

export default new WorkAIService(); 