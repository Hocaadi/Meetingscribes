const { supabase } = require('../supabaseClient');

/**
 * Middleware to authenticate users with JWT
 * Allows development mode fallback for easier testing
 */
const authenticateJWT = async (req, res, next) => {
  const isDev = process.env.NODE_ENV !== 'production';
  
  // Get the auth header
  const authHeader = req.headers.authorization;
  
  // Also support x-user-id header for backward compatibility and testing
  const userId = req.headers['x-user-id'] || req.query.userId;
  
  // Generate a random development user ID if needed
  const devUserId = `dev-user-${Math.floor(Math.random() * 1000)}`;
  
  // Set the user object on the request with a fallback ID for development
  req.user = { user_id: userId || devUserId, role: 'anonymous' };
  
  // Log authentication attempt if in development mode
  if (isDev) {
    console.log(`Auth middleware: ${authHeader ? 'Using JWT' : (userId ? 'Using header/query user ID' : 'Using generated dev ID')}`);
  }
  
  try {
    // First try to use JWT from Authorization header
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      
      try {
        // Verify with Supabase
        const { data, error } = await supabase.auth.getUser(token);
        
        if (error) {
          console.error('Auth error:', error.message);
          
          // In development mode, accept requests with auth errors
          if (isDev) {
            console.log('Development mode - allowing request despite auth error');
            
            // If x-user-id header is provided, use it
            if (userId) {
              req.user = { user_id: userId, role: 'anonymous' };
            }
            
            return next();
          }
        } else if (data && data.user) {
          // Set user info on request
          req.user = {
            user_id: data.user.id,
            email: data.user.email,
            role: data.user.role || 'authenticated',
            metadata: data.user.user_metadata
          };
          
          if (isDev) {
            console.log(`Authenticated as user: ${req.user.user_id}`);
          }
          
          return next();
        }
      } catch (err) {
        console.error('JWT verification error:', err.message);
      }
    }
    
    // Fallback to x-user-id header if available
    if (userId) {
      console.log(`Using user ID from request for authentication: ${userId}`);
      req.user = { user_id: userId, role: 'anonymous' };
      return next();
    }
    
    // In development mode, accept anonymous requests with a dev user ID
    if (isDev) {
      console.log(`Development mode - allowing anonymous request with dev ID: ${devUserId}`);
      req.user = { user_id: devUserId, role: 'anonymous' };
      return next();
    }
    
    // In production, require authentication
    return res.status(401).json({ error: 'Authentication required' });
  } catch (error) {
    console.error('Authentication middleware error:', error);
    
    // Allow request to proceed in development
    if (isDev) {
      console.log(`Development mode - allowing request despite error, using ID: ${userId || devUserId}`);
      req.user = { user_id: userId || devUserId, role: 'anonymous' };
      return next();
    }
    
    return res.status(500).json({ error: 'Authentication error' });
  }
};

module.exports = { authenticateJWT }; 