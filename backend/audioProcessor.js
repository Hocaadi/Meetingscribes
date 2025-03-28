const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const { Document, Paragraph, HeadingLevel, TextRun, Table, TableRow, TableCell, BorderStyle, WidthType, AlignmentType, Header, Footer, PageNumber, NumberFormat, ShadingType, LevelFormat, convertInchesToTwip, TableOfContents, Bookmark, PageBreak, ExternalHyperlink } = require('docx');
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

// Maximum chunk size for audio processing (15MB to stay well under the 25MB API limit)
const MAX_CHUNK_SIZE = 15 * 1024 * 1024; // 15MB in bytes

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

/**
 * Process an audio file to generate a transcript and extract structured insights
 * @param {string} filePath - Path to the audio file
 * @param {string} userCustomInstructions - Optional custom instructions from the user
 * @param {string} meetingTopic - Optional meeting topic for context
 * @param {string} sessionId - Optional session ID for WebSocket updates
 * @returns {Promise<Object>} - Object containing the transcript and structured insights
 */
async function processAudio(filePath, userCustomInstructions = null, meetingTopic = null, sessionId = null) {
  try {
    console.log(`Processing audio file: ${filePath}`);
    
    // Apply audio enhancement once at the beginning
    if (sessionId) {
      global.emitProcessingUpdate(sessionId, 'started', {
        message: 'Starting audio enhancement...',
        audioEnhancementEnabled: true
      });
    }
    
    // Convert and enhance the audio quality for better transcription
    const enhancedFilePath = await convertAudioFormat(filePath, sessionId);
    console.log(`Enhanced audio file created: ${enhancedFilePath}`);
    
    // Check the size of the enhanced file
    const stats = fs.statSync(enhancedFilePath);
    const fileSizeMB = stats.size / (1024 * 1024);
    console.log(`Enhanced audio file size: ${fileSizeMB.toFixed(2)}MB`);
    
    let transcript;
    
    // Use a different approach for large files
    if (stats.size > MAX_CHUNK_SIZE) {
      if (sessionId) {
        global.emitProcessingUpdate(sessionId, 'status', {
          message: `Large file detected (${fileSizeMB.toFixed(2)}MB). Processing in chunks...`,
          audioEnhancementEnabled: true
        });
      }
      console.log(`File size exceeds ${(MAX_CHUNK_SIZE / (1024 * 1024)).toFixed(1)}MB. Processing in chunks...`);
      transcript = await processLargeAudioFile(enhancedFilePath, sessionId);
    } else {
      if (sessionId) {
        global.emitProcessingUpdate(sessionId, 'status', {
          message: 'Converting audio to text with Whisper API...',
          audioEnhancementEnabled: true
        });
      }
      // For smaller files, process directly with the enhanced audio
      transcript = await transcribeAudio(enhancedFilePath);
    }
    
    // Log context information for better debugging
    if (userCustomInstructions) {
      console.log('User provided custom instructions for analysis');
    }
    
    if (meetingTopic) {
      console.log('Meeting topic provided:', meetingTopic);
    }
    
    // Step 3: Extract structured insights using OpenAI API
    if (sessionId) {
      global.emitProcessingUpdate(sessionId, 'analyzing', {
        message: 'Analyzing transcript using AI...',
        model: LLM_MODEL,
        transcriptLength: transcript.length
      });
    }
    
    console.log('Extracting structured insights from transcript...');
    const structuredInsights = await extractStructuredInsights(transcript, userCustomInstructions, meetingTopic);
    console.log('Structured insights extracted successfully');
    
    // Step 4: Generate the final report
    if (sessionId) {
      global.emitProcessingUpdate(sessionId, 'generating_report', {
        message: 'Generating final meeting report...'
      });
    }
    
    console.log('Generating final report...');
    const { reportPath, reportFileName } = await generateReport(transcript, structuredInsights, meetingTopic);
    console.log('Final report generated successfully at:', reportPath);
    
    if (sessionId) {
      global.emitProcessingUpdate(sessionId, 'completed', {
        message: 'Processing completed successfully',
        reportPath,
        reportFileName,
        docxFileName: reportFileName,
        docxUrl: `/api/download/${reportFileName}`,
        format: 'docx',
        status: "completed",
        timestamp: new Date().toISOString(),
        transcript: transcript
      });
    }

    // Clean up temporary files
    if (enhancedFilePath !== filePath) {
      fs.unlinkSync(enhancedFilePath);
    }

    return {
      reportPath,
      reportFileName,
      docxFileName: reportFileName,
      transcript: transcript
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
 * Converts audio to a format suitable for OpenAI's API with audio enhancement
 * @param {string} inputFile - Path to the input audio file
 * @param {string} sessionId - Optional session ID for WebSocket updates
 * @returns {Promise<string>} - Path to the converted and enhanced audio file
 */
async function convertAudioFormat(inputFile, sessionId = null) {
  return new Promise((resolve, reject) => {
    const outputDir = path.dirname(inputFile);
    const timestamp = Date.now();
    // Use a naming convention that clearly marks this as the enhanced version
    const outputFile = path.join(outputDir, `converted_enhanced_${timestamp}.wav`);
    
    if (sessionId) {
      global.emitProcessingUpdate(sessionId, 'enhancing_audio', {
        message: 'Applying advanced noise reduction and speech clarity filters...',
        stage: 'audio_enhancement'
      });
    }
    
    console.log('Enhancing audio quality with noise reduction and clarity filters');
    
    // Apply comprehensive audio enhancement for optimal transcription quality
    ffmpeg(inputFile)
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
      .audioFrequency(16000)  // 16kHz sample rate for Whisper
      .audioChannels(1)       // Convert to mono
      .format('wav')          // Convert to WAV format
      .on('end', () => {
        console.log(`Audio converted and enhanced: ${outputFile}`);
        if (sessionId) {
          global.emitProcessingUpdate(sessionId, 'audio_enhanced', {
            message: 'Audio successfully enhanced with noise reduction and speech clarity filters',
            enhancedPath: outputFile
          });
        }
        resolve(outputFile);
      })
      .on('error', (err) => {
        console.error('Error converting audio:', err);
        reject(err);
      })
      .run();
  });
}

/**
 * Transcribe audio using the OpenAI Whisper API
 * @param {string} audioFilePath - Path to the audio file
 * @param {string} sessionId - Optional session ID for WebSocket updates
 * @returns {Promise<string>} - Transcribed text
 */
async function transcribeAudio(audioFilePath, sessionId = null) {
  try {
    // Check file size before sending to API
    const stats = fs.statSync(audioFilePath);
    const fileSizeMB = stats.size / (1024 * 1024);
    console.log(`File size before transcription: ${fileSizeMB.toFixed(2)}MB`);
    
    // OpenAI has a limit of 25MB (26,214,400 bytes)
    if (stats.size > 26214400) {
      console.warn(`WARNING: File size (${fileSizeMB.toFixed(2)}MB) exceeds OpenAI's 25MB limit!`);
      if (sessionId) {
        global.emitProcessingUpdate(sessionId, 'warning', {
          message: `WARNING: File size (${fileSizeMB.toFixed(2)}MB) exceeds OpenAI's 25MB limit!`,
          resolution: 'Attempting to process anyway, but may fail'
        });
      }
    }
    
    // Create a readable stream for the audio file
    const audioReadStream = fs.createReadStream(audioFilePath);
    
    console.log(`Sending file to OpenAI Whisper API (${TRANSCRIPTION_MODEL})...`);
    
    // Make API request to OpenAI
    const response = await openai.audio.transcriptions.create({
      file: audioReadStream,
      model: TRANSCRIPTION_MODEL,
      language: 'en', // Specify English for better accuracy
      response_format: 'text'
    });
    
    return response;
  } catch (error) {
    console.error('Error transcribing audio:', error);
    throw error;
  }
}

/**
 * Create a chunk of audio using ffmpeg without re-enhancing (using the already enhanced audio)
 * @param {string} inputFile - Path to the input audio file
 * @param {string} outputFile - Path for the output chunk
 * @param {number} startTime - Start time in seconds
 * @param {number} duration - Duration in seconds
 * @returns {Promise<void>}
 */
function createAudioChunk(inputFile, outputFile, startTime, duration) {
  return new Promise((resolve, reject) => {
    // We don't need to re-apply audio enhancements since the input file is already enhanced
    // Just extract the chunk at the proper timestamps
    ffmpeg(inputFile)
      .setStartTime(startTime)
      .setDuration(duration)
      .output(outputFile)
      .audioFrequency(16000) // Set to 16kHz for optimal Whisper performance
      .audioChannels(1)      // Mono audio
      .format('wav')         // Convert to WAV format
      .on('end', () => {
        console.log(`Chunk created at: ${outputFile}`);
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
  // First, make sure we're working with enhanced audio
  let enhancedAudioPath = audioFilePath;
  if (!audioFilePath.includes('converted_')) {
    // If the file doesn't appear to be already enhanced, enhance it first
    enhancedAudioPath = await convertAudioFormat(audioFilePath, sessionId);
    console.log(`Audio enhanced before chunking: ${enhancedAudioPath}`);
  }
  
  const tempDir = path.join(path.dirname(audioFilePath), 'temp_chunks_' + uuidv4());
  try {
    // Create temporary directory for chunks
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Get audio duration using ffmpeg
    const duration = await getAudioDuration(enhancedAudioPath);
    console.log(`Audio duration: ${duration} seconds`);
    
    // Calculate optimal chunk size and number of chunks
    // Using our 15MB limit to ensure we stay well under the 25MB API limit
    const chunkLengthSeconds = Math.floor((MAX_CHUNK_SIZE / (1024 * 1024)) * 30); // Assuming ~0.5MB per minute is safer
    const totalChunks = Math.ceil(duration / chunkLengthSeconds);
    
    if (sessionId) {
      global.emitProcessingUpdate(sessionId, 'chunking_info', {
        message: `Splitting into ${totalChunks} chunks for processing...`,
        totalChunks: totalChunks,
        estimatedDuration: duration,
        chunkSizeLimit: `${(MAX_CHUNK_SIZE / (1024 * 1024)).toFixed(1)}MB`
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
          message: `Creating chunk ${i+1} of ${totalChunks}...`,
          currentChunk: i+1,
          totalChunks: totalChunks
        });
      }
      
      // Create chunk from already enhanced audio
      await createAudioChunk(enhancedAudioPath, chunkPath, startTime, chunkLengthSeconds);
      
      // Verify the chunk size is within limits
      const chunkStats = fs.statSync(chunkPath);
      if (chunkStats.size > MAX_CHUNK_SIZE) {
        console.warn(`Warning: Chunk ${i+1} size (${chunkStats.size} bytes) is larger than expected. ` +
                    `It may still work if under the API limit of 25MB.`);
      }
      
      chunkFiles.push(chunkPath);
    }
    
    // Process each chunk and combine transcriptions
    let fullTranscription = '';
    for (let i = 0; i < chunkFiles.length; i++) {
      if (sessionId) {
        global.emitProcessingUpdate(sessionId, 'processing_chunk', {
          message: `Transcribing chunk ${i+1} of ${totalChunks}...`,
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
          message: `Chunk ${i+1} processed successfully (${chunkTranscription.length} characters)`,
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
    You also have a special role as "Guider" - an evaluation agent that assesses meeting performance.
    
    From the following transcript, identify:
    1. Key discussion points.
    2. Requests made.
    3. Action items and responsible people.
    4. Final decisions or outcomes.
    5. Evaluation by Guider (when evaluation template is provided).
    
    Format your response as:
    - Key Discussion Points:
    - Requests:
    - Action Items:
    - Decisions/Outcomes:
    - Evaluation by Guider: (This section appears only when evaluation template is provided)
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
      // Check if custom instructions contain evaluation template
      if (userCustomInstructions.includes("Evaluation Template") || 
          userCustomInstructions.includes("Meeting Performance Evaluation") || 
          userCustomInstructions.toLowerCase().includes("evaluation criteria")) {
        
        // Add the evaluation instructions with clear marker for the "Guider" agent
        userQuery += `\n\n===EVALUATION INSTRUCTIONS FOR GUIDER===\nAs the Guider evaluation agent, please use the following template to evaluate the meeting participants:\n${userCustomInstructions}\n\nThe evaluation should be included in your "Evaluation by Guider" section.`;
      } else {
        // Regular custom instructions
        userQuery += `\n\nAdditional analysis instructions: ${userCustomInstructions}`;
      }
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
 * Generate a professionally formatted Word document with the analysis results
 * @param {string} transcript - Transcript text
 * @param {string} structuredInsights - Structured insights text
 * @param {string} meetingTopic - Optional meeting topic for the report header
 * @returns {Promise<{reportPath: string, reportFileName: string}>} - Object containing the report path and file name
 */
async function generateReport(transcript, structuredInsights, meetingTopic = '') {
  try {
    // Get report title with topic if available
    let reportTitle = "Meeting Analysis Report";
    if (meetingTopic && meetingTopic.trim() !== '') {
      const topicLabel = meetingTopic.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      reportTitle = `${topicLabel} Meeting Analysis Report`;
    }

    // Create sections array with content
    const children = [];
    
    // Add title page
    children.push(
      new Paragraph({
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: {
          before: 1440, // 1 inch above
          after: 720    // 0.5 inch below
        },
        children: [
          new TextRun({
            text: reportTitle,
            bold: true,
            size: 40,
            color: "2B579A",
            font: "Calibri"
          })
        ]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: {
          before: 360,
          after: 360
        },
        children: [
          new TextRun({
            text: "Generated by MeetingScribe AI",
            size: 24,
            color: "4A86E8",
            font: "Calibri"
          })
        ]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: {
          before: 360
        },
        children: [
          new TextRun({
            text: `${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`,
            size: 18,
            color: "666666",
            font: "Calibri"
          })
        ]
      }),
      new Paragraph({
        text: "",
        pageBreakBefore: true
      })
    );
    
    // Add table of contents
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        spacing: {
          before: 480,
          after: 240
        },
        children: [
          new TextRun({
            text: "TABLE OF CONTENTS",
            bold: true,
            size: 24,
            color: "2B579A",
            font: "Calibri"
          })
        ]
      }),
      new TableOfContents({
        hyperlink: true,
        headingStyleRange: "1-5",
        entryStyleRange: "1-3",
        tableStyle: "TableGrid"
      }),
      new Paragraph({
        text: "",
        pageBreakBefore: true
      })
    );
    
    // Add executive summary section
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: {
          before: 240,
          after: 120
        },
        children: [
          new TextRun({
            text: "Executive Summary",
            bold: true,
            size: 28,
            color: "2B579A",
            font: "Calibri"
          })
        ]
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: "This report contains an AI-generated analysis of a meeting recording. The system has transcribed the audio to text and extracted key insights for easy review. The report includes the following sections:",
            size: 11,
            font: "Calibri"
          })
        ]
      }),
      new Paragraph({
        bullet: {
          level: 0
        },
        children: [
          new TextRun({
            text: "Complete meeting transcript",
            size: 11,
            font: "Calibri"
          })
        ]
      }),
      new Paragraph({
        bullet: {
          level: 0
        },
        children: [
          new TextRun({
            text: "Key discussion points and topics",
            size: 11,
            font: "Calibri"
          })
        ]
      }),
      new Paragraph({
        bullet: {
          level: 0
        },
        children: [
          new TextRun({
            text: "Action items with assigned responsibilities",
            size: 11,
            font: "Calibri"
          })
        ]
      }),
      new Paragraph({
        bullet: {
          level: 0
        },
        children: [
          new TextRun({
            text: "Requests made during the meeting",
            size: 11,
            font: "Calibri"
          })
        ]
      }),
      new Paragraph({
        bullet: {
          level: 0
        },
        children: [
          new TextRun({
            text: "Final decisions and outcomes",
            size: 11,
            font: "Calibri"
          })
        ]
      })
    );
    
    // Add meeting metadata in a table
    const metadataRows = [
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({
            shading: {
              fill: "4A86E8",
              type: ShadingType.SOLID,
            },
            children: [new Paragraph({ 
              text: "Meeting Information",
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: "Meeting Information",
                  bold: true,
                  color: "FFFFFF",
                  size: 14
                })
              ]
            })],
            columnSpan: 2
          })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({
            width: {
              size: 30,
              type: WidthType.PERCENTAGE,
            },
            children: [new Paragraph({ 
              text: "Report Generated:",
              children: [
                new TextRun({
                  text: "Report Generated:",
                  bold: true
                })
              ]
            })]
          }),
          new TableCell({
            width: {
              size: 70,
              type: WidthType.PERCENTAGE,
            },
            children: [new Paragraph({ text: new Date().toLocaleString() })]
          })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ 
              children: [
                new TextRun({
                  text: "Meeting Topic:",
                  bold: true
                })
              ]
            })]
          }),
          new TableCell({
            children: [new Paragraph({ 
              text: meetingTopic ? meetingTopic.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : "Not specified" 
            })]
          })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({
              children: [
                new TextRun({
                  text: "Transcription Model:",
                  bold: true
                })
              ]
            })]
          }),
          new TableCell({
            children: [new Paragraph({ text: TRANSCRIPTION_MODEL })]
          })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({
              children: [
                new TextRun({
                  text: "Analysis Model:",
                  bold: true
                })
              ]
            })]
          }),
          new TableCell({
            children: [new Paragraph({ text: LLM_MODEL })]
          })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({
              children: [
                new TextRun({
                  text: "Audio Processing:",
                  bold: true
                })
              ]
            })]
          }),
          new TableCell({
            children: [new Paragraph({ text: "Advanced noise reduction and speech clarity filters applied" })]
          })
        ]
      })
    ];
    
    const metadataTable = new Table({
      width: {
        size: 100,
        type: WidthType.PERCENTAGE,
      },
      margins: {
        top: 120,
        bottom: 120,
        left: 120,
        right: 120,
      },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: "4A86E8" },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: "4A86E8" },
        left: { style: BorderStyle.SINGLE, size: 1, color: "4A86E8" },
        right: { style: BorderStyle.SINGLE, size: 1, color: "4A86E8" },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "4A86E8" },
        insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "4A86E8" },
      },
      rows: metadataRows,
    });
    
    children.push(
      new Paragraph({
        text: "",
        spacing: {
          before: 240,
          after: 240
        }
      }),
      metadataTable,
      new Paragraph({
        text: "",
        pageBreakBefore: true
      })
    );

    // Add insights sections - IMPROVED PARSING LOGIC
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: {
          before: 240,
          after: 120
        },
        children: [
          new TextRun({
            text: "Key Insights",
            bold: true,
            size: 28,
            color: "2B579A",
            font: "Calibri"
          })
        ]
      })
    );

    // More robust section parsing
    const sections = [];
    let currentSection = "";
    let currentContent = [];
    let evaluationSection = null;

    // First, separate the content into sections
    const lines = structuredInsights.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Check for section headers (starting with "- " followed by text and a colon)
      if (line.match(/^- [^:]+:/)) {
        // If we were already collecting a section, save it
        if (currentSection) {
          // Special handling for evaluation section
          if (currentSection.toLowerCase().includes("evaluation by guider")) {
            evaluationSection = {
              title: currentSection,
              content: [...currentContent]
            };
          } else {
            sections.push({
              title: currentSection,
              content: [...currentContent]
            });
          }
        }
        
        // Start a new section
        currentSection = line;
        currentContent = [];
      } 
      // Add non-empty lines to current section
      else if (line.length > 0) {
        currentContent.push(line);
      }
    }
    
    // Don't forget to add the last section
    if (currentSection) {
      if (currentSection.toLowerCase().includes("evaluation by guider")) {
        evaluationSection = {
          title: currentSection,
          content: [...currentContent]
        };
      } else {
        sections.push({
          title: currentSection,
          content: [...currentContent]
        });
      }
    }

    // Process regular insight sections first
    for (const section of sections) {
      // Extract section title without the "- " prefix
      const sectionTitle = section.title.substring(2);
      
      // Add section heading
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: {
            before: 240,
            after: 120
          },
          children: [
            new TextRun({
              text: sectionTitle,
              bold: true,
              size: 24,
              color: "4A86E8",
              font: "Calibri"
            })
          ]
        })
      );
      
      // If there's no content in the section, add a placeholder
      if (section.content.length === 0) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: "No information available for this section.",
                italics: true,
                size: 11,
                font: "Calibri",
                color: "888888"
              })
            ]
          })
        );
        continue;
      }
      
      // Process content based on section type
      const sectionKey = sectionTitle.split(':')[0].toLowerCase();
      
      if (sectionKey.includes("action items")) {
        // Format action items with bullets and highlighted assignees
        for (const item of section.content) {
          const itemText = item.replace(/^-\s*/, '').trim();
          const assigneeMatch = itemText.match(/\(([^)]+)\)$/) || 
                               itemText.match(/\bassigned to\s+([^,\.]+)/i) || 
                               itemText.match(/\bresponsible:\s+([^,\.]+)/i);
          
          if (assigneeMatch) {
            const assignee = assigneeMatch[1].trim();
            const taskText = itemText.replace(assigneeMatch[0], '').trim();
            
            children.push(
              new Paragraph({
                bullet: { level: 0 },
                children: [
                  new TextRun({
                    text: `${taskText} - `,
                    size: 11,
                    font: "Calibri"
                  }),
                  new TextRun({
                    text: `Assignee: ${assignee}`,
                    bold: true,
                    size: 11,
                    font: "Calibri",
                    color: "2B579A"
                  })
                ]
              })
            );
          } else {
            children.push(
              new Paragraph({
                bullet: { level: 0 },
                children: [
                  new TextRun({
                    text: itemText,
                    size: 11,
                    font: "Calibri"
                  })
                ]
              })
            );
          }
        }
      } 
      else if (sectionKey.includes("key discussion") || sectionKey.includes("discussion points")) {
        // Format discussion points as numbered list
        for (let i = 0; i < section.content.length; i++) {
          const pointText = section.content[i].replace(/^-\s*/, '').trim();
          children.push(
            new Paragraph({
              numbering: {
                reference: "discussionPoints",
                level: 0
              },
              spacing: {
                before: 80,
                after: 80
              },
              children: [
                new TextRun({
                  text: pointText,
                  size: 11,
                  font: "Calibri"
                })
              ]
            })
          );
        }
      }
      else {
        // Default formatting for other sections (e.g., Requests, Decisions/Outcomes)
        for (const item of section.content) {
          const itemText = item.replace(/^-\s*/, '').trim();
          children.push(
            new Paragraph({
              bullet: { level: 0 },
              spacing: {
                before: 80,
                after: 80
              },
              children: [
                new TextRun({
                  text: itemText,
                  size: 11,
                  font: "Calibri"
                })
              ]
            })
          );
        }
      }
      
      // Add spacing after each section
      children.push(
        new Paragraph({
          text: "",
          spacing: { after: 240 }
        })
      );
    }

    // Add evaluation section on a new page if it exists
    if (evaluationSection) {
      children.push(
        new Paragraph({
          text: "",
          pageBreakBefore: true
        }),
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          spacing: {
            before: 240,
            after: 120
          },
          children: [
            new TextRun({
              text: "Meeting Evaluation by Guider",
              bold: true,
              size: 28,
              color: "2B579A",
              font: "Calibri"
            })
          ]
        })
      );
      
      // Check if evaluation content is empty
      if (evaluationSection.content.length === 0) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: "No evaluation data available.",
                italics: true,
                size: 11,
                font: "Calibri",
                color: "888888"
              })
            ]
          })
        );
      } else {
        // Process evaluation content with better table detection
        let currentEvalText = [];
        let inTable = false;
        let tableData = [];
        let tableRow = [];
        
        for (let i = 0; i < evaluationSection.content.length; i++) {
          const line = evaluationSection.content[i].trim();
          
          // Check if line contains table-like structure (has multiple | characters)
          const isTableRow = (line.split('|').length > 2);
          
          // Check if line is a table header separator
          const isTableSeparator = line.includes('-+-') || 
                                 (line.includes('-') && line.includes('|') && !line.match(/[a-zA-Z]/));
          
          // Handle table detection
          if ((isTableRow || isTableSeparator) && !inTable) {
            // Starting a new table
            inTable = true;
            
            // Add any accumulated text before the table
            if (currentEvalText.length > 0) {
              for (const textLine of currentEvalText) {
                children.push(
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: textLine,
                        size: 11,
                        font: "Calibri"
                      })
                    ]
                  })
                );
              }
              currentEvalText = [];
            }
            
            // Start collecting table rows
            tableData = [];
            if (isTableRow && !isTableSeparator) {
              // Add this line as first row of the table
              tableRow = line.split('|')
                           .map(cell => cell.trim())
                           .filter(cell => cell.length > 0);
              tableData.push(tableRow);
            }
          }
          else if (inTable && isTableRow) {
            // Continue collecting table rows
            tableRow = line.split('|')
                         .map(cell => cell.trim())
                         .filter(cell => cell.length > 0);
            tableData.push(tableRow);
          }
          else if (inTable && !isTableRow && !isTableSeparator) {
            // End of table detected
            inTable = false;
            
            // Create and add the table if we collected rows
            if (tableData.length > 0) {
              try {
                // Create table rows for the Word document
                const tableRows = tableData.map((rowData, rowIndex) => {
                  return new TableRow({
                    tableHeader: rowIndex === 0,
                    children: rowData.map(cellText => {
                      return new TableCell({
                        shading: rowIndex === 0 ? {
                          fill: "4A86E8",
                          type: ShadingType.SOLID,
                        } : undefined,
                        children: [
                          new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [
                              new TextRun({
                                text: cellText,
                                color: rowIndex === 0 ? "FFFFFF" : undefined,
                                bold: rowIndex === 0,
                                size: 11,
                                font: "Calibri"
                              })
                            ]
                          })
                        ]
                      });
                    })
                  });
                });
                
                // Add table to document
                children.push(
                  new Table({
                    width: {
                      size: 100,
                      type: WidthType.PERCENTAGE,
                    },
                    borders: {
                      top: { style: BorderStyle.SINGLE, size: 1, color: "4A86E8" },
                      bottom: { style: BorderStyle.SINGLE, size: 1, color: "4A86E8" },
                      left: { style: BorderStyle.SINGLE, size: 1, color: "4A86E8" },
                      right: { style: BorderStyle.SINGLE, size: 1, color: "4A86E8" },
                      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "4A86E8" },
                      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "4A86E8" },
                    },
                    rows: tableRows
                  }),
                  new Paragraph({ text: "" })
                );
              } catch (e) {
                console.error("Error creating table:", e);
                // If table creation fails, add the data as text
                for (const row of tableData) {
                  children.push(
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: row.join(" | "),
                          size: 11,
                          font: "Calibri"
                        })
                      ]
                    })
                  );
                }
              }
            }
            
            // Add the current line as text
            currentEvalText.push(line);
          }
          else if (!inTable) {
            // Regular text line
            currentEvalText.push(line);
            
            // Check if this is a section title (ends with colon or all caps)
            const isSectionTitle = line.endsWith(':') || 
                                 (line === line.toUpperCase() && line.length > 3);
            
            if (isSectionTitle && currentEvalText.length > 0) {
              // Add section title with special formatting
              children.push(
                new Paragraph({
                  spacing: {
                    before: 200,
                    after: 80
                  },
                  children: [
                    new TextRun({
                      text: line,
                      bold: true,
                      size: 14,
                      color: "4A86E8",
                      font: "Calibri"
                    })
                  ]
                })
              );
              currentEvalText = [];
            }
            // Check if we've accumulated several regular text lines
            else if (currentEvalText.length >= 3 || 
                   (i === evaluationSection.content.length - 1 && currentEvalText.length > 0)) {
              // Add accumulated text
              for (const textLine of currentEvalText) {
                // Skip if this was already added as a section title
                if (textLine === line && isSectionTitle) continue;
                
                children.push(
                  new Paragraph({
                    spacing: {
                      before: 80,
                      after: 80
                    },
                    children: [
                      new TextRun({
                        text: textLine,
                        size: 11,
                        font: "Calibri"
                      })
                    ]
                  })
                );
              }
              currentEvalText = [];
            }
          }
        }
        
        // Add any remaining text
        if (currentEvalText.length > 0) {
          for (const textLine of currentEvalText) {
            children.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: textLine,
                    size: 11,
                    font: "Calibri"
                  })
                ]
              })
            );
          }
        }
        
        // If we ended while still in a table, add the table
        if (inTable && tableData.length > 0) {
          try {
            const tableRows = tableData.map((rowData, rowIndex) => {
              return new TableRow({
                tableHeader: rowIndex === 0,
                children: rowData.map(cellText => {
                  return new TableCell({
                    shading: rowIndex === 0 ? {
                      fill: "4A86E8",
                      type: ShadingType.SOLID,
                    } : undefined,
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({
                            text: cellText,
                            color: rowIndex === 0 ? "FFFFFF" : undefined,
                            bold: rowIndex === 0,
                            size: 11,
                            font: "Calibri"
                          })
                        ]
                      })
                    ]
                  });
                })
              });
            });
            
            children.push(
              new Table({
                width: {
                  size: 100,
                  type: WidthType.PERCENTAGE,
                },
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 1, color: "4A86E8" },
                  bottom: { style: BorderStyle.SINGLE, size: 1, color: "4A86E8" },
                  left: { style: BorderStyle.SINGLE, size: 1, color: "4A86E8" },
                  right: { style: BorderStyle.SINGLE, size: 1, color: "4A86E8" },
                  insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "4A86E8" },
                  insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "4A86E8" },
                },
                rows: tableRows
              })
            );
          } catch (e) {
            console.error("Error creating final table:", e);
            for (const row of tableData) {
              children.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: row.join(" | "),
                      size: 11,
                      font: "Calibri"
                    })
                  ]
                })
              );
            }
          }
        }
      }
    }
    
    // Add transcript section at the end with a page break
    children.push(
      new Paragraph({
        text: "",
        pageBreakBefore: true
      }),
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: {
          before: 240,
          after: 120
        },
        children: [
          new TextRun({
            text: "Complete Meeting Transcript",
            bold: true,
            size: 28,
            color: "2B579A",
            font: "Calibri"
          })
        ]
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: "Below is the full transcript of the meeting audio:",
            italics: true,
            size: 11,
            font: "Calibri"
          })
        ]
      }),
      new Paragraph({
        text: "",
        spacing: {
          after: 120
        }
      })
    );
    
    // Split transcript into paragraphs for better readability
    const transcriptParagraphs = transcript.split('\n\n');
    transcriptParagraphs.forEach(para => {
      if (para.trim()) {
        children.push(
          new Paragraph({
            spacing: {
              before: 80,
              after: 80
            },
            children: [
              new TextRun({
                text: para.trim(),
                size: 11,
                font: "Calibri"
              })
            ]
          })
        );
      }
    });
    
    // Handle single-line transcript
    if (transcriptParagraphs.length <= 1 && transcript.includes('\n')) {
      const lines = transcript.split('\n');
      for (const line of lines) {
        if (line.trim()) {
          children.push(
            new Paragraph({
              spacing: {
                before: 80,
                after: 80
              },
              children: [
                new TextRun({
                  text: line.trim(),
                  size: 11,
                  font: "Calibri"
                })
              ]
            })
          );
        }
      }
    }
    
    // Create document with proper structure
    const doc = new Document({
      creator: "MeetingScribe",
      title: reportTitle,
      description: "AI-generated transcript and analysis",
      numbering: {
        config: [
          {
            reference: "discussionPoints",
            levels: [
              {
                level: 0,
                format: LevelFormat.DECIMAL,
                text: "%1.",
                alignment: AlignmentType.LEFT
              }
            ]
          }
        ]
      },
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: convertInchesToTwip(1),
                right: convertInchesToTwip(1),
                bottom: convertInchesToTwip(1),
                left: convertInchesToTwip(1),
              }
            }
          },
          headers: {
            default: new Header({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "MeetingScribe AI - Automated Meeting Analysis",
                      size: 9,
                      color: "666666",
                      italics: true
                    })
                  ],
                  alignment: AlignmentType.RIGHT
                })
              ]
            })
          },
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "Page ",
                      size: 9,
                      color: "666666"
                    }),
                    new TextRun({
                      children: [PageNumber.CURRENT],
                      size: 9,
                      color: "666666"
                    }),
                    new TextRun({
                      text: " of ",
                      size: 9,
                      color: "666666"
                    }),
                    new TextRun({
                      children: [PageNumber.TOTAL_PAGES],
                      size: 9,
                      color: "666666"
                    })
                  ],
                  alignment: AlignmentType.CENTER
                })
              ]
            })
          },
          children: children
        }
      ]
    });

    // Log completion
    console.log('Professional document generation completed successfully');

    // Use Packer to save the document
    const buffer = await Packer.toBuffer(doc);
    const reportFileName = `meeting_analysis_report_${Date.now()}.docx`;
    const reportPath = path.join(__dirname, 'uploads', reportFileName);
    fs.writeFileSync(reportPath, buffer);

    return { reportPath, reportFileName };
  } catch (error) {
    console.error('Error generating report:', error);
    throw new Error(`Failed to generate report document: ${error.message}`);
  }
}

module.exports = {
  processAudio,
  TRANSCRIPTION_MODEL,
  LLM_MODEL
}; 