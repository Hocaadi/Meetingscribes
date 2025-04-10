import supabase from '../supabaseClient';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import config from '../config';

/**
 * Service for interacting with the Work & Progress module's data in Supabase
 */
class WorkProgressService {
  // -------- WORK SESSIONS -------- //
  
  /**
   * Start a new work session
   * @returns {Promise<Object>} The created work session
   */
  async startWorkSession() {
    try {
      // Check if user is authenticated first
      const { data: authData } = await supabase.auth.getSession();
      if (!authData.session) {
        console.error('User not authenticated. Cannot start work session.');
        throw new Error('Authentication required to start work session');
      }

      // Get the user ID from the authenticated session
      const userId = authData.session.user.id;
      console.log('Starting work session for user ID:', userId);

      // Check for existing active sessions first
      const { data: existingSession } = await supabase
        .from('work_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle();

      if (existingSession) {
        console.log('Found existing active session:', existingSession.id);
        return existingSession;
      }

      // Ensure profile exists before creating session
      await this.ensureUserProfile(userId);

      // Insert new work session
      const { data, error } = await supabase
        .from('work_sessions')
        .insert([{
          status: 'active',
          user_id: userId,
          start_time: new Date().toISOString()
        }])
        .select('*')
        .single();
      
      if (error) {
        console.error('Supabase error details:', error);
        
        // Specific RLS errors
        if (error.code === '42501') {
          console.error('RLS policy error. Please run the SQL script backend/work_sessions_rls_fix.sql');
          throw new Error('Permission denied. Database setup required.');
        }
        
        throw error;
      }
      
      console.log('Work session started successfully:', data);
      return data;
    } catch (error) {
      console.error('Error starting work session:', error);
      // Return a more user-friendly error message
      throw new Error('Failed to start work session: ' + (error.message || 'Unknown error'));
    }
  }
  
  /**
   * End a work session
   * @param {string} sessionId - ID of the session to end
   * @returns {Promise<Object>} The updated work session
   */
  async endWorkSession(sessionId) {
    try {
      const { data, error } = await supabase
        .from('work_sessions')
        .update({
          end_time: new Date().toISOString(),
          status: 'completed'
        })
        .eq('id', sessionId)
        .select('*')
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error ending work session:', error);
      throw error;
    }
  }
  
  /**
   * Get active work session for the current user
   * @returns {Promise<Object|null>} The active session or null if none exists
   */
  async getActiveWorkSession() {
    try {
      // Try first with status field
      const { data: statusData, error: statusError } = await supabase
        .from('work_sessions')
        .select('*')
        .eq('status', 'active')
        .order('start_time', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      // If we got data using status, return it
      if (!statusError && statusData) {
        return statusData;
      }
      
      // If status field query failed, try with is_active field
      if (statusError) {
        console.log('Status query failed, trying is_active field instead');
        
        const { data: activeData, error: activeError } = await supabase
          .from('work_sessions')
          .select('*')
          .eq('is_active', true)
          .order('start_time', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (activeError) {
          console.error('Both status and is_active queries failed:', activeError);
          return null;
        }
        
        return activeData;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting active work session:', error);
      return null;
    }
  }
  
  /**
   * Get work sessions for a specific date range
   * @param {Date} startDate - Start of date range
   * @param {Date} endDate - End of date range
   * @returns {Promise<Array>} Work sessions within the date range
   */
  async getWorkSessionsByDateRange(startDate, endDate) {
    try {
      const { data, error } = await supabase
        .from('work_sessions')
        .select('*')
        .gte('start_time', startDate.toISOString())
        .lte('start_time', endDate.toISOString())
        .order('start_time', { ascending: false });
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting work sessions by date range:', error);
      return [];
    }
  }
  
  // -------- TASKS -------- //
  
  /**
   * Create a new task with fallback mechanisms to handle common issues
   * @param {Object} task - Task data
   * @returns {Promise<Object>} The created task
   */
  async createTask(task) {
    try {
      // Force-create the task with either authenticated user or fallback
      console.log('Creating task with FORCE mode');
      
      // Get current authenticated user
      const { data: authData } = await supabase.auth.getSession();
      
      // Use authenticated user ID if available
      if (!authData?.session?.user?.id) {
        console.error('No authenticated user found. Please log in to create tasks.');
        throw new Error('Please log in to create tasks. Authentication required.');
      }
      
      const userId = authData.session.user.id;
      console.log('Using user ID for task creation:', userId);
      console.log('Task data:', task);

      // First ensure profile exists
      try {
        await this.ensureUserProfile(userId);
      } catch (profileError) {
        console.warn('Profile creation failed, but will still attempt to create task:', profileError.message);
        // Continue anyway - the task might still work if DB is configured correctly
      }
      
      // Create the task with the user_id
      const { data, error } = await supabase
        .from('tasks')
        .insert([{
          title: task.title || 'Untitled Task',
          description: task.description || 'No description',
          status: task.status || 'not_started',
          priority: task.priority || 3,
          estimated_minutes: task.estimated_minutes || 30,
          due_date: task.due_date || null,
          parent_task_id: task.parent_task_id || null,
          tags: task.tags || [],
          user_id: userId
        }])
        .select('*')
        .single();
      
      if (error) {
        console.error('Supabase task creation error:', error);
        
        // Handle specific error cases
        if (error.code === '42501') {
          throw new Error('Permission denied. Please check that RLS policies are set up correctly in Supabase. Run the SQL scripts in SUPABASE_SETUP.md');
        } else if (error.message.includes('foreign key constraint')) {
          throw new Error('User profile not properly set up. Please visit the setup page to initialize your profile.');
        }
        
        throw error;
      }
      
      console.log('Task created successfully:', data);
      return data;
    } catch (error) {
      console.error('Error creating task:', error);
      throw new Error('Failed to create task. Please try again. Error: ' + error.message);
    }
  }
  
  /**
   * Ensure a user profile exists
   * @private
   * @param {string} userId - User ID to ensure profile for
   */
  async ensureUserProfile(userId) {
    try {
      console.log('Ensuring profile exists for user:', userId);
      
      // Check if profile exists
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .single();
      
      if (profileError || !profileData) {
        return this.forceCreateProfile(userId);
      }
      
      return profileData;
    } catch (error) {
      console.error('Error ensuring profile:', error);
    }
  }
  
  /**
   * Force create a profile for a user
   * @private
   * @param {string} userId - User ID to create profile for
   */
  async forceCreateProfile(userId) {
    try {
      console.log('Force creating profile for user:', userId);
      
      // Get email from session if available
      const { data: authData } = await supabase.auth.getSession();
      const userEmail = authData?.session?.user?.email || 'admin@meetingscribe.dev';
      
      // We're going to try two different approaches:
      
      // 1. First try using a direct RPC call to bypass RLS
      try {
        console.log('Attempting to create profile via RPC (method 1)');
        
        const { data: rpcData, error: rpcError } = await supabase.rpc('create_profile', {
          user_id: userId,
          first_name: 'Admin',
          last_name: 'User',
          email: userEmail
        });
        
        if (!rpcError) {
          console.log('Profile created successfully via RPC');
          return rpcData;
        } else {
          console.log('RPC method failed, trying upsert method next:', rpcError.message);
        }
      } catch (rpcErr) {
        console.log('RPC method not available, trying upsert method next');
      }
      
      // 2. Try using regular insert with auth ID matching to satisfy RLS
      console.log('Attempting to create profile via direct upsert (method 2)');
      
      // Make sure we match the authenticated user - this is important for RLS
      if (authData?.session?.user?.id !== userId) {
        console.error('User ID mismatch! Authenticated user and target user ID must match for RLS policy compliance');
        throw new Error('User ID mismatch: Cannot create profile for another user due to RLS policy');
      }
      
      const { data: newProfile, error: newProfileError } = await supabase
        .from('profiles')
        .upsert([{
          id: userId,
          first_name: 'Admin',
          last_name: 'User',
          email: userEmail,
          updated_at: new Date().toISOString()
        }])
        .select();
        
      if (newProfileError) {
        // If we get an RLS error, provide a clear error message
        if (newProfileError.code === '42501') {
          console.error('RLS policy error creating profile. Please run the SQL setup script in SUPABASE_SETUP.md');
          throw new Error('Database permission error. Please contact admin to run SQL setup script.');
        }
        
        console.error('Error creating profile:', newProfileError);
        throw newProfileError;
      }
      
      console.log('Profile created successfully:', newProfile);
      return newProfile;
    } catch (error) {
      console.error('Error force creating profile:', error);
      throw error;
    }
  }
  
  /**
   * Update an existing task
   * @param {string} taskId - ID of the task to update
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} The updated task
   */
  async updateTask(taskId, updates) {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', taskId)
        .select('*')
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating task:', error);
      throw error;
    }
  }
  
  /**
   * Get all tasks for the current user
   * @param {Object} filters - Optional filters (status, priority, etc.)
   * @returns {Promise<Array>} Tasks matching the filters
   */
  async getTasks(filters = {}) {
    try {
      // Generate a cache key based on the filters
      const cacheKey = `tasks_${JSON.stringify(filters)}`;
      
      // Check if we have a cached version and it's recent (less than 30 seconds old)
      const cachedData = this.getCachedData(cacheKey);
      if (cachedData && !filters.bypassCache) {
        console.log('Using cached tasks data');
        return cachedData;
      }
      
      console.log('Fetching tasks from server with filters:', filters);
      let query = supabase
        .from('tasks')
        .select('*');
      
      // Apply filters
      if (filters.status) {
        if (Array.isArray(filters.status)) {
          query = query.in('status', filters.status);
        } else {
          query = query.eq('status', filters.status);
        }
      }
      
      if (filters.priority) {
        query = query.eq('priority', filters.priority);
      }
      
      if (filters.dueDate) {
        query = query.lte('due_date', new Date(filters.dueDate).toISOString());
      }
      
      if (filters.tags && filters.tags.length > 0) {
        query = query.contains('tags', filters.tags);
      }
      
      // Order results
      query = query.order('priority', { ascending: true })
        .order('due_date', { ascending: true });
      
      const { data, error } = await query;
      
      if (error) {
        // If we get an error, try to return the cached data as a fallback
        const fallbackData = this.getCachedData(cacheKey, true);
        if (fallbackData) {
          console.log('Error fetching tasks, using fallback cached data');
          return fallbackData;
        }
        throw error;
      }
      
      // If successful, cache the data
      this.cacheData(cacheKey, data || []);
      
      return data || [];
    } catch (error) {
      console.error('Error getting tasks:', error);
      
      // Try to get data from localStorage as a last resort
      try {
        const localData = JSON.parse(localStorage.getItem('tasks_data'));
        if (localData && Array.isArray(localData)) {
          console.log('Using localStorage tasks data as fallback');
          return localData;
        }
      } catch (localError) {
        console.error('Error reading from localStorage:', localError);
      }
      
      return [];
    }
  }
  
  // Cache management helpers
  cacheData(key, data, expiration = 30000) { // 30 seconds default
    const cacheItem = {
      data: data,
      timestamp: Date.now(),
      expiration: expiration
    };
    
    // Store in memory cache
    this.dataCache = this.dataCache || {};
    this.dataCache[key] = cacheItem;
    
    // Also store in localStorage for persistence across page refreshes
    try {
      if (key.startsWith('tasks_')) {
        localStorage.setItem('tasks_data', JSON.stringify(data));
      }
    } catch (error) {
      console.warn('Failed to store in localStorage:', error);
    }
    
    return data;
  }
  
  getCachedData(key, ignoreFreshness = false) {
    if (!this.dataCache || !this.dataCache[key]) {
      return null;
    }
    
    const cacheItem = this.dataCache[key];
    const now = Date.now();
    const isFresh = (now - cacheItem.timestamp) < cacheItem.expiration;
    
    if (isFresh || ignoreFreshness) {
      return cacheItem.data;
    }
    
    return null;
  }
  
  /**
   * Mark a task as completed
   * @param {string} taskId - ID of the task to complete
   * @returns {Promise<Object>} The updated task
   */
  async completeTask(taskId) {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', taskId)
        .select('*')
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error completing task:', error);
      throw error;
    }
  }
  
  // -------- ACTIVITY LOGS -------- //
  
  /**
   * Log an activity for a work session
   * @param {Object} payload - Activity payload
   * @param {string} payload.session_id - ID of the session
   * @param {string} [payload.task_id] - ID of the task (optional)
   * @param {string} payload.description - Description of the activity
   * @param {string} [payload.activity_type] - Type of activity
   * @param {string} [payload.start_time] - Start time of the activity
   * @returns {Promise<Object>} - The logged activity data
   */
  async logActivity(payload) {
    try {
      // Input validation
      if (!payload) {
        throw new Error('Activity data is required');
      }
      
      if (!payload.session_id) {
        throw new Error('Session ID is required');
      }
      
      if (!payload.description || payload.description.trim() === '') {
        throw new Error('Description is required');
      }
      
      // Use the backend API endpoint instead of direct Supabase calls
      const response = await axios.post(
        `${config.API_URL}/api/work-progress/activities`, 
        payload,
        {
          headers: {
            Authorization: `Bearer ${await this.getAuthToken()}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('Activity logged successfully:', response.data.activity);
      
      return {
        data: response.data.activity,
        error: null
      };
    } catch (error) {
      console.error('Error logging activity:', error);
      
      // Format error response to match previous structure
      return {
        data: null,
        error: {
          message: error.response?.data?.error || error.message || 'Failed to log activity',
          details: error.response?.data?.details || error.toString()
        }
      };
    }
  }
  
  /**
   * End an activity by ID
   * @param {string} activityId - ID of the activity to end
   * @returns {Promise<Object>} - The updated activity data
   */
  async endActivity(activityId) {
    try {
      if (!activityId) {
        throw new Error('Activity ID is required');
      }
      
      const response = await axios.put(
        `${config.API_URL}/api/work-progress/activities/${activityId}/end`,
        { end_time: new Date().toISOString() },
        {
          headers: {
            Authorization: `Bearer ${await this.getAuthToken()}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('Activity ended successfully:', response.data.activity);
      
      return {
        data: response.data.activity,
        error: null
      };
    } catch (error) {
      console.error('Error ending activity:', error);
      
      return {
        data: null,
        error: {
          message: error.response?.data?.error || error.message || 'Failed to end activity',
          details: error.response?.data?.details || error.toString()
        }
      };
    }
  }
  
  /**
   * Get activities for a specific session
   * @param {string} sessionId - ID of the session
   * @returns {Promise<Object>} - Session activities data
   */
  async getSessionActivities(sessionId) {
    try {
      if (!sessionId) {
        throw new Error('Session ID is required');
      }
      
      const response = await axios.get(
        `${config.API_URL}/api/work-progress/sessions/${sessionId}/activities`,
        {
          headers: {
            Authorization: `Bearer ${await this.getAuthToken()}`
          }
        }
      );
      
      return {
        data: response.data.activities,
        error: null
      };
    } catch (error) {
      console.error('Error fetching session activities:', error);
      
      return {
        data: null,
        error: {
          message: error.response?.data?.error || error.message || 'Failed to fetch activities',
          details: error.response?.data?.details || error.toString()
        }
      };
    }
  }
  
  /**
   * Helper method to get auth token
   * @private
   * @returns {Promise<string>} - Auth token
   */
  async getAuthToken() {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || '';
  }
  
  // -------- ACCOMPLISHMENTS -------- //
  
  /**
   * Create a new accomplishment (manual entry)
   * @param {Object} accomplishment - Accomplishment data
   * @returns {Promise<Object>} The created accomplishment
   */
  async createAccomplishment(accomplishment) {
    try {
      const { data, error } = await supabase
        .from('accomplishments')
        .insert([{
          title: accomplishment.title,
          description: accomplishment.description,
          task_id: accomplishment.task_id,
          accomplishment_date: accomplishment.accomplishment_date || new Date().toISOString().split('T')[0],
          impact_level: accomplishment.impact_level || 'medium',
          metrics: accomplishment.metrics,
          tags: accomplishment.tags,
          is_featured: accomplishment.is_featured || false
        }])
        .select('*')
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating accomplishment:', error);
      throw error;
    }
  }
  
  /**
   * Get accomplishments for the current user
   * @param {Object} filters - Optional filters (date range, tags, etc.)
   * @returns {Promise<Array>} Accomplishments matching the filters
   */
  async getAccomplishments(filters = {}) {
    try {
      let query = supabase
        .from('accomplishments')
        .select('*');
      
      // Apply date range filter
      if (filters.startDate) {
        query = query.gte('accomplishment_date', filters.startDate);
      }
      
      if (filters.endDate) {
        query = query.lte('accomplishment_date', filters.endDate);
      }
      
      // Apply impact level filter
      if (filters.impact_level) {
        query = query.eq('impact_level', filters.impact_level);
      }
      
      // Apply tags filter
      if (filters.tags && filters.tags.length > 0) {
        query = query.contains('tags', filters.tags);
      }
      
      // Apply featured filter
      if (filters.featured) {
        query = query.eq('is_featured', true);
      }
      
      // Order results
      query = query.order('accomplishment_date', { ascending: false });
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting accomplishments:', error);
      return [];
    }
  }
  
  // -------- STATUS REPORTS -------- //
  
  /**
   * Generate a status report (can be manually or AI-generated)
   * @param {Object} reportData - Report data
   * @returns {Promise<Object>} The created status report
   */
  async generateStatusReport(reportData) {
    try {
      const { data, error } = await supabase
        .from('status_reports')
        .insert([{
          report_type: reportData.report_type,
          report_date: reportData.report_date || new Date().toISOString().split('T')[0],
          content: reportData.content,
          tasks_completed: reportData.tasks_completed,
          tasks_in_progress: reportData.tasks_in_progress,
          blockers: reportData.blockers,
          next_steps: reportData.next_steps,
          ai_generated: reportData.ai_generated || false
        }])
        .select('*')
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error generating status report:', error);
      throw error;
    }
  }
  
  /**
   * Mark a status report as sent
   * @param {string} reportId - ID of the status report
   * @returns {Promise<Object>} The updated status report
   */
  async markReportAsSent(reportId) {
    try {
      const { data, error } = await supabase
        .from('status_reports')
        .update({
          sent: true,
          sent_at: new Date().toISOString()
        })
        .eq('id', reportId)
        .select('*')
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error marking report as sent:', error);
      throw error;
    }
  }
  
  /**
   * Get status reports for a specific date range
   * @param {Object} filters - Filters for reports
   * @returns {Promise<Array>} Status reports matching the filters
   */
  async getStatusReports(filters = {}) {
    try {
      let query = supabase
        .from('status_reports')
        .select('*');
      
      // Apply date range filter
      if (filters.startDate) {
        query = query.gte('report_date', filters.startDate);
      }
      
      if (filters.endDate) {
        query = query.lte('report_date', filters.endDate);
      }
      
      // Apply report type filter
      if (filters.report_type) {
        query = query.eq('report_type', filters.report_type);
      }
      
      // Apply sent status filter
      if (filters.sent !== undefined) {
        query = query.eq('sent', filters.sent);
      }
      
      // Order results
      query = query.order('report_date', { ascending: false });
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting status reports:', error);
      return [];
    }
  }
  
  // -------- ANALYTICS -------- //
  
  /**
   * Get work hours summary by day for a date range
   * @param {Date} startDate - Start of date range
   * @param {Date} endDate - End of date range
   * @returns {Promise<Array>} Daily work hours summary
   */
  async getWorkHoursByDay(startDate, endDate) {
    try {
      const sessions = await this.getWorkSessionsByDateRange(startDate, endDate);
      
      // Group sessions by day
      const dailySummary = {};
      
      sessions.forEach(session => {
        if (!session.duration_minutes) return;
        
        const date = new Date(session.start_time).toISOString().split('T')[0];
        
        if (!dailySummary[date]) {
          dailySummary[date] = {
            date,
            total_minutes: 0,
            sessions: 0
          };
        }
        
        dailySummary[date].total_minutes += session.duration_minutes;
        dailySummary[date].sessions += 1;
      });
      
      // Convert to array
      return Object.values(dailySummary).map(day => ({
        ...day,
        total_hours: Math.round((day.total_minutes / 60) * 10) / 10 // Round to 1 decimal
      }));
    } catch (error) {
      console.error('Error getting work hours by day:', error);
      return [];
    }
  }
  
  /**
   * Get task completion statistics
   * @param {Date} startDate - Start of date range
   * @param {Date} endDate - End of date range
   * @returns {Promise<Object>} Task statistics
   */
  async getTaskStats(startDate, endDate) {
    try {
      // Get all tasks in the date range
      const { data: tasks, error } = await supabase
        .from('tasks')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());
      
      if (error) throw error;
      
      // Count tasks by status
      const statsByStatus = {};
      tasks.forEach(task => {
        if (!statsByStatus[task.status]) {
          statsByStatus[task.status] = 0;
        }
        statsByStatus[task.status]++;
      });
      
      // Calculate completion rate
      const completed = statsByStatus.completed || 0;
      const total = tasks.length;
      const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
      
      // Calculate average completion time for completed tasks
      const completedTasks = tasks.filter(task => task.status === 'completed' && task.completed_at);
      let avgCompletionTime = 0;
      
      if (completedTasks.length > 0) {
        const totalCompletionTime = completedTasks.reduce((sum, task) => {
          const created = new Date(task.created_at);
          const completed = new Date(task.completed_at);
          const hours = (completed - created) / (1000 * 60 * 60);
          return sum + hours;
        }, 0);
        
        avgCompletionTime = Math.round((totalCompletionTime / completedTasks.length) * 10) / 10;
      }
      
      return {
        total,
        byStatus: statsByStatus,
        completionRate,
        avgCompletionTime
      };
    } catch (error) {
      console.error('Error getting task stats:', error);
      return {
        total: 0,
        byStatus: {},
        completionRate: 0,
        avgCompletionTime: 0
      };
    }
  }
}

export default new WorkProgressService(); 