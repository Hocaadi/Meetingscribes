const express = require('express');
const router = express.Router();
// Removing Razorpay dependency
// const Razorpay = require('razorpay');
const crypto = require('crypto');
const supabaseUserService = require('./supabaseUserService');

// Remove Razorpay initialization
// const razorpay = new Razorpay({
//   key_id: process.env.RAZORPAY_KEY_ID || '',
//   key_secret: process.env.RAZORPAY_KEY_SECRET || ''
// });

// Simple endpoint to create an order (can be expanded with actual payment processor)
router.post('/create-order', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Create a mock order (in production, you'd integrate with a payment gateway)
    const mockOrder = {
      id: 'order_' + Date.now(),
      amount: 1500, // $15.00
      currency: 'USD'
    };
    
    console.log(`Mock payment order created for user ${userId}: ${mockOrder.id}`);

    // Return mock order details to frontend
    return res.status(200).json({
      orderId: mockOrder.id,
      amount: mockOrder.amount,
      currency: mockOrder.currency,
      keyId: 'DUMMY_KEY'
    });
  } catch (error) {
    console.error('Error creating payment order:', error);
    return res.status(500).json({ error: 'Failed to create payment order' });
  }
});

// Process successful payment and save to Supabase
router.post('/verify-payment', async (req, res) => {
  try {
    const { userId, planType } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'Missing required user ID' });
    }
    
    // Upgrade the user to premium using Supabase
    const success = await supabaseUserService.upgradeToPremium(userId, planType || 'monthly');
    
    if (success) {
      console.log(`User ${userId} upgraded to premium via Supabase`);
      
      return res.status(200).json({
        message: 'Payment verified and subscription activated',
        isPremium: true
      });
    } else {
      return res.status(500).json({ error: 'Failed to upgrade subscription in database' });
    }
  } catch (error) {
    console.error('Error verifying payment:', error);
    return res.status(500).json({ error: 'Failed to verify payment' });
  }
});

// Check premium status from Supabase
router.get('/premium-status', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    const isPremium = await supabaseUserService.isPremiumUser(userId);
    
    return res.status(200).json({
      isPremium
    });
  } catch (error) {
    console.error('Error checking premium status:', error);
    return res.status(500).json({ error: 'Failed to check premium status' });
  }
});

// Direct upgrade endpoint for testing
router.post('/test-upgrade', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'];
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    // Use Supabase to upgrade the user
    const success = await supabaseUserService.upgradeToPremium(userId, 'monthly');
    
    if (success) {
      return res.status(200).json({
        message: 'User upgraded to premium successfully via Supabase',
        isPremium: true
      });
    } else {
      return res.status(500).json({ error: 'Failed to upgrade user' });
    }
  } catch (error) {
    console.error('Error in test upgrade:', error);
    return res.status(500).json({ error: 'Failed to upgrade user' });
  }
});

module.exports = router; 