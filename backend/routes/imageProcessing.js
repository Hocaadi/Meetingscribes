/**
 * Image Processing API Routes
 * Handles Ghibli-style image generation using AI
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const unlinkAsync = promisify(fs.unlink);
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// Import user request tracker for managing usage limits
const userRequestTracker = require('../userRequestTracker');

// Set up storage for uploaded images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/images/');
  },
  filename: (req, file, cb) => {
    // Generate unique filename with original extension
    const uniqueId = uuidv4();
    const extension = path.extname(file.originalname);
    cb(null, `${uniqueId}${extension}`);
  }
});

// Configure file upload middleware with size limit
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    // Accept only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Image Processing API is running' });
});

/**
 * Analyze image and generate a prompt for Ghibli-style generation
 * Uses OpenAI's Vision API to analyze the image content
 */
router.post('/analyze', upload.single('image'), async (req, res) => {
  // Check if file was uploaded
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No image uploaded' });
  }

  const imageFile = req.file;
  const userId = req.body.userId || 'anonymous';
  const isAdmin = req.body.isAdmin === 'true';
  const customPrompt = req.body.customPrompt || '';

  try {
    // Check if user has permission (premium or admin)
    if (!isAdmin) {
      const userCheck = await userRequestTracker.checkUserAccess(userId, 'ghibli');
      
      if (userCheck.upgradeRequired) {
        throw new Error('Premium feature: Please upgrade your account to access this feature');
      }
    }

    // Get the absolute path to the uploaded file
    const imagePath = path.join(process.cwd(), imageFile.path);
    const imageData = fs.readFileSync(imagePath, { encoding: 'base64' });
    
    // In development/demo mode, skip real API calls
    if (process.env.NODE_ENV === 'development' || process.env.DEMO_MODE === 'true') {
      console.log('Development mode: Simulating image analysis API call');
      
      // Create a mock generated prompt based on any custom input
      let generatedPrompt = "A Studio Ghibli style illustration featuring a serene landscape with rolling hills, " +
        "a small cottage with a red roof, wispy clouds in a bright blue sky, and delicate wildflowers " +
        "swaying in the gentle breeze. The scene has soft lighting with Miyazaki's distinctive style " +
        "and warm color palette.";
        
      if (customPrompt) {
        generatedPrompt = `A Studio Ghibli style illustration based on: ${customPrompt}. ` +
          "Using Miyazaki's distinctive style, soft lighting, and warm color palette.";
      }
      
      // Clean up the uploaded file
      await unlinkAsync(imagePath);
      
      return res.json({ 
        success: true,
        prompt: generatedPrompt,
        message: 'Analysis completed successfully'
      });
    }
    
    // Prepare request to OpenAI Vision API
    const messages = [
      {
        role: "system",
        content: "You are an expert at analyzing images and creating detailed prompts for image generation in Studio Ghibli style. Describe the scene in detail, focusing on elements that would make a beautiful Ghibli-style illustration."
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: customPrompt ? 
              `Analyze this image and create a detailed prompt to transform it into a Studio Ghibli style illustration. Consider this guidance from the user: ${customPrompt}` :
              "Analyze this image and create a detailed prompt to transform it into a Studio Ghibli style illustration."
          },
          {
            type: "image_url",
            image_url: {
              url: `data:${imageFile.mimetype};base64,${imageData}`
            }
          }
        ]
      }
    ];

    // Call OpenAI API
    const openaiResponse = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: "gpt-4-vision-preview",
        messages,
        max_tokens: 500
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        }
      }
    );

    // Extract the generated prompt
    if (!openaiResponse.data || !openaiResponse.data.choices || openaiResponse.data.choices.length === 0) {
      throw new Error('Failed to generate a prompt from the image');
    }

    const generatedPrompt = openaiResponse.data.choices[0].message.content;
    
    // Track this usage for the user (if not admin)
    if (!isAdmin) {
      await userRequestTracker.recordRequest(userId, 'ghibli_analysis');
    }
    
    // Clean up the uploaded file
    await unlinkAsync(imagePath);

    // Return the generated prompt
    res.json({
      success: true,
      prompt: generatedPrompt,
      message: 'Analysis completed successfully'
    });
  } catch (error) {
    console.error('Error analyzing image:', error);
    
    // Clean up the uploaded file if it exists
    if (imageFile && imageFile.path) {
      try {
        await unlinkAsync(imageFile.path);
      } catch (unlinkError) {
        console.error('Error deleting uploaded file:', unlinkError);
      }
    }
    
    // Return error to client
    res.status(error.response?.status || 500).json({
      success: false,
      message: error.message || 'Failed to analyze image',
      error: error.response?.data || error.toString()
    });
  }
});

/**
 * Generate Ghibli-style image from a prompt
 * Uses DALL-E 3 to create the image
 */
router.post('/generate-ghibli', async (req, res) => {
  const { prompt, userId, isAdmin } = req.body;
  
  if (!prompt) {
    return res.status(400).json({ success: false, message: 'Prompt is required' });
  }
  
  try {
    // Check if user has permission (premium or admin)
    if (!isAdmin) {
      const userCheck = await userRequestTracker.checkUserAccess(userId || 'anonymous', 'ghibli');
      
      if (userCheck.upgradeRequired) {
        throw new Error('Premium feature: Please upgrade your account to access this feature');
      }
    }
    
    // Enhance the prompt with Ghibli-specific details
    const enhancedPrompt = `Create a Studio Ghibli style illustration with the following scene: ${prompt}. ` +
      "The image should have Miyazaki's distinctive art style with soft lighting, painterly details, " +
      "and the characteristic warm color palette seen in films like Spirited Away and Howl's Moving Castle. " +
      "Include small, intricate details and a sense of wonder. Make sure the style perfectly mimics the Studio Ghibli animation style.";
    
    // In development/demo mode, skip real API calls
    if (process.env.NODE_ENV === 'development' || process.env.DEMO_MODE === 'true') {
      console.log('Development mode: Simulating DALL-E API call with prompt:', enhancedPrompt);
      
      // Return mock image URL
      return res.json({ 
        success: true,
        imageUrl: 'https://via.placeholder.com/800x600?text=Ghibli+Style+Image+Simulation',
        message: 'Image generated successfully'
      });
    }
    
    // Call OpenAI DALL-E 3 API
    const dalleResponse = await axios.post(
      'https://api.openai.com/v1/images/generations',
      {
        model: "dall-e-3",
        prompt: enhancedPrompt,
        n: 1,
        size: "1024x1024",
        response_format: "url"
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        }
      }
    );

    // Extract the generated image URL
    if (!dalleResponse.data || !dalleResponse.data.data || dalleResponse.data.data.length === 0) {
      throw new Error('Failed to generate an image');
    }

    const imageUrl = dalleResponse.data.data[0].url;
    const revisedPrompt = dalleResponse.data.data[0].revised_prompt || enhancedPrompt;
    
    // Track this usage for the user (if not admin)
    if (!isAdmin) {
      await userRequestTracker.recordRequest(userId || 'anonymous', 'ghibli_generation');
    }

    // Return the generated image URL
    res.json({
      success: true,
      imageUrl: imageUrl,
      prompt: revisedPrompt,
      message: 'Image generated successfully'
    });
  } catch (error) {
    console.error('Error generating image:', error);
    
    // Return error to client
    res.status(error.response?.status || 500).json({
      success: false,
      message: error.message || 'Failed to generate image',
      error: error.response?.data || error.toString()
    });
  }
});

module.exports = router; 