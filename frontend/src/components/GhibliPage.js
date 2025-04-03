import React, { useState, useRef, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Alert, Form, ProgressBar, Spinner } from 'react-bootstrap';
import { useUser } from '../contexts/AuthContext';
import axios from 'axios';
import config from '../config';
import './GhibliPage.css';

const GhibliPage = () => {
  const { user, isLoaded: isUserLoaded } = useUser();
  const [selectedImage, setSelectedImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [outputUrl, setOutputUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [isPremium, setIsPremium] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showPremiumAlert, setShowPremiumAlert] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const fileInputRef = useRef(null);

  // Check if user is premium or admin
  useEffect(() => {
    if (isUserLoaded && user) {
      // Check if user is premium
      const userMetadata = user.publicMetadata || {};
      const isPremiumUser = userMetadata.plan === 'premium' || false;
      
      // Check if user is admin
      const isAdminUser = user.isAdmin || user.role === 'admin' || false;
      
      setIsPremium(isPremiumUser);
      setIsAdmin(isAdminUser);
      
      console.log('User access check:', { isPremium: isPremiumUser, isAdmin: isAdminUser });
    }
  }, [user, isUserLoaded]);

  // Log API URL for debugging
  useEffect(() => {
    console.log('Current API URL configuration:', {
      API_URL: config.API_URL,
      NODE_ENV: process.env.NODE_ENV,
      REACT_APP_API_URL: process.env.REACT_APP_API_URL,
      imageAnalyzeEndpoint: `${config.API_URL}/api/image/analyze`
    });
  }, []);

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Reset states
      setSelectedImage(file);
      setOutputUrl('');
      setError('');
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.match('image.*')) {
      setSelectedImage(file);
      setOutputUrl('');
      setError('');
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleProcess = async () => {
    // Check if user has access (premium or admin)
    if (!isPremium && !isAdmin) {
      setShowPremiumAlert(true);
      return;
    }

    if (!selectedImage) {
      setError('Please select an image first');
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setGeneratedPrompt('');
    
    // Create progress updates
    const interval = setInterval(() => {
      setProgress(prev => {
        const newProgress = prev + Math.floor(Math.random() * 10);
        return newProgress > 90 ? 90 : newProgress;
      });
    }, 500);

    try {
      // First, we'll analyze the image to create a prompt
      const formData = new FormData();
      formData.append('image', selectedImage);
      
      if (customPrompt) {
        formData.append('customPrompt', customPrompt);
      }
      
      // Add user data for tracking
      if (user && user.id) {
        formData.append('userId', user.id);
      }
      
      if (isAdmin) {
        formData.append('isAdmin', 'true');
      }
      
      // Simulated two-step process:
      // 1. Analyze image to generate a prompt (using OpenAI Vision API)
      // 2. Generate Ghibli style image based on the prompt (using DALL-E 3 or similar)
      
      console.log('Processing image to generate Ghibli artwork');
      
      // In development/demo, use setTimeout to simulate API call
      if (process.env.NODE_ENV === 'development' || !config.API_URL) {
        console.log('Development mode: Using simulated response');
        
        // Create a simulated prompt based on the image
        setTimeout(() => {
          const mockPrompt = "A Studio Ghibli style illustration featuring a serene landscape with rolling hills, " +
            "a small cottage with a red roof, wispy clouds in a bright blue sky, and delicate wildflowers " +
            "swaying in the gentle breeze. The scene has soft lighting with Miyazaki's distinctive style " +
            "and warm color palette.";
            
          setGeneratedPrompt(mockPrompt);
          
          // For demo, just return the original image after a delay
          setTimeout(() => {
            clearInterval(interval);
            setProgress(100);
            setOutputUrl(previewUrl); // For demo, use original image
            setIsProcessing(false);
          }, 3000);
        }, 2000);
      } else {
        // In production, make actual API calls
        // 1. First analyze the image and generate a prompt
        console.log('Sending image for analysis to:', `${config.API_URL}/api/image/analyze`);
        try {
          // Add debug information
          console.log('Form data content:', {
            fileType: selectedImage.type,
            fileSize: selectedImage.size,
            fileName: selectedImage.name,
            customPrompt: !!customPrompt,
            userId: user?.id,
            isAdmin: isAdmin
          });
          
          const analysisResponse = await axios.post(`${config.API_URL}/api/image/analyze`, formData, {
            headers: { 
              'Content-Type': 'multipart/form-data',
              'x-user-id': user?.id || 'anonymous'
            },
            onUploadProgress: (progressEvent) => {
              const uploadPercent = Math.round((progressEvent.loaded * 30) / progressEvent.total);
              setProgress(uploadPercent);
            },
            // Add a longer timeout for image analysis
            timeout: 60000 // 1 minute timeout
          });
          
          console.log('Analysis response received:', analysisResponse.data);
          
          if (!analysisResponse.data.success) {
            throw new Error(analysisResponse.data.message || 'Failed to analyze image');
          }
          
          const generatedPrompt = analysisResponse.data.prompt;
          setGeneratedPrompt(generatedPrompt);
          
          // 2. Then generate the Ghibli style image using the prompt
          console.log('Generating Ghibli style image from prompt:', generatedPrompt);
          const generationResponse = await axios.post(`${config.API_URL}/api/image/generate-ghibli`, {
            prompt: generatedPrompt,
            userId: user?.id,
            isAdmin: isAdmin
          }, {
            headers: { 
              'x-user-id': user?.id || 'anonymous'
            },
            onDownloadProgress: (progressEvent) => {
              const downloadPercent = 30 + Math.round((progressEvent.loaded * 60) / progressEvent.total);
              setProgress(Math.min(downloadPercent, 90));
            },
            // Add a longer timeout for image generation
            timeout: 120000 // 2 minute timeout
          });
          
          console.log('Generation response received:', generationResponse.data);
          
          if (!generationResponse.data.success) {
            throw new Error(generationResponse.data.message || 'Failed to generate image');
          }
          
          clearInterval(interval);
          setProgress(100);
          setOutputUrl(generationResponse.data.imageUrl);
          setIsProcessing(false);
        } catch (apiError) {
          clearInterval(interval);
          console.error('Error processing image:', apiError);
          
          let errorMessage = apiError.message || 'Failed to process image. Please try again.';
          
          // Check if this is a network error (could be CORS, server offline, etc.)
          if (apiError.code === 'ERR_NETWORK') {
            errorMessage = config.ERROR_MESSAGES.NETWORK_ERROR;
          }
          
          // Check for 404 errors specifically
          if (apiError.response && apiError.response.status === 404) {
            errorMessage = config.ERROR_MESSAGES.API_404;
            console.error('API 404 error details:', {
              url: apiError.config.url,
              method: apiError.config.method,
              baseURL: apiError.config.baseURL,
              apiURL: config.API_URL
            });
          } else if (apiError.response) {
            // Log any other API errors
            console.error('API error details:', {
              status: apiError.response.status,
              data: apiError.response.data,
              url: apiError.config.url
            });
          }
          
          setError(errorMessage);
          setIsProcessing(false);
        }
      }
    } catch (err) {
      clearInterval(interval);
      console.error('Error processing image:', err);
      setError(err.message || 'Failed to process image. Please try again.');
      setIsProcessing(false);
    }
  };

  const resetForm = () => {
    setSelectedImage(null);
    setPreviewUrl('');
    setOutputUrl('');
    setError('');
    setProgress(0);
    setCustomPrompt('');
    setGeneratedPrompt('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="ghibli-page">
      <Container>
        <Row className="justify-content-center">
          <Col md={10} lg={8}>
            <div className="ghibli-header">
              <h1>GIBHLI Image Processor <span className="beta-badge">BETA</span></h1>
              <p>Transform your photos into beautiful Ghibli-style artwork using our AI-powered image processor</p>
              {isAdmin && (
                <Alert variant="info" className="mt-2">
                  <strong>Admin Mode:</strong> You have full access to the Ghibli image processor.
                </Alert>
              )}
            </div>

            {showPremiumAlert && (
              <Alert 
                variant="warning" 
                className="premium-alert"
                dismissible
                onClose={() => setShowPremiumAlert(false)}
              >
                <Alert.Heading>Premium Feature</Alert.Heading>
                <p>
                  Ghibli image processing is exclusively available to our premium users. 
                  Upgrade your plan to access this and other premium features.
                </p>
                <Button variant="warning" className="mt-2" as="a" href="#pricing">
                  Upgrade to Premium
                </Button>
              </Alert>
            )}

            <Card className="ghibli-card mb-4">
              <Card.Body>
                <h3 className="mb-3">Upload Your Image</h3>
                
                {error && <Alert variant="danger">{error}</Alert>}
                
                <div 
                  className={`upload-zone ${previewUrl ? 'has-image' : ''}`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {previewUrl ? (
                    <div className="preview-container">
                      <img src={previewUrl} alt="Preview" className="preview-image" />
                      <div className="preview-overlay">
                        <i className="bi bi-arrow-repeat"></i>
                        <span>Change Image</span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <i className="bi bi-cloud-arrow-up"></i>
                      <h4>Drag & drop your image here</h4>
                      <p>or click to browse your files</p>
                      <small>Supported formats: JPG, PNG, WEBP (Max size: 10MB)</small>
                    </>
                  )}
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleImageSelect}
                    accept="image/*"
                    className="d-none"
                  />
                </div>
                
                {previewUrl && !isProcessing && !outputUrl && (
                  <>
                    <div className="mt-4">
                      <Button 
                        variant="outline-secondary"
                        size="sm"
                        className="mb-3"
                        onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                      >
                        <i className={`bi ${showAdvancedOptions ? 'bi-chevron-up' : 'bi-chevron-down'} me-1`}></i>
                        {showAdvancedOptions ? 'Hide Advanced Options' : 'Show Advanced Options'}
                      </Button>
                      
                      {showAdvancedOptions && (
                        <Form.Group className="mb-3">
                          <Form.Label>Custom Prompt (Optional)</Form.Label>
                          <Form.Control
                            as="textarea"
                            rows={3}
                            placeholder="E.g., Transform this into a magical Ghibli forest scene with spirits hiding among the trees..."
                            value={customPrompt}
                            onChange={(e) => setCustomPrompt(e.target.value)}
                          />
                          <Form.Text className="text-muted">
                            Add custom instructions to guide the AI in generating your Ghibli artwork.
                          </Form.Text>
                        </Form.Group>
                      )}
                    </div>
                    
                    <div className="text-center mt-4">
                      <Button 
                        variant="primary" 
                        size="lg"
                        className="process-btn"
                        onClick={handleProcess}
                        disabled={isProcessing}
                      >
                        <i className="bi bi-magic me-2"></i>
                        Transform to Ghibli Style
                      </Button>
                    </div>
                  </>
                )}
                
                {isProcessing && (
                  <div className="processing-status mt-4">
                    <h4>
                      <Spinner animation="border" size="sm" className="me-2" />
                      Processing your image...
                    </h4>
                    <ProgressBar 
                      now={progress} 
                      label={`${progress}%`}
                      animated 
                      className="mt-3"
                    />
                    <p className="text-muted mt-2">This may take up to a minute depending on image complexity</p>
                    
                    {generatedPrompt && (
                      <div className="generated-prompt mt-3">
                        <h5>Generated Prompt:</h5>
                        <p className="prompt-text">{generatedPrompt}</p>
                      </div>
                    )}
                  </div>
                )}
              </Card.Body>
            </Card>
            
            {outputUrl && (
              <Card className="result-card">
                <Card.Body>
                  <h3 className="mb-3">Your Ghibli Artwork</h3>
                  <div className="result-image-container">
                    <img src={outputUrl} alt="Ghibli Result" className="result-image" />
                  </div>
                  
                  {generatedPrompt && (
                    <div className="generated-prompt mt-4">
                      <h5>Generated Prompt:</h5>
                      <p className="prompt-text">{generatedPrompt}</p>
                    </div>
                  )}
                  
                  <div className="action-buttons mt-4">
                    <Button 
                      variant="primary" 
                      className="me-3"
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = outputUrl;
                        link.download = 'ghibli-artwork.png';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                    >
                      <i className="bi bi-download me-2"></i>
                      Download Artwork
                    </Button>
                    <Button variant="outline-secondary" onClick={resetForm}>
                      <i className="bi bi-arrow-repeat me-2"></i>
                      Process Another Image
                    </Button>
                  </div>
                </Card.Body>
              </Card>
            )}

            <div className="info-section mt-5">
              <h3>About Our Ghibli Style Processor</h3>
              <p>
                This feature uses advanced AI to transform your photos into illustrations inspired by 
                the iconic art style of Studio Ghibli films. Our algorithm analyzes your images and 
                applies artistic transformations to create a unique Ghibli-style artwork.
              </p>
              <p className="text-muted">
                <i className="bi bi-info-circle me-2"></i>
                Note: This is a beta feature and results may vary depending on the input image. 
                For best results, use clear photos with good lighting and minimal background clutter.
              </p>
            </div>
          </Col>
        </Row>
      </Container>
    </div>
  );
};

export default GhibliPage; 