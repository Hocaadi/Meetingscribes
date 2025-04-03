import React, { useState, useEffect } from 'react';
import { 
  Row, 
  Col, 
  Card, 
  Button, 
  Form, 
  Badge, 
  Modal, 
  InputGroup,
  Dropdown,
  DropdownButton
} from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faPlus, 
  faCheck, 
  faClock, 
  faCalendarAlt, 
  faExclamationTriangle,
  faTags,
  faEllipsisV
} from '@fortawesome/free-solid-svg-icons';
import WorkAIService from '../../services/WorkAIService';

/**
 * TaskList component for managing tasks
 */
const TaskList = ({ tasks, onCreateTask, onCompleteTask }) => {
  // State for new task form
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 3,
    status: 'not_started',
    due_date: '',
    tags: []
  });
  
  // State for task detail modal
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  
  // State for AI expanded description
  const [isExpandingDescription, setIsExpandingDescription] = useState(false);
  
  // State for sorting and filtering
  const [sortConfig, setSortConfig] = useState({ key: 'priority', direction: 'asc' });
  const [filterConfig, setFilterConfig] = useState({});
  const [displayedTasks, setDisplayedTasks] = useState([]);
  
  // Toggle new task form
  const toggleNewTaskForm = () => {
    setShowNewTaskForm(!showNewTaskForm);
  };
  
  // Open task detail modal
  const openTaskModal = (task) => {
    setSelectedTask(task);
    setShowTaskModal(true);
  };
  
  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewTask({ ...newTask, [name]: value });
  };
  
  // Handle tag input
  const handleTagInput = (e) => {
    if (e.key === 'Enter' && e.target.value.trim()) {
      e.preventDefault();
      const newTag = e.target.value.trim();
      if (!newTask.tags.includes(newTag)) {
        setNewTask({
          ...newTask,
          tags: [...newTask.tags, newTag]
        });
      }
      e.target.value = '';
    }
  };
  
  // Remove a tag
  const removeTag = (tagToRemove) => {
    setNewTask({
      ...newTask,
      tags: newTask.tags.filter(tag => tag !== tagToRemove)
    });
  };
  
  // Submit new task
  const handleSubmitTask = async (e) => {
    e.preventDefault();
    
    try {
      // Ensure we have at least a title, even if empty
      const taskToCreate = {
        ...newTask,
        title: newTask.title.trim() || `Task ${new Date().toLocaleString()}`,
        // Add default values for any missing fields
        description: newTask.description || '',
        priority: newTask.priority || 3,
        status: newTask.status || 'not_started',
        tags: Array.isArray(newTask.tags) ? newTask.tags : []
      };
      
      console.log('Submitting task:', taskToCreate);
      const createdTask = await onCreateTask(taskToCreate);
      
      if (createdTask) {
        console.log('Task created successfully:', createdTask);
        
        // Reset form
        setNewTask({
          title: '',
          description: '',
          priority: 3,
          status: 'not_started',
          due_date: '',
          tags: []
        });
        
        setShowNewTaskForm(false);
      } else {
        console.error('Task creation returned null or undefined');
        alert('Task creation failed with an unknown error. Please try again.');
      }
    } catch (error) {
      console.error('Error in task submission:', error);
      alert(`Error creating task: ${error.message || 'Unknown error'}`);
    }
  };
  
  // Mark task as complete
  const handleCompleteTask = async (taskId) => {
    await onCompleteTask(taskId);
  };
  
  // Use AI to expand task description
  const expandTaskDescription = async () => {
    if (!newTask.title.trim()) return;
    
    setIsExpandingDescription(true);
    
    try {
      const result = await WorkAIService.expandTaskDescription(
        newTask.title, 
        newTask.tags
      );
      
      if (result.description) {
        setNewTask({
          ...newTask,
          description: result.description
        });
      }
      
      // Set suggested tags if provided and not already added
      if (result.suggested_tags && Array.isArray(result.suggested_tags)) {
        const currentTags = new Set(newTask.tags);
        const newTags = result.suggested_tags.filter(tag => !currentTags.has(tag));
        
        if (newTags.length > 0) {
          setNewTask({
            ...newTask,
            tags: [...newTask.tags, ...newTags]
          });
        }
      }
    } catch (error) {
      console.error('Error expanding task description:', error);
    } finally {
      setIsExpandingDescription(false);
    }
  };
  
  // Get priority badge
  const getPriorityBadge = (priority) => {
    const priorities = {
      1: { color: 'danger', label: 'High' },
      2: { color: 'warning', label: 'Medium-High' },
      3: { color: 'primary', label: 'Medium' },
      4: { color: 'success', label: 'Medium-Low' },
      5: { color: 'secondary', label: 'Low' }
    };
    
    const { color, label } = priorities[priority] || priorities[3];
    return <Badge bg={color}>{label}</Badge>;
  };
  
  // Get status badge
  const getStatusBadge = (status) => {
    const statuses = {
      not_started: { color: 'secondary', label: 'Not Started' },
      in_progress: { color: 'primary', label: 'In Progress' },
      blocked: { color: 'danger', label: 'Blocked' },
      completed: { color: 'success', label: 'Completed' },
      deferred: { color: 'warning', label: 'Deferred' }
    };
    
    const { color, label } = statuses[status] || statuses.not_started;
    return <Badge bg={color}>{label}</Badge>;
  };
  
  // Sort tasks by priority and due date
  const sortedTasks = [...tasks].sort((a, b) => {
    // First by priority (lower number is higher priority)
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    
    // Then by due date if both have one
    if (a.due_date && b.due_date) {
      return new Date(a.due_date) - new Date(b.due_date);
    }
    
    // Tasks with due dates come before those without
    if (a.due_date && !b.due_date) return -1;
    if (!a.due_date && b.due_date) return 1;
    
    // Finally by created date
    return new Date(a.created_at) - new Date(b.created_at);
  });
  
  // Filter tasks based on current filter configuration
  const filterTasks = (tasks, config) => {
    // Implementation of filtering logic based on config
    return tasks;
  };
  
  // Sort tasks based on current sort configuration
  const sortTasks = (tasks, config) => {
    // Implementation of sorting logic based on config
    return tasks;
  };
  
  useEffect(() => {
    if (tasks) {
      // Clone tasks to not modify props directly
      const tasksCopy = [...tasks];
      
      // Apply sorting based on current sort settings
      const sortedTasks = sortTasks(tasksCopy, sortConfig);
      
      // Apply filtering based on current filters
      const filteredTasks = filterTasks(sortedTasks, filterConfig);
      
      setDisplayedTasks(filteredTasks);
      
      // Also cache the tasks in localStorage for persistence across refreshes
      try {
        localStorage.setItem('displayed_tasks', JSON.stringify(filteredTasks));
      } catch (error) {
        console.warn('Failed to cache tasks in localStorage:', error);
      }
    } else {
      // Try to get tasks from localStorage as a fallback
      try {
        const cachedTasks = localStorage.getItem('displayed_tasks');
        if (cachedTasks) {
          setDisplayedTasks(JSON.parse(cachedTasks));
        }
      } catch (error) {
        console.warn('Failed to get cached tasks from localStorage:', error);
        setDisplayedTasks([]);
      }
    }
  }, [tasks, sortConfig, filterConfig]);
  
  return (
    <div className="task-list">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4>Your Tasks</h4>
        <Button 
          variant="primary" 
          size="sm" 
          onClick={toggleNewTaskForm}
        >
          <FontAwesomeIcon icon={faPlus} className="me-1" />
          New Task
        </Button>
      </div>
      
      {/* New Task Form */}
      {showNewTaskForm && (
        <Card className="mb-4">
          <Card.Body>
            <Form onSubmit={handleSubmitTask}>
              <Row>
                <Col md={8}>
                  <Form.Group className="mb-3">
                    <Form.Label>Title</Form.Label>
                    <InputGroup>
                      <Form.Control
                        type="text"
                        name="title"
                        value={newTask.title}
                        onChange={handleInputChange}
                        placeholder="Enter task title (optional)"
                      />
                      <Button 
                        variant="outline-secondary" 
                        onClick={expandTaskDescription}
                        disabled={!newTask.title.trim() || isExpandingDescription}
                      >
                        {isExpandingDescription ? 'Expanding...' : 'AI Expand'}
                      </Button>
                    </InputGroup>
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group className="mb-3">
                    <Form.Label>Priority</Form.Label>
                    <Form.Select 
                      name="priority" 
                      value={newTask.priority}
                      onChange={handleInputChange}
                    >
                      <option value={1}>High</option>
                      <option value={2}>Medium-High</option>
                      <option value={3}>Medium</option>
                      <option value={4}>Medium-Low</option>
                      <option value={5}>Low</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
              </Row>
              
              <Form.Group className="mb-3">
                <Form.Label>Description</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  name="description"
                  value={newTask.description}
                  onChange={handleInputChange}
                  placeholder="Describe the task..."
                />
              </Form.Group>
              
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Due Date</Form.Label>
                    <Form.Control
                      type="date"
                      name="due_date"
                      value={newTask.due_date}
                      onChange={handleInputChange}
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Status</Form.Label>
                    <Form.Select 
                      name="status" 
                      value={newTask.status}
                      onChange={handleInputChange}
                    >
                      <option value="not_started">Not Started</option>
                      <option value="in_progress">In Progress</option>
                      <option value="blocked">Blocked</option>
                      <option value="deferred">Deferred</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
              </Row>
              
              <Form.Group className="mb-3">
                <Form.Label>Tags</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="Type and press Enter to add tags"
                  onKeyDown={handleTagInput}
                />
                <div className="mt-2">
                  {newTask.tags.map((tag, index) => (
                    <Badge 
                      key={index} 
                      bg="light" 
                      text="dark" 
                      className="me-1 mb-1 p-2"
                      style={{ cursor: 'pointer' }}
                      onClick={() => removeTag(tag)}
                    >
                      {tag} &times;
                    </Badge>
                  ))}
                </div>
              </Form.Group>
              
              <div className="d-flex justify-content-end">
                <Button variant="secondary" className="me-2" onClick={toggleNewTaskForm}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit">
                  Create Task
                </Button>
              </div>
            </Form>
          </Card.Body>
        </Card>
      )}
      
      {/* Task List */}
      {displayedTasks.length === 0 ? (
        <div className="text-center p-4 bg-light rounded">
          <p>No tasks yet. Create one to get started!</p>
        </div>
      ) : (
        <div>
          {displayedTasks.map(task => (
            <div key={task.id} className={`task-item shadow-sm priority-${task.priority}`}>
              <Row>
                <Col>
                  <div className="d-flex align-items-center mb-2">
                    <h5 className="task-title mb-0 me-2">{task.title}</h5>
                    {getPriorityBadge(task.priority)}
                    {getStatusBadge(task.status)}
                  </div>
                  <p className="task-description">{
                    task.description 
                      ? (task.description.length > 100 
                          ? `${task.description.substring(0, 100)}...` 
                          : task.description)
                      : 'No description provided'
                  }</p>
                  <div className="task-meta">
                    {task.due_date && (
                      <div>
                        <FontAwesomeIcon icon={faCalendarAlt} /> 
                        {new Date(task.due_date).toLocaleDateString()}
                      </div>
                    )}
                    {task.estimated_minutes && (
                      <div>
                        <FontAwesomeIcon icon={faClock} /> 
                        {Math.floor(task.estimated_minutes / 60)}h {task.estimated_minutes % 60}m
                      </div>
                    )}
                    {task.tags && task.tags.length > 0 && (
                      <div>
                        <FontAwesomeIcon icon={faTags} /> 
                        {task.tags.slice(0, 2).join(', ')}
                        {task.tags.length > 2 && '...'}
                      </div>
                    )}
                    {task.status === 'blocked' && (
                      <div className="text-danger">
                        <FontAwesomeIcon icon={faExclamationTriangle} /> Blocked
                      </div>
                    )}
                  </div>
                </Col>
                <Col xs="auto" className="d-flex align-items-center">
                  <Button 
                    variant="outline-success" 
                    size="sm"
                    className="me-2"
                    onClick={() => handleCompleteTask(task.id)}
                  >
                    <FontAwesomeIcon icon={faCheck} />
                  </Button>
                  <DropdownButton
                    variant="outline-secondary"
                    size="sm"
                    title={<FontAwesomeIcon icon={faEllipsisV} />}
                    id={`dropdown-task-${task.id}`}
                  >
                    <Dropdown.Item onClick={() => openTaskModal(task)}>View Details</Dropdown.Item>
                    <Dropdown.Item>Edit</Dropdown.Item>
                    <Dropdown.Item>Set as Current</Dropdown.Item>
                    <Dropdown.Divider />
                    <Dropdown.Item className="text-danger">Delete</Dropdown.Item>
                  </DropdownButton>
                </Col>
              </Row>
            </div>
          ))}
        </div>
      )}
      
      {/* Task Detail Modal */}
      <Modal show={showTaskModal} onHide={() => setShowTaskModal(false)} size="lg">
        {selectedTask && (
          <>
            <Modal.Header closeButton>
              <Modal.Title>
                {selectedTask.title}
              </Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <div className="d-flex mb-3">
                <div className="me-3">
                  <strong>Priority:</strong> {getPriorityBadge(selectedTask.priority)}
                </div>
                <div className="me-3">
                  <strong>Status:</strong> {getStatusBadge(selectedTask.status)}
                </div>
                {selectedTask.due_date && (
                  <div>
                    <strong>Due Date:</strong> {new Date(selectedTask.due_date).toLocaleDateString()}
                  </div>
                )}
              </div>
              
              <h6>Description</h6>
              <p>{selectedTask.description || 'No description provided'}</p>
              
              {selectedTask.tags && selectedTask.tags.length > 0 && (
                <div className="mb-3">
                  <h6>Tags</h6>
                  <div>
                    {selectedTask.tags.map((tag, index) => (
                      <Badge key={index} bg="light" text="dark" className="me-1 p-2">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="d-flex justify-content-between text-muted mt-4">
                <small>Created: {new Date(selectedTask.created_at).toLocaleString()}</small>
                <small>Last Updated: {new Date(selectedTask.updated_at).toLocaleString()}</small>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setShowTaskModal(false)}>
                Close
              </Button>
              <Button variant="success" onClick={() => {
                handleCompleteTask(selectedTask.id);
                setShowTaskModal(false);
              }}>
                Mark Complete
              </Button>
            </Modal.Footer>
          </>
        )}
      </Modal>
    </div>
  );
};

export default TaskList; 