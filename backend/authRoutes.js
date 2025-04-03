const express = require('express');
const router = express.Router();
const { supabase } = require('./supabaseClient');
const supabaseUserService = require('./supabaseUserService');

/**
 * Register a new user
 * POST /api/auth/register
 */
router.post('/register', async (req, res) => {
  const { email, password, firstName, lastName } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ 
      success: false,
      error: 'Email and password are required' 
    });
  }
  
  try {
    const { data, error } = await supabaseUserService.createUser(
      email, 
      password, 
      { 
        first_name: firstName || '',
        last_name: lastName || '',
      }
    );
    
    if (error) {
      return res.status(400).json({ 
        success: false,
        error: error.message 
      });
    }
    
    return res.status(201).json({ 
      success: true,
      message: 'User registered successfully',
      userId: data.user.id 
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Failed to register user' 
    });
  }
});

/**
 * Update user profile
 * PUT /api/auth/profile
 */
router.put('/profile', async (req, res) => {
  const { userId } = req;
  
  if (!userId) {
    return res.status(401).json({ 
      success: false,
      error: 'Unauthorized' 
    });
  }
  
  const { firstName, lastName, avatarUrl, ...otherFields } = req.body;
  
  try {
    // Update user metadata in Auth
    if (firstName || lastName) {
      const metadata = {};
      if (firstName) metadata.first_name = firstName;
      if (lastName) metadata.last_name = lastName;
      
      await supabaseUserService.updateUserMetadata(userId, metadata);
    }
    
    // Update profile in database
    const profileData = {
      first_name: firstName,
      last_name: lastName,
      avatar_url: avatarUrl,
      ...otherFields
    };
    
    // Filter out undefined values
    Object.keys(profileData).forEach(key => 
      profileData[key] === undefined && delete profileData[key]
    );
    
    const { data, error } = await supabaseUserService.createUserProfile(userId, profileData);
    
    if (error) {
      return res.status(400).json({ 
        success: false,
        error: error.message 
      });
    }
    
    return res.status(200).json({ 
      success: true,
      profile: data 
    });
  } catch (error) {
    console.error('Profile update error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Failed to update profile' 
    });
  }
});

/**
 * Get user profile
 * GET /api/auth/profile
 */
router.get('/profile', async (req, res) => {
  const { userId } = req;
  
  if (!userId) {
    return res.status(401).json({ 
      success: false,
      error: 'Unauthorized' 
    });
  }
  
  try {
    // Get user data from Supabase
    const { data: userData, error: userError } = await supabaseUserService.getUserById(userId);
    
    if (userError) {
      return res.status(400).json({ 
        success: false,
        error: userError.message 
      });
    }
    
    // Get profile data
    const { data: profileData, error: profileError } = await supabaseUserService.getUserProfile(userId);
    
    // Combine user and profile data
    const userProfile = {
      id: userData.user.id,
      email: userData.user.email,
      firstName: userData.user.user_metadata?.first_name || '',
      lastName: userData.user.user_metadata?.last_name || '',
      createdAt: userData.user.created_at,
      ...profileData
    };
    
    return res.status(200).json({ 
      success: true,
      profile: userProfile 
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Failed to get profile' 
    });
  }
});

/**
 * Change password
 * POST /api/auth/change-password
 */
router.post('/change-password', async (req, res) => {
  const { userId } = req;
  
  if (!userId) {
    return res.status(401).json({ 
      success: false,
      error: 'Unauthorized' 
    });
  }
  
  const { currentPassword, newPassword } = req.body;
  
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ 
      success: false,
      error: 'Current password and new password are required' 
    });
  }
  
  try {
    // Use Supabase's updateUserById to update password
    const { error } = await supabase.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    );
    
    if (error) {
      return res.status(400).json({ 
        success: false,
        error: error.message 
      });
    }
    
    return res.status(200).json({ 
      success: true,
      message: 'Password updated successfully' 
    });
  } catch (error) {
    console.error('Password change error:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Failed to change password' 
    });
  }
});

module.exports = router; 