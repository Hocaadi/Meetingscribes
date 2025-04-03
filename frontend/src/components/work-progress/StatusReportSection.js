import React, { useState } from 'react';
import { 
  Card, 
  Button, 
  Badge, 
  ButtonGroup,
  Alert,
  Spinner,
  Accordion
} from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faFileAlt, 
  faRobot, 
  faSun, 
  faMoon, 
  faCalendarWeek,
  faEnvelope
} from '@fortawesome/free-solid-svg-icons';

/**
 * StatusReportSection component for generating and displaying status reports
 */
const StatusReportSection = ({ statusReports, onGenerateReport }) => {
  const [generating, setGenerating] = useState(false);
  const [generatingType, setGeneratingType] = useState(null);
  const [error, setError] = useState(null);
  
  // Generate a status report
  const handleGenerateReport = async (reportType) => {
    try {
      setGenerating(true);
      setGeneratingType(reportType);
      setError(null);
      
      await onGenerateReport(reportType);
      
    } catch (err) {
      setError('Failed to generate report. Please try again.');
      console.error('Error generating report:', err);
    } finally {
      setGenerating(false);
      setGeneratingType(null);
    }
  };
  
  // Get report type badge
  const getReportTypeBadge = (type) => {
    const types = {
      morning: { color: 'primary', label: 'Morning Plan', icon: faSun },
      evening: { color: 'warning', label: 'Evening Summary', icon: faMoon },
      weekly: { color: 'success', label: 'Weekly Report', icon: faCalendarWeek }
    };
    
    const { color, label, icon } = types[type] || types.morning;
    
    return (
      <Badge bg={color} className={`report-type ${type}`}>
        <FontAwesomeIcon icon={icon} className="me-1" />
        {label}
      </Badge>
    );
  };
  
  return (
    <div className="status-report-section">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h5 className="mb-0">
          <FontAwesomeIcon icon={faFileAlt} className="me-2" />
          Status Reports
        </h5>
        
        <ButtonGroup>
          <Button 
            variant="outline-primary" 
            onClick={() => handleGenerateReport('morning')}
            disabled={generating}
          >
            <FontAwesomeIcon icon={faSun} className="me-1" />
            {generatingType === 'morning' ? (
              <>
                <Spinner as="span" animation="border" size="sm" role="status" className="me-1" />
                Generating...
              </>
            ) : 'Morning Plan'}
          </Button>
          <Button 
            variant="outline-warning" 
            onClick={() => handleGenerateReport('evening')}
            disabled={generating}
          >
            <FontAwesomeIcon icon={faMoon} className="me-1" />
            {generatingType === 'evening' ? (
              <>
                <Spinner as="span" animation="border" size="sm" role="status" className="me-1" />
                Generating...
              </>
            ) : 'Evening Summary'}
          </Button>
          <Button 
            variant="outline-success" 
            onClick={() => handleGenerateReport('weekly')}
            disabled={generating}
          >
            <FontAwesomeIcon icon={faCalendarWeek} className="me-1" />
            {generatingType === 'weekly' ? (
              <>
                <Spinner as="span" animation="border" size="sm" role="status" className="me-1" />
                Generating...
              </>
            ) : 'Weekly Report'}
          </Button>
        </ButtonGroup>
      </div>
      
      {error && (
        <Alert variant="danger" onClose={() => setError(null)} dismissible>
          {error}
        </Alert>
      )}
      
      {generating && !generatingType && (
        <div className="text-center py-4">
          <Spinner animation="border" role="status" variant="primary">
            <span className="visually-hidden">Loading...</span>
          </Spinner>
          <p className="mt-2">Generating report...</p>
        </div>
      )}
      
      {statusReports.length === 0 ? (
        <div className="text-center p-4 bg-light rounded">
          <p>No status reports yet. Generate one using the buttons above.</p>
          <p className="text-muted small">
            <FontAwesomeIcon icon={faRobot} className="me-1" />
            Reports are automatically generated based on your tasks and activities.
          </p>
        </div>
      ) : (
        <Accordion defaultActiveKey="0">
          {statusReports.map((report, index) => (
            <Accordion.Item key={report.id} eventKey={index.toString()}>
              <Accordion.Header>
                <div className="d-flex align-items-center justify-content-between w-100">
                  <div>
                    {getReportTypeBadge(report.report_type)} 
                    <span className="ms-2">{new Date(report.report_date).toLocaleDateString()}</span>
                  </div>
                  
                  <div>
                    {report.ai_generated && (
                      <Badge bg="light" text="dark" className="ai-generated-badge">
                        <FontAwesomeIcon icon={faRobot} />
                        AI Generated
                      </Badge>
                    )}
                    {!report.sent && (
                      <Button 
                        variant="outline-primary" 
                        size="sm" 
                        className="ms-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Implement send report functionality
                        }}
                      >
                        <FontAwesomeIcon icon={faEnvelope} className="me-1" />
                        Send
                      </Button>
                    )}
                  </div>
                </div>
              </Accordion.Header>
              <Accordion.Body>
                <div className="report-content">{report.content}</div>
                
                <div className="report-metadata mt-3">
                  {report.tasks_completed && report.tasks_completed.length > 0 && (
                    <div className="report-section">
                      <h6>Completed Tasks</h6>
                      <ul className="report-list">
                        {report.tasks_completed.map((task, i) => (
                          <li key={i}>{task}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {report.tasks_in_progress && report.tasks_in_progress.length > 0 && (
                    <div className="report-section">
                      <h6>In Progress</h6>
                      <ul className="report-list">
                        {report.tasks_in_progress.map((task, i) => (
                          <li key={i}>{task}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {report.blockers && report.blockers.length > 0 && (
                    <div className="report-section">
                      <h6>Blockers</h6>
                      <ul className="report-list">
                        {report.blockers.map((blocker, i) => (
                          <li key={i}>{blocker}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {report.next_steps && report.next_steps.length > 0 && (
                    <div className="report-section">
                      <h6>Next Steps</h6>
                      <ul className="report-list">
                        {report.next_steps.map((step, i) => (
                          <li key={i}>{step}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </Accordion.Body>
            </Accordion.Item>
          ))}
        </Accordion>
      )}
    </div>
  );
};

export default StatusReportSection; 