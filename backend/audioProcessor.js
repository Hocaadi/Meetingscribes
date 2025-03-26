const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const { Document, Paragraph, HeadingLevel, TextRun } = require('docx');
const dotenv = require('dotenv');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const { Packer } = require('docx');
const { OpenAI } = require('openai');
const { v4: uuidv4 } = require('uuid');

// Load environment variables
dotenv.config();

// Configure ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

// OpenAI API configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error('ERROR: OpenAI API key is missing! Make sure to set the OPENAI_API_KEY environment variable.');
  process.exit(1); // Exit if API key is missing
}

// Define models being used
const TRANSCRIPTION_MODEL = "whisper-1";
const LLM_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const TEMPERATURE = parseFloat(process.env.OPENAI_TEMPERATURE || '0.1');

// Define chunk size for large files (24MB to stay safely under the 25MB API limit)
const MAX_CHUNK_SIZE = 24 * 1024 * 1024; // 24MB in bytes

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

/**
 * Process audio file to generate a meeting analysis report
 * @param {string} audioFilePath - Path to the uploaded audio file
 * @param {string} userCustomInstructions - Optional custom instructions from the user
 * @param {string} meetingTopic - Optional meeting topic/domain context
 * @param {string} sessionId - Optional session ID for WebSocket updates
 * @returns {Promise<Object>} - Object containing report file path and name
 */
async function processAudio(audioFilePath, userCustomInstructions = '', meetingTopic = '', sessionId = null) {
  try {
    console.log('Processing audio file:', audioFilePath);
    
    // Send initial status update
    if (sessionId) {
      global.emitProcessingUpdate(sessionId, 'started', {
        message: 'Processing started',
        file: path.basename(audioFilePath),
        transcriptionModel: TRANSCRIPTION_MODEL,
        analysisModel: LLM_MODEL,
        audioEnhancementEnabled: true  // Indicate that we're using enhanced audio
      });
    }
    
    // Log context information for better debugging
    if (userCustomInstructions) {
      console.log('User provided custom instructions for analysis');
    }
    
    if (meetingTopic) {
      console.log('Meeting topic provided:', meetingTopic);
    }

    // Step 1: Convert audio to required format (16kHz, mono, wav) and enhance quality
    if (sessionId) {
      global.emitProcessingUpdate(sessionId, 'converting', {
        message: 'Converting audio and applying noise reduction...',
        audioEnhancement: 'Advanced noise reduction and speech clarity enhancement applied'
      });
    }
    
    const convertedFilePath = await convertAudioFormat(audioFilePath, sessionId);
    console.log('Audio converted and enhanced successfully');

    // Step 2: Transcribe the audio using OpenAI Whisper API
    if (sessionId) {
      global.emitProcessingUpdate(sessionId, 'transcribing', {
        message: 'Transcribing enhanced audio using OpenAI Whisper model...',
        model: TRANSCRIPTION_MODEL
      });
    }
    
    console.log('Transcribing audio...');
    const transcript = await transcribeAudio(convertedFilePath, sessionId);
    console.log('Audio transcribed successfully');

    // Step 3: Extract structured insights using OpenAI API
    if (sessionId) {
      global.emitProcessingUpdate(sessionId, 'analyzing', {
        message: 'Analyzing transcript with AI...',
        model: LLM_MODEL,
        transcriptLength: transcript.length
      });
    }
    
    console.log('Extracting structured insights...');
    const structuredInsights = await extractStructuredInsights(transcript, userCustomInstructions, meetingTopic, sessionId);
    console.log('Insights extracted successfully');

    // Step 4: Generate document with results
    if (sessionId) {
      global.emitProcessingUpdate(sessionId, 'generating_document', {
        message: 'Generating final report document...'
      });
    }
    
    console.log('Generating report document...');
    const reportFileName = `meeting_analysis_report_${Date.now()}.docx`;
    const reportPath = path.join(__dirname, 'uploads', reportFileName);
    await generateReport(transcript, structuredInsights, reportPath, meetingTopic);
    console.log('Report generated successfully at:', reportPath);

    // Clean up temporary files
    if (convertedFilePath !== audioFilePath) {
      fs.unlinkSync(convertedFilePath);
    }

    // Send completion update
    if (sessionId) {
      global.emitProcessingUpdate(sessionId, 'completed', {
        message: 'Processing completed successfully',
        fileName: reportFileName
      });
    }

    return {
      reportPath: reportPath,
      fileName: reportFileName
    };
  } catch (error) {
    console.error('Error in audio processing:', error);
    
    // Send error update
    if (sessionId) {
      global.emitProcessingUpdate(sessionId, 'error', {
        message: `Error: ${error.message}`
      });
    }
    
    throw error;
  }
}

/**
 * Convert audio to the required format for processing with quality enhancement
 * @param {string} inputFilePath - Original audio file path
 * @param {string} sessionId - Optional session ID for WebSocket updates
 * @returns {Promise<string>} - Path to the converted and enhanced audio file
 */
async function convertAudioFormat(inputFilePath, sessionId = null) {
  return new Promise((resolve, reject) => {
    const outputFilePath = path.join(
      path.dirname(inputFilePath),
      `converted_${path.basename(inputFilePath)}.wav`
    );

    if (sessionId) {
      global.emitProcessingUpdate(sessionId, 'audio_enhancing', {
        message: 'Enhancing audio quality for better transcription...'
      });
    }

    // Apply the same audio enhancement filters as in the chunking process
    ffmpeg(inputFilePath)
      .output(outputFilePath)
      .audioFrequency(16000)
      .audioChannels(1)
      .audioFilters([
        // Remove background noise and enhance speech clarity
        'highpass=f=100',                // Remove low rumble noise
        'lowpass=f=10000',               // Remove high-frequency noise
        'equalizer=f=1000:width_type=h:width=200:g=2',  // Enhance human voice frequencies
        'equalizer=f=3000:width_type=h:width=200:g=2',  // Enhance consonant clarity
        'dynaudnorm=f=150:g=15:n=0:p=0.95', // Normalize audio dynamics
        'loudnorm=I=-16:LRA=11:TP=-1.5'    // Broadcast standard normalization
      ])
      .on('end', () => {
        if (sessionId) {
          global.emitProcessingUpdate(sessionId, 'audio_enhanced', {
            message: 'Audio quality enhanced successfully'
          });
        }
        console.log('Audio converted and enhanced successfully');
        resolve(outputFilePath);
      })
      .on('error', (err) => {
        console.error('Error enhancing audio:', err);
        reject(err);
      })
      .run();
  });
}

/**
 * Transcribe audio using OpenAI Whisper API with the SDK
 * @param {string} audioFilePath - Path to the audio file
 * @param {string} sessionId - Optional session ID for WebSocket updates
 * @returns {Promise<string>} - Transcribed text
 */
async function transcribeAudio(audioFilePath, sessionId = null) {
  try {
    // Verify the file exists and is readable
    if (!fs.existsSync(audioFilePath)) {
      throw new Error(`Audio file not found at path: ${audioFilePath}`);
    }
    
    const fileStats = fs.statSync(audioFilePath);
    if (fileStats.size === 0) {
      throw new Error(`Audio file is empty: ${audioFilePath}`);
    }
    
    console.log(`Attempting to transcribe file: ${audioFilePath} (${fileStats.size} bytes)`);
    
    if (sessionId) {
      global.emitProcessingUpdate(sessionId, 'transcription_started', {
        message: 'Starting audio transcription...',
        fileSize: fileStats.size,
        model: TRANSCRIPTION_MODEL
      });
    }

    // Check if file size exceeds the OpenAI limit
    if (fileStats.size > MAX_CHUNK_SIZE) {
      if (sessionId) {
        global.emitProcessingUpdate(sessionId, 'chunking', {
          message: `Audio file is large (${(fileStats.size / (1024 * 1024)).toFixed(2)}MB). Splitting into chunks for processing...`,
          originalSize: fileStats.size
        });
      }
      
      console.log(`File size (${fileStats.size} bytes) exceeds OpenAI's limit. Splitting into chunks...`);
      return await processLargeAudioFile(audioFilePath, sessionId);
    }
    
    // For smaller files, process normally with the existing code
    // Call OpenAI API with retry logic
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        attempts++;
        
        // Create a fresh file stream for each attempt
        const fileStream = fs.createReadStream(audioFilePath);
        
        if (sessionId && attempts > 1) {
          global.emitProcessingUpdate(sessionId, 'transcription_retry', {
            message: `Retrying transcription (attempt ${attempts} of ${maxAttempts})...`,
            attempt: attempts,
            maxAttempts: maxAttempts
          });
        }
        
        const transcription = await openai.audio.transcriptions.create({
          file: fileStream,
          model: TRANSCRIPTION_MODEL,
        });
        
        if (!transcription || !transcription.text) {
          throw new Error("Received empty response from OpenAI API");
        }
        
        if (sessionId) {
          global.emitProcessingUpdate(sessionId, 'transcription_completed', {
            message: 'Transcription completed successfully',
            transcriptLength: transcription.text.length
          });
        }
        
        return transcription.text;
      } catch (apiError) {
        console.error(`API attempt ${attempts} failed:`, apiError.message);
        
        if (sessionId) {
          global.emitProcessingUpdate(sessionId, 'transcription_error', {
            message: `Transcription attempt ${attempts} failed: ${apiError.message}`,
            attempt: attempts,
            maxAttempts: maxAttempts
          });
        }
        
        if (attempts >= maxAttempts) {
          throw new Error(`Failed to transcribe after ${maxAttempts} attempts: ${apiError.message}`);
        }
        
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
      }
    }
  } catch (error) {
    console.error('Error transcribing audio:', error.message);
    throw new Error(`Failed to transcribe audio: ${error.message}`);
  }
}

/**
 * Create a chunk of audio using ffmpeg with audio enhancement
 * @param {string} inputFile - Path to the input audio file
 * @param {string} outputFile - Path for the output chunk
 * @param {number} startTime - Start time in seconds
 * @param {number} duration - Duration in seconds
 * @returns {Promise<void>}
 */
function createAudioChunk(inputFile, outputFile, startTime, duration) {
  return new Promise((resolve, reject) => {
    // Apply audio enhancement filters for better transcription quality:
    // 1. highpass: removes low frequency noise below 100Hz
    // 2. lowpass: removes high frequency noise above 10kHz
    // 3. equalizer: enhance speech frequencies
    // 4. dynaudnorm: normalize audio for consistent volume levels
    // 5. loudnorm: normalize loudness to broadcasting standards
    // 6. aresample: ensure proper resampling to 16kHz
    ffmpeg(inputFile)
      .setStartTime(startTime)
      .setDuration(duration)
      .audioFilters([
        // Remove background noise and enhance speech clarity
        'highpass=f=100',                // Remove low rumble noise
        'lowpass=f=10000',               // Remove high-frequency noise
        'equalizer=f=1000:width_type=h:width=200:g=2',  // Enhance human voice frequencies
        'equalizer=f=3000:width_type=h:width=200:g=2',  // Enhance consonant clarity
        'dynaudnorm=f=150:g=15:n=0:p=0.95', // Normalize audio dynamics
        'loudnorm=I=-16:LRA=11:TP=-1.5'    // Broadcast standard normalization
      ])
      .output(outputFile)
      .audioFrequency(16000) // Set to 16kHz for optimal Whisper performance
      .audioChannels(1)      // Mono audio
      .format('wav')         // Convert to WAV format
      .on('end', () => {
        console.log(`Chunk created and enhanced at: ${outputFile}`);
        resolve();
      })
      .on('error', (err) => {
        console.error('Error creating audio chunk:', err);
        reject(err);
      })
      .run();
  });
}

/**
 * Process a large audio file by splitting it into smaller chunks
 * @param {string} audioFilePath - Path to the audio file
 * @param {string} sessionId - Optional session ID for WebSocket updates
 * @returns {Promise<string>} - Combined transcribed text
 */
async function processLargeAudioFile(audioFilePath, sessionId = null) {
  const tempDir = path.join(path.dirname(audioFilePath), 'temp_chunks_' + uuidv4());
  try {
    // Create temporary directory for chunks
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Get audio duration using ffmpeg
    const duration = await getAudioDuration(audioFilePath);
    console.log(`Audio duration: ${duration} seconds`);
    
    // Calculate optimal chunk size and number of chunks
    // Assume 1-minute audio is roughly 1MB (this is a rough estimate and may vary)
    // We're being extra cautious to ensure chunks are well under the limit
    const chunkLengthSeconds = Math.floor((MAX_CHUNK_SIZE / (1024 * 1024)) * 60);
    const totalChunks = Math.ceil(duration / chunkLengthSeconds);
    
    if (sessionId) {
      global.emitProcessingUpdate(sessionId, 'chunking_info', {
        message: `Splitting into ${totalChunks} chunks for processing...`,
        totalChunks: totalChunks,
        estimatedDuration: duration
      });
    }
    
    console.log(`Splitting file into ${totalChunks} chunks of approximately ${chunkLengthSeconds} seconds each`);
    
    // Create chunks
    const chunkFiles = [];
    for (let i = 0; i < totalChunks; i++) {
      const startTime = i * chunkLengthSeconds;
      const chunkPath = path.join(tempDir, `chunk_${i}.wav`);
      
      if (sessionId) {
        global.emitProcessingUpdate(sessionId, 'creating_chunk', {
          message: `Creating and enhancing chunk ${i+1} of ${totalChunks}...`,
          currentChunk: i+1,
          totalChunks: totalChunks
        });
      }
      
      // Create and enhance audio quality in one step
      await createAudioChunk(audioFilePath, chunkPath, startTime, chunkLengthSeconds);
      chunkFiles.push(chunkPath);
    }
    
    // Process each chunk and combine transcriptions
    let fullTranscription = '';
    for (let i = 0; i < chunkFiles.length; i++) {
      if (sessionId) {
        global.emitProcessingUpdate(sessionId, 'processing_chunk', {
          message: `Transcribing enhanced chunk ${i+1} of ${totalChunks}...`,
          currentChunk: i+1,
          totalChunks: totalChunks
        });
      }
      
      console.log(`Processing chunk ${i+1} of ${totalChunks}`);
      
      // Call OpenAI API with retry logic for each chunk
      let attempts = 0;
      const maxAttempts = 3;
      let chunkTranscription = '';
      
      while (attempts < maxAttempts) {
        try {
          attempts++;
          
          // Verify the chunk file exists and is readable
          if (!fs.existsSync(chunkFiles[i])) {
            throw new Error(`Chunk file not found: ${chunkFiles[i]}`);
          }
          
          const chunkStats = fs.statSync(chunkFiles[i]);
          console.log(`Chunk ${i+1} size: ${chunkStats.size} bytes`);
          
          // Create a fresh file stream for each attempt
          const fileStream = fs.createReadStream(chunkFiles[i]);
          
          const transcription = await openai.audio.transcriptions.create({
            file: fileStream,
            model: TRANSCRIPTION_MODEL,
          });
          
          if (!transcription || !transcription.text) {
            throw new Error("Received empty response from OpenAI API for chunk");
          }
          
          chunkTranscription = transcription.text;
          break;
        } catch (apiError) {
          console.error(`API attempt ${attempts} failed for chunk ${i+1}:`, apiError.message);
          
          if (sessionId) {
            global.emitProcessingUpdate(sessionId, 'chunk_error', {
              message: `Error processing chunk ${i+1}: ${apiError.message}, attempt ${attempts} of ${maxAttempts}`,
              chunk: i+1,
              attempt: attempts
            });
          }
          
          if (attempts >= maxAttempts) {
            throw new Error(`Failed to transcribe chunk ${i+1} after ${maxAttempts} attempts: ${apiError.message}`);
          }
          
          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
        }
      }
      
      // Add a separator if it's not the first chunk
      if (i > 0) {
        fullTranscription += ' ';
      }
      
      fullTranscription += chunkTranscription;
      
      if (sessionId) {
        global.emitProcessingUpdate(sessionId, 'chunk_completed', {
          message: `Enhanced chunk ${i+1} processed successfully (${chunkTranscription.length} characters)`,
          currentChunk: i+1,
          totalChunks: totalChunks,
          progress: Math.round(((i+1) / totalChunks) * 100)
        });
      }
    }
    
    if (sessionId) {
      global.emitProcessingUpdate(sessionId, 'transcription_completed', {
        message: 'All chunks transcribed and combined successfully',
        transcriptLength: fullTranscription.length,
        chunksProcessed: totalChunks
      });
    }
    
    console.log(`Full transcription created: ${fullTranscription.length} characters`);
    
    return fullTranscription;
  } catch (error) {
    console.error('Error processing large audio file:', error);
    throw new Error(`Failed to process large audio file: ${error.message}`);
  } finally {
    // Clean up temp files
    try {
      if (fs.existsSync(tempDir)) {
        const files = fs.readdirSync(tempDir);
        for (const file of files) {
          fs.unlinkSync(path.join(tempDir, file));
        }
        fs.rmdirSync(tempDir);
        console.log(`Cleaned up temporary directory: ${tempDir}`);
      }
    } catch (cleanupError) {
      console.error('Error cleaning up temp files:', cleanupError);
    }
  }
}

/**
 * Get the duration of an audio file using ffmpeg
 * @param {string} audioFilePath - Path to the audio file
 * @returns {Promise<number>} - Duration in seconds
 */
function getAudioDuration(audioFilePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(audioFilePath, (err, metadata) => {
      if (err) {
        return reject(err);
      }
      resolve(metadata.format.duration);
    });
  });
}

/**
 * Extract structured insights from the transcript using OpenAI API with the SDK
 * @param {string} transcript - Transcript text
 * @param {string} userCustomInstructions - Optional custom instructions from the user
 * @param {string} meetingTopic - Optional meeting topic/domain context
 * @param {string} sessionId - Optional session ID for WebSocket updates
 * @returns {Promise<string>} - Structured insights text
 */
async function extractStructuredInsights(transcript, userCustomInstructions = '', meetingTopic = '', sessionId = null) {
  if (!transcript || transcript.trim() === '') {
    throw new Error('Cannot analyze empty transcript');
  }
  
  try {
    if (sessionId) {
      global.emitProcessingUpdate(sessionId, 'analysis_started', {
        message: 'Starting transcript analysis...',
        model: LLM_MODEL,
        hasTopic: !!meetingTopic,
        hasCustomInstructions: !!userCustomInstructions
      });
    }
    
    const systemInstructions = `
    You are a Business document AI assistant and an expert that analyzes meeting transcripts to extract structured insights.
    From the following transcript, identify:
    1. Key discussion points.
    2. Requests made.
    3. Action items and responsible people.
    4. Final decisions or outcomes.
    Format your response as:
    - Key Discussion Points:
    - Requests:
    - Action Items:
    - Decisions/Outcomes:
    `;
    
    // Prepare user query with transcript and any context information
    let userQuery = `Analyze the following meeting transcript:\n${transcript}`;
    
    // Add meeting topic context if provided
    if (meetingTopic && meetingTopic.trim() !== '') {
      // Get a user-friendly label for the topic
      const topicLabel = meetingTopic.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      userQuery = `Analyze the following meeting transcript from a ${topicLabel} meeting:\n${transcript}`;
    }
    
    // Add user custom instructions if provided
    if (userCustomInstructions && userCustomInstructions.trim() !== '') {
      userQuery += `\n\nAdditional analysis instructions: ${userCustomInstructions}`;
    }

    let attempts = 0;
    const maxAttempts = 2;
    
    while (attempts < maxAttempts) {
      try {
        attempts++;
        
        if (sessionId && attempts > 1) {
          global.emitProcessingUpdate(sessionId, 'analysis_retry', {
            message: `Retrying analysis with ${LLM_MODEL} (attempt ${attempts} of ${maxAttempts})...`,
            attempt: attempts,
            maxAttempts: maxAttempts
          });
        }
        
        if (sessionId) {
          global.emitProcessingUpdate(sessionId, 'analysis_in_progress', {
            message: `Sending transcript to ${LLM_MODEL} for analysis...`
          });
        }
        
        const completion = await openai.chat.completions.create({
          model: LLM_MODEL,
          temperature: TEMPERATURE,
          store: true,
          messages: [
            { role: 'system', content: systemInstructions },
            { role: 'user', content: userQuery }
          ]
        });

        if (!completion || !completion.choices || !completion.choices[0] || !completion.choices[0].message) {
          throw new Error("Received invalid response from OpenAI API");
        }
        
        if (sessionId) {
          global.emitProcessingUpdate(sessionId, 'analysis_completed', {
            message: 'Analysis completed successfully',
            model: LLM_MODEL
          });
        }
        
        return completion.choices[0].message.content;
      } catch (apiError) {
        console.error(`API attempt ${attempts} failed:`, apiError.message);
        
        if (sessionId) {
          global.emitProcessingUpdate(sessionId, 'analysis_error', {
            message: `Analysis attempt ${attempts} failed: ${apiError.message}`,
            attempt: attempts,
            maxAttempts: maxAttempts
          });
        }
        
        if (attempts >= maxAttempts) {
          throw new Error(`Failed to extract insights after ${maxAttempts} attempts: ${apiError.message}`);
        }
        
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
      }
    }
  } catch (error) {
    console.error('Error extracting insights:', error.message);
    throw new Error(`Failed to extract insights from transcript: ${error.message}`);
  }
}

/**
 * Generate a Word document with the analysis results
 * @param {string} transcript - Transcript text
 * @param {string} structuredInsights - Structured insights text
 * @param {string} outputPath - Path to save the document
 * @param {string} meetingTopic - Optional meeting topic for the report header
 * @returns {Promise<void>}
 */
async function generateReport(transcript, structuredInsights, outputPath, meetingTopic = '') {
  try {
    // Get report title with topic if available
    let reportTitle = "Meeting Analysis Report";
    if (meetingTopic && meetingTopic.trim() !== '') {
      const topicLabel = meetingTopic.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      reportTitle = `${topicLabel} Meeting Analysis Report`;
    }
    
    // Create sections array with content
    const children = [
      new Paragraph({
        text: reportTitle,
        heading: HeadingLevel.HEADING_1
      }),
      new Paragraph({
        text: `Generated on: ${new Date().toLocaleString()}`,
        style: "normal"
      }),
      new Paragraph({
        text: `Transcription model: ${TRANSCRIPTION_MODEL}`,
        style: "normal"
      }),
      new Paragraph({
        text: `Analysis model: ${LLM_MODEL}`,
        style: "normal"
      }),
      new Paragraph({
        text: "Audio Enhancement: Advanced noise reduction and speech clarity filters applied",
        style: "normal"
      }),
      new Paragraph({
        text: "",
        style: "normal"
      }),
      new Paragraph({
        text: "Transcript",
        heading: HeadingLevel.HEADING_2
      }),
      new Paragraph({
        text: transcript,
        style: "normal"
      }),
      new Paragraph({
        text: "",
        style: "normal"
      }),
      new Paragraph({
        text: "Structured Insights",
        heading: HeadingLevel.HEADING_2
      })
    ];
    
    // Add insights lines
    structuredInsights.split('\n').forEach(line => {
      children.push(
        new Paragraph({
          text: line,
          style: "normal"
        })
      );
    });
    
    // Create document with proper structure
    const doc = new Document({
      creator: "MeetingScribe",
      title: reportTitle,
      description: "AI-generated transcript and analysis",
      sections: [
        {
          properties: {},
          children: children
        }
      ]
    });

    // Use Packer to save the document
    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(outputPath, buffer);
  } catch (error) {
    console.error('Error generating report:', error);
    throw new Error('Failed to generate report document');
  }
}

module.exports = {
  processAudio,
  TRANSCRIPTION_MODEL,
  LLM_MODEL
}; 