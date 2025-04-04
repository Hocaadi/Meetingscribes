# Deployment Instructions

## Required Environment Variables

### Backend Deployment (Render, Heroku, or similar)

```
# Node environment
NODE_ENV=production
PORT=5000

# CORS settings
ALLOWED_ORIGINS=https://meetingscribe--zeta.vercel.app,https://meetingscribe.vercel.app,https://meetingscribe-zeta.vercel.app

# API settings
API_BASE_URL=https://your-backend-url.com

# Socket.io settings
SOCKETIO_PINGINTERVAL=25000
SOCKETIO_PINGTIMEOUT=60000
```

### Frontend Deployment (Vercel)

```
# API URL pointing to your backend
REACT_APP_API_URL=https://your-backend-url.com

# Force production mode
NODE_ENV=production
```

## Deployment Steps

### Deploying to Render.com

1. Create a new Web Service
2. Connect your GitHub repository
3. Set the build command to:
   ```
   cd backend && npm install
   ```
4. Set the start command to:
   ```
   cd backend && node server.js
   ```
5. Add all the environment variables from the Backend section above
6. Enable auto-deploy from your main branch

### Deploying Frontend to Vercel

1. Create a new project on Vercel
2. Connect your GitHub repository
3. Set the framework preset to "Create React App"
4. Configure the build settings:
   - Build Command: `cd frontend && npm install && npm run build`
   - Output Directory: `frontend/build`
5. Add the environment variables from the Frontend section above
6. Deploy

## Testing the Deployment

After deploying, run the following checks:

1. Test basic API connectivity: 
   ```
   curl https://your-backend-url.com/api/health
   ```

2. Test CORS configuration:
   ```
   curl -H "Origin: https://meetingscribe--zeta.vercel.app" \
        -H "Access-Control-Request-Method: GET" \
        -H "Access-Control-Request-Headers: X-Requested-With" \
        -X OPTIONS --verbose \
        https://your-backend-url.com/api/health
   ```

3. Visit the frontend URL and check browser console for CORS errors

## Troubleshooting

### Common Issues

#### CORS Errors
If you're still seeing CORS errors:
1. Check that your `ALLOWED_ORIGINS` in the backend includes your frontend URL
2. Make sure the frontend's API_URL is correct
3. Temporarily enable the CORS proxy by setting in localStorage:
   ```javascript
   // Run in browser console
   localStorage.setItem('use_proxy', 'true')
   ```

#### Socket.io Connection Issues
If WebSocket connections aren't working:
1. Check that your firewall allows WebSocket connections
2. Try switching to HTTP long polling in the frontend by setting:
   ```javascript
   // Run in browser console
   localStorage.setItem('socket_transport', 'polling')
   ```

#### 502 Bad Gateway
This usually indicates the backend service is not running or is crashing:
1. Check Render.com logs for errors
2. Make sure your service has sufficient resources (memory, CPU)
3. Consider upgrading from the free tier if you're experiencing limitations

## Support

For any deployment issues, please contact the development team at [support email]. 