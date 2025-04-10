import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Tabs, Tab, Spinner, Alert } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/AuthContext';
import WorkProgressService from '../services/WorkProgressService';
import WorkAIService from '../services/WorkAIService';
import TaskList from '../components/work-progress/TaskList';
import ActivityTracker from '../components/work-progress/ActivityTracker';
import AccomplishmentsList from '../components/work-progress/AccomplishmentsList';
import StatusReportSection from '../components/work-progress/StatusReportSection';
import InsightsPanel from '../components/work-progress/InsightsPanel';
import AskAIContainer from '../components/work-progress/AskAIContainer';
import ResetDatabaseUtils from '../components/work-progress/ResetDatabaseUtils';
import './WorkProgress.css';

const WorkProgress = () => {
  const { user, isSignedIn } = useUser();
  const navigate = useNavigate();
  
  // State variables
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('tasks');
  const [activeSession, setActiveSession] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [accomplishments, setAccomplishments] = useState([]);
  const [workInsights, setWorkInsights] = useState(null);
  const [statusReports, setStatusReports] = useState([]);
  
  // Date filters
  const today = new Date();
  const [dateRange, setDateRange] = useState({
    startDate: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30),
    endDate: today
  });
  
  // Load data on component mount
  useEffect(() => {
    if (!isSignedIn) return;
    
    const loadInitialData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Load active work session if any
        const session = await WorkProgressService.getActiveWorkSession();
        setActiveSession(session);
        
        // Load user's tasks, filtered by active status
        const userTasks = await WorkProgressService.getTasks({ 
          status: ['not_started', 'in_progress', 'blocked'],
          bypassCache: false // Use cache if available and fresh
        });
        setTasks(userTasks);
        
        // Also store tasks in localStorage for persistence
        localStorage.setItem('tasks_backup', JSON.stringify(userTasks));
        
        // Load recent accomplishments
        const userAccomplishments = await WorkProgressService.getAccomplishments({
          startDate: dateRange.startDate.toISOString().split('T')[0],
          endDate: dateRange.endDate.toISOString().split('T')[0]
        });
        setAccomplishments(userAccomplishments);
        
        // Load status reports
        const reports = await WorkProgressService.getStatusReports({
          startDate: dateRange.startDate.toISOString().split('T')[0],
          endDate: dateRange.endDate.toISOString().split('T')[0]
        });
        setStatusReports(reports);
        
        // Get work insights
        await loadWorkInsights();
        
        setLoading(false);
      } catch (err) {
        console.error('Error loading work progress data:', err);
        setError('Failed to load your work progress data. Please try again later.');
        setLoading(false);
        
        // Try to recover tasks from localStorage
        try {
          const storedTasks = JSON.parse(localStorage.getItem('tasks_backup'));
          if (storedTasks && Array.isArray(storedTasks)) {
            console.log('Recovering tasks from localStorage');
            setTasks(storedTasks);
          }
        } catch (localErr) {
          console.error('Error recovering from localStorage:', localErr);
        }
      }
    };
    
    loadInitialData();
    
    // Set up a refresh interval for tasks
    const refreshInterval = setInterval(() => {
      if (isSignedIn) {
        refreshTasks();
      }
    }, 60000); // Refresh every minute
    
    return () => clearInterval(refreshInterval);
  }, [isSignedIn, dateRange]);
  
  // Function to refresh tasks
  const refreshTasks = async () => {
    try {
      console.log('Refreshing tasks...');
      const userTasks = await WorkProgressService.getTasks({ 
        bypassCache: true // Force fetch from server
      });
      setTasks(userTasks);
      localStorage.setItem('tasks_backup', JSON.stringify(userTasks));
    } catch (err) {
      console.error('Error refreshing tasks:', err);
      // Don't show error to user for background refreshes
    }
  };
  
  // Load AI insights about work patterns
  const loadWorkInsights = async () => {
    try {
      // Only load insights if we have enough data
      if (tasks.length === 0) {
        return;
      }
      
      const insights = await WorkAIService.analyzeWorkPatterns({
        tasks: tasks,
        date_range: {
          start_date: dateRange.startDate,
          end_date: dateRange.endDate
        }
      });
      
      setWorkInsights(insights);
    } catch (err) {
      console.error('Error loading work insights:', err);
      // Don't show error to user, insights are optional
    }
  };
  
  // Handle new task creation
  const handleCreateTask = async (taskData) => {
    try {
      setError(null); // Clear any previous errors
      console.log('Attempting to create task with data:', taskData);
      
      // Create task with force mode to bypass authentication issues
      const newTask = await WorkProgressService.createTask(taskData);
      
      if (newTask) {
        console.log('Task created successfully:', newTask);
        setTasks(prevTasks => [...prevTasks, newTask]);
        
        // Show success message
        setError('Task created successfully!');
        setTimeout(() => setError(null), 3000);
        
        return newTask;
      } else {
        throw new Error('Task creation returned no data');
      }
    } catch (err) {
      console.error('Error creating task:', err);
      
      // Show detailed error message
      setError(`Failed to create task: ${err.message || 'Unknown error'}`);
      
      // Create a local task anyway for better UX
      const fakeTask = {
        id: 'local-' + Date.now(),
        title: taskData.title,
        description: taskData.description,
        status: taskData.status || 'not_started',
        priority: taskData.priority || 3,
        isLocal: true,
        created_at: new Date().toISOString()
      };
      
      // Add to local tasks list
      setTasks(prevTasks => [...prevTasks, fakeTask]);
      console.log('Created local task as fallback:', fakeTask);
      
      return fakeTask;
    }
  };
  
  // Handle task completion
  const handleCompleteTask = async (taskId) => {
    try {
      const updatedTask = await WorkProgressService.completeTask(taskId);
      
      // Update tasks list
      setTasks(tasks.filter(task => task.id !== taskId));
      
      // Refresh accomplishments
      const userAccomplishments = await WorkProgressService.getAccomplishments({
        startDate: dateRange.startDate.toISOString().split('T')[0],
        endDate: dateRange.endDate.toISOString().split('T')[0]
      });
      setAccomplishments(userAccomplishments);
      
      return updatedTask;
    } catch (err) {
      console.error('Error completing task:', err);
      setError('Failed to complete task. Please try again.');
      return null;
    }
  };
  
  // Handle work session start
  const handleStartSession = async () => {
    try {
      setError(null);
      // Create a new work session
      const session = await WorkProgressService.startWorkSession();
      if (session) {
        setActiveSession(session);
        console.log('Work session started:', session);
        return session;
      } else {
        setError('Failed to start work session. Session data is missing.');
        return null;
      }
    } catch (err) {
      console.error('Error starting work session:', err);
      setError(err.message || 'Failed to start work session. Please try again or check the console for more details.');
      return null;
    }
  };
  
  // Handle work session end
  const handleEndSession = async () => {
    if (!activeSession) return;
    
    try {
      await WorkProgressService.endWorkSession(activeSession.id);
      setActiveSession(null);
    } catch (err) {
      console.error('Error ending work session:', err);
      setError('Failed to end work session. Please try again.');
    }
  };
  
  // Handle generating status report
  const handleGenerateStatusReport = async (reportType) => {
    try {
      // Get tasks for today
      const today = new Date().toISOString().split('T')[0];
      const tasksForReport = await WorkProgressService.getTasks({
        dueDate: today
      });
      
      // Get recent accomplishments
      const recentAccomplishments = await WorkProgressService.getAccomplishments({
        startDate: new Date(today).toISOString().split('T')[0], // Only today's accomplishments
        endDate: new Date(today).toISOString().split('T')[0]
      });
      
      // Generate AI status report
      const reportData = await WorkAIService.generateStatusReport({
        report_type: reportType,
        tasks: tasksForReport,
        accomplishments: recentAccomplishments,
        date_range: {
          start_date: new Date(today).toISOString().split('T')[0],
          end_date: new Date(today).toISOString().split('T')[0]
        },
        user_info: {
          name: user?.user_metadata?.name || 'User',
          role: user?.user_metadata?.role || 'Team Member'
        }
      });
      
      // Save the generated report
      const savedReport = await WorkProgressService.generateStatusReport({
        report_type: reportType,
        report_date: new Date().toISOString().split('T')[0],
        content: reportData.content,
        tasks_completed: reportData.tasks_completed,
        tasks_in_progress: reportData.tasks_in_progress,
        blockers: reportData.blockers,
        next_steps: reportData.next_steps,
        ai_generated: true
      });
      
      // Update status reports list
      setStatusReports([savedReport, ...statusReports]);
      
      return savedReport;
    } catch (err) {
      console.error('Error generating status report:', err);
      setError('Failed to generate status report. Please try again.');
      return null;
    }
  };
  
  // Handle date range change
  const handleDateRangeChange = (newRange) => {
    setDateRange(newRange);
  };
  
  // Render loading state
  if (loading) {
    return (
      <Container className="work-progress-container">
        <div className="text-center my-5">
          <Spinner animation="border" role="status" variant="primary">
            <span className="visually-hidden">Loading...</span>
          </Spinner>
          <p className="mt-3">Loading your work progress data...</p>
        </div>
      </Container>
    );
  }
  
  return (
    <Container fluid className="work-progress-container">
      <Row className="mb-4">
        <Col>
          <h1 className="work-progress-title">Work & Progress</h1>
          <p className="work-progress-subtitle">
            Track your daily activities, accomplish tasks, and generate automated status reports
          </p>
        </Col>
      </Row>
      
      {error && (
        <Row className="mb-4">
          <Col>
            <Alert variant={error.includes('successfully') ? 'success' : 'danger'} onClose={() => setError(null)} dismissible>
              {error}
            </Alert>
          </Col>
        </Row>
      )}
      
      <Row className="mb-4">
        <Col>
          <ActivityTracker 
            activeSession={activeSession}
            onStartSession={handleStartSession}
            onEndSession={handleEndSession}
          />
        </Col>
      </Row>
      
      <Row>
        <Col md={8}>
          <Card className="mb-4">
            <Card.Header>
              <Tabs
                activeKey={activeTab}
                onSelect={(k) => setActiveTab(k)}
                className="work-progress-tabs"
                fill
              >
                <Tab eventKey="tasks" title={<span className="tab-title">Tasks</span>} />
                <Tab eventKey="accomplishments" title={<span className="tab-title">Accomplishments</span>} />
                <Tab eventKey="reports" title={<span className="tab-title">Status Reports</span>} />
              </Tabs>
            </Card.Header>
            <Card.Body>
              {activeTab === "tasks" && (
                <TaskList 
                  tasks={tasks}
                  onCreateTask={handleCreateTask}
                  onCompleteTask={handleCompleteTask}
                />
              )}
              {activeTab === "accomplishments" && (
                <AccomplishmentsList 
                  accomplishments={accomplishments} 
                  dateRange={dateRange}
                  onDateRangeChange={handleDateRangeChange}
                />
              )}
              {activeTab === "reports" && (
                <StatusReportSection 
                  statusReports={statusReports} 
                  onGenerateReport={handleGenerateStatusReport}
                />
              )}
            </Card.Body>
          </Card>
        </Col>
        
        <Col md={4}>
          <InsightsPanel 
            insights={workInsights}
            tasks={tasks}
            accomplishments={accomplishments}
            dateRange={dateRange}
          />
        </Col>
      </Row>
      
      <AskAIContainer />
      <ResetDatabaseUtils />
    </Container>
  );
};

export default WorkProgress; 