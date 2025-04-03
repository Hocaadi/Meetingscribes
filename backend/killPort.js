/**
 * Helper script to kill processes using port 5000
 * Run with: node killPort.js
 */

const { exec } = require('child_process');
const PORT = 5000;

console.log(`Attempting to find and kill processes using port ${PORT}...`);

if (process.platform === 'win32') {
  // Windows
  const findCommand = `netstat -ano | findstr :${PORT}`;
  
  exec(findCommand, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error finding process: ${error.message}`);
      return;
    }
    
    if (stderr) {
      console.error(`Command error: ${stderr}`);
      return;
    }
    
    if (!stdout) {
      console.log(`No process found using port ${PORT}`);
      return;
    }
    
    // Extract PID from the output
    const lines = stdout.trim().split('\n');
    const pids = new Set();
    
    lines.forEach(line => {
      const parts = line.trim().split(/\s+/);
      if (parts.length > 4) {
        const pid = parts[parts.length - 1];
        if (pid && !isNaN(parseInt(pid))) {
          pids.add(pid);
        }
      }
    });
    
    if (pids.size === 0) {
      console.log(`No process found using port ${PORT}`);
      return;
    }
    
    console.log(`Found process IDs: ${Array.from(pids).join(', ')}`);
    
    // Kill each process
    pids.forEach(pid => {
      exec(`taskkill /F /PID ${pid}`, (killError, killStdout, killStderr) => {
        if (killError) {
          console.error(`Error killing process ${pid}: ${killError.message}`);
          return;
        }
        
        console.log(`Successfully killed process ${pid}`);
      });
    });
  });
} else {
  // Linux/Mac
  exec(`lsof -i :${PORT} | grep LISTEN | awk '{print $2}'`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error finding process: ${error.message}`);
      return;
    }
    
    if (!stdout) {
      console.log(`No process found using port ${PORT}`);
      return;
    }
    
    const pid = stdout.trim();
    console.log(`Found process ID: ${pid}`);
    
    exec(`kill -9 ${pid}`, (killError, killStdout, killStderr) => {
      if (killError) {
        console.error(`Error killing process: ${killError.message}`);
        return;
      }
      
      console.log(`Successfully killed process ${pid}`);
    });
  });
} 