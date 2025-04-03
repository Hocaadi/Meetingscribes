import React, { useState } from 'react';
import supabase from '../../supabaseClient';
import { Button, Modal, Alert, Spinner } from 'react-bootstrap';
import WorkProgressService from '../../services/WorkProgressService';

const ResetDatabaseUtils = () => {
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [logMessages, setLogMessages] = useState([]);

  const addLog = (message) => {
    setLogMessages(prev => [...prev, { time: new Date().toISOString(), message }]);
  };

  const testTaskCreation = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    addLog('Testing task creation...');

    try {
      const testTask = {
        title: `Test Task ${Date.now()}`,
        description: 'This is a test task created to verify database connectivity',
        status: 'not_started',
        priority: 3
      };

      addLog(`Creating task: ${testTask.title}`);
      const createdTask = await WorkProgressService.createTask(testTask);
      
      if (createdTask) {
        addLog(`SUCCESS! Task created with ID: ${createdTask.id}`);
        setResult({
          success: true,
          message: 'Task created successfully',
          data: createdTask
        });
      } else {
        throw new Error('Task creation returned empty result');
      }
    } catch (err) {
      addLog(`ERROR: ${err.message}`);
      setError(`Task creation failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const resetUserProfile = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    addLog('Starting profile reset...');

    try {
      // Get current session
      const { data: sessionData } = await supabase.auth.getSession();
      
      if (!sessionData.session) {
        addLog('ERROR: No active session found');
        setError('No active session found. Please login first.');
        setLoading(false);
        return;
      }

      const userId = sessionData.session.user.id;
      addLog(`Found user session with ID: ${userId}`);

      // Delete existing profile if any
      addLog('Deleting existing profile...');
      const { error: deleteError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (deleteError) {
        addLog(`Warning during profile deletion: ${deleteError.message}`);
      } else {
        addLog('Existing profile deleted successfully');
      }

      // Create new profile
      addLog('Creating new profile...');
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert([{
          id: userId,
          first_name: 'Admin',
          last_name: 'User',
          email: sessionData.session.user.email || 'admin@meetingscribe.dev',
          updated_at: new Date().toISOString()
        }])
        .select();

      if (createError) {
        throw new Error(`Profile creation error: ${createError.message}`);
      }

      addLog('Profile created successfully');
      setResult({
        success: true,
        message: 'User profile has been reset successfully',
        data: newProfile
      });

      // Test task creation
      await testTaskCreation();
    } catch (err) {
      addLog(`ERROR: ${err.message}`);
      setError(`Profile reset failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div style={{ position: 'fixed', bottom: '10px', right: '100px', zIndex: 1000 }}>
        <Button
          variant="danger"
          size="sm"
          onClick={() => setShowModal(true)}
          style={{ opacity: 0.7 }}
        >
          DB Utils
        </Button>
      </div>

      <Modal show={showModal} onHide={() => setShowModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Database Utilities</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Use these tools to fix database issues:</p>

          {error && (
            <Alert variant="danger">
              {error}
            </Alert>
          )}

          {result && (
            <Alert variant="success">
              {result.message}
            </Alert>
          )}

          <div className="mb-3">
            <Button
              variant="warning"
              onClick={resetUserProfile}
              disabled={loading}
              className="me-2"
            >
              {loading ? (
                <>
                  <Spinner
                    as="span"
                    animation="border"
                    size="sm"
                    role="status"
                    aria-hidden="true"
                  />
                  <span className="ms-2">Processing...</span>
                </>
              ) : (
                'Reset User Profile'
              )}
            </Button>

            <Button
              variant="info"
              onClick={testTaskCreation}
              disabled={loading}
            >
              Test Task Creation
            </Button>
          </div>

          <div style={{ maxHeight: '200px', overflow: 'auto', fontSize: '0.8rem' }}>
            <h6>Log:</h6>
            {logMessages.map((log, index) => (
              <div key={index}>
                <span className="text-muted">[{new Date(log.time).toLocaleTimeString()}]</span>{' '}
                {log.message}
              </div>
            ))}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default ResetDatabaseUtils; 