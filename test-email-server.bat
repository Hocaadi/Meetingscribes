@echo off
ECHO =======================================================
ECHO MeetingScribe Email Configuration Test
ECHO =======================================================
ECHO.
ECHO This script will:
ECHO 1. Test your email configuration
ECHO 2. Start both backend and frontend servers
ECHO.
ECHO Press CTRL+C at any time to exit
ECHO.
ECHO Running email test...
ECHO.

cd backend
node test-email.js

ECHO.
ECHO =======================================================
ECHO Test completed. Starting servers...
ECHO =======================================================
ECHO.
ECHO Press CTRL+C to stop the servers when done
ECHO.

cd ..
npm start 