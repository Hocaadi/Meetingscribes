import React, { useState } from 'react';
import { 
  Card, 
  Button, 
  Form, 
  InputGroup,
  Spinner
} from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faBrain, 
  faSearch,
  faChartLine,
  faLightbulb,
  faSync,
  faClock,
  faCheckSquare,
  faCalendarCheck
} from '@fortawesome/free-solid-svg-icons';
import WorkAIService from '../../services/WorkAIService';

/**
 * InsightsPanel component for displaying AI-powered insights about work patterns
 */
const InsightsPanel = ({ insights, tasks, accomplishments, dateRange }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [askQuery, setAskQuery] = useState('');
  const [queryResult, setQueryResult] = useState(null);
  const [askingQuery, setAskingQuery] = useState(false);
  
  // Handle asking a question about work
  const handleAskQuestion = async (e) => {
    e.preventDefault();
    
    if (!askQuery.trim()) return;
    
    try {
      setAskingQuery(true);
      setError(null);
      
      const result = await WorkAIService.askWorkQuestion(askQuery, {
        date_range: {
          start_date: dateRange.startDate,
          end_date: dateRange.endDate
        }
      });
      
      setQueryResult(result);
    } catch (err) {
      setError('Failed to process your question. Please try again.');
      console.error('Error asking work question:', err);
    } finally {
      setAskingQuery(false);
    }
  };
  
  // Refresh the insights
  const handleRefreshInsights = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // This would be implemented to call the parent's refresh function
      // onRefreshInsights();
    } catch (err) {
      setError('Failed to refresh insights. Please try again.');
      console.error('Error refreshing insights:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // Calculate basic statistics
  const taskStats = {
    total: tasks.length,
    completed: accomplishments.length,
    inProgress: tasks.filter(task => task.status === 'in_progress').length,
    highPriority: tasks.filter(task => task.priority === 1 || task.priority === 2).length
  };
  
  return (
    <Card className="insights-panel">
      <Card.Body>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h5 className="insights-title mb-0">
            <FontAwesomeIcon icon={faBrain} className="me-2" />
            Work Insights
          </h5>
          <Button 
            variant="outline-secondary" 
            size="sm" 
            onClick={handleRefreshInsights}
            disabled={loading}
          >
            <FontAwesomeIcon icon={faSync} className={loading ? 'fa-spin' : ''} />
          </Button>
        </div>
        
        {/* Query Form */}
        <Form onSubmit={handleAskQuestion} className="mb-4">
          <InputGroup>
            <Form.Control
              placeholder="Ask about your work..."
              value={askQuery}
              onChange={(e) => setAskQuery(e.target.value)}
              disabled={askingQuery}
            />
            <Button 
              variant="primary" 
              type="submit"
              disabled={!askQuery.trim() || askingQuery}
            >
              {askingQuery ? (
                <Spinner animation="border" size="sm" role="status">
                  <span className="visually-hidden">Loading...</span>
                </Spinner>
              ) : (
                <FontAwesomeIcon icon={faSearch} />
              )}
            </Button>
          </InputGroup>
          <Form.Text className="text-muted">
            Example: "How many tasks did I complete last week?" or "What have I accomplished?"
          </Form.Text>
        </Form>
        
        {/* Query Result */}
        {queryResult && (
          <div className="insight-item mb-4">
            <div className="insight-heading">
              <FontAwesomeIcon icon={faLightbulb} className="me-2" />
              Query Result
            </div>
            <div className="insight-content">
              {queryResult.answer}
            </div>
          </div>
        )}
        
        {/* Loading State */}
        {loading && (
          <div className="text-center py-3">
            <Spinner animation="border" role="status" variant="primary">
              <span className="visually-hidden">Loading...</span>
            </Spinner>
            <p className="mt-2">Analyzing your work patterns...</p>
          </div>
        )}
        
        {/* Error Message */}
        {error && (
          <div className="alert alert-danger">{error}</div>
        )}
        
        {/* Work Stats */}
        <div className="insight-item mb-4">
          <div className="insight-heading">
            <FontAwesomeIcon icon={faChartLine} className="me-2" />
            Work Statistics
          </div>
          <div className="stat-container">
            <div className="stat-box">
              <div className="stat-value">{taskStats.total}</div>
              <div className="stat-label">Total Tasks</div>
            </div>
            <div className="stat-box">
              <div className="stat-value">{taskStats.completed}</div>
              <div className="stat-label">Completed</div>
            </div>
            <div className="stat-box">
              <div className="stat-value">{taskStats.inProgress}</div>
              <div className="stat-label">In Progress</div>
            </div>
            <div className="stat-box">
              <div className="stat-value">{taskStats.highPriority}</div>
              <div className="stat-label">High Priority</div>
            </div>
          </div>
        </div>
        
        {/* AI Insights */}
        {insights ? (
          <>
            {insights.productivity_insight && (
              <div className="insight-item mb-4">
                <div className="insight-heading">
                  <FontAwesomeIcon icon={faClock} className="me-2" />
                  Productivity Patterns
                </div>
                <div className="insight-content">
                  {insights.productivity_insight}
                </div>
              </div>
            )}
            
            {insights.accomplishment_insight && (
              <div className="insight-item mb-4">
                <div className="insight-heading">
                  <FontAwesomeIcon icon={faCheckSquare} className="me-2" />
                  Task Completion
                </div>
                <div className="insight-content">
                  {insights.accomplishment_insight}
                </div>
              </div>
            )}
            
            {insights.recommendations && (
              <div className="insight-item">
                <div className="insight-heading">
                  <FontAwesomeIcon icon={faLightbulb} className="me-2" />
                  Recommendations
                </div>
                <div className="insight-content">
                  {insights.recommendations}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="insight-item">
            <div className="insight-heading">
              <FontAwesomeIcon icon={faCalendarCheck} className="me-2" />
              Getting Started
            </div>
            <div className="insight-content">
              <p>
                Track your work sessions and complete tasks to receive personalized AI insights about 
                your work patterns and productivity trends.
              </p>
              <ul className="mb-0">
                <li>Start by creating some tasks</li>
                <li>Track your work with the activity timer</li>
                <li>Complete tasks and log accomplishments</li>
              </ul>
            </div>
          </div>
        )}
      </Card.Body>
    </Card>
  );
};

export default InsightsPanel; 