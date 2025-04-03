/**
 * Health check routes for monitoring backend service status
 */
const express = require('express');
const router = express.Router();
const os = require('os');

// Basic health check endpoint
router.get('/', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    hostname: os.hostname(),
    cors: 'enabled'
  });
});

// Detailed health check with service dependencies
router.get('/detailed', async (req, res) => {
  try {
    // Get system metrics
    const systemInfo = {
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      uptime: os.uptime()
    };
    
    // Process information
    const processInfo = {
      pid: process.pid,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.version,
      env: process.env.NODE_ENV
    };
    
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      system: systemInfo,
      process: processInfo,
      cors: 'enabled',
      message: 'Service is running properly'
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

module.exports = router; 