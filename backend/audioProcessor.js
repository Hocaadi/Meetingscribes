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

const MODEL_OPENAI = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const TEMPERATURE = parseFloat(process.env.OPENAI_TEMPERATURE || '0.1');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

/**
 * Process audio file to generate a meeting analysis report
 * @param {string} audioFilePath - Path to the uploaded audio file
 * @param {string} userCustomInstructions - Optional custom instructions from the user
 * @param {string} meetingTopic - Optional meeting topic/domain context
 * @returns {Promise<Object>} - Object containing report file path and name
 */
async function processAudio(audioFilePath, userCustomInstructions = '', meetingTopic = '') {
  try {
    console.log('Processing audio file:', audioFilePath);
    
    // Log context information for better debugging
    if (userCustomInstructions) {
      console.log('User provided custom instructions for analysis');
    }
    
    if (meetingTopic) {
      console.log('Meeting topic provided:', meetingTopic);
    }

    // Step 1: Convert audio to required format (16kHz, mono, wav) if needed
    const convertedFilePath = await convertAudioFormat(audioFilePath);
    console.log('Audio converted successfully');

    // Step 2: Transcribe the audio using OpenAI Whisper API
    console.log('Transcribing audio...');
    const transcript = await transcribeAudio(convertedFilePath);
    console.log('Audio transcribed successfully');

    // Step 3: Extract structured insights using OpenAI API
    console.log('Extracting structured insights...');
    const structuredInsights = await extractStructuredInsights(transcript, userCustomInstructions, meetingTopic);
    console.log('Insights extracted successfully');

    // Step 4: Generate document with results
    console.log('Generating report document...');
    const reportFileName = `meeting_analysis_report_${Date.now()}.docx`;
    const reportPath = path.join(__dirname, 'uploads', reportFileName);
    await generateReport(transcript, structuredInsights, reportPath, meetingTopic);
    console.log('Report generated successfully at:', reportPath);

    // Clean up temporary files
    if (convertedFilePath !== audioFilePath) {
      fs.unlinkSync(convertedFilePath);
    }

    return {
      reportPath: reportPath,
      fileName: reportFileName
    };
  } catch (error) {
    console.error('Error in audio processing:', error);
    throw error;
  }
}

/**
 * Convert audio to the required format for processing
 * @param {string} inputFilePath - Original audio file path
 * @returns {Promise<string>} - Path to the converted audio file
 */
async function convertAudioFormat(inputFilePath) {
  return new Promise((resolve, reject) => {
    const outputFilePath = path.join(
      path.dirname(inputFilePath),
      `converted_${path.basename(inputFilePath)}.wav`
    );

    ffmpeg(inputFilePath)
      .output(outputFilePath)
      .audioFrequency(16000)
      .audioChannels(1)
      .on('end', () => resolve(outputFilePath))
      .on('error', (err) => reject(err))
      .run();
  });
}

/**
 * Transcribe audio using OpenAI Whisper API with the SDK
 * @param {string} audioFilePath - Path to the audio file
 * @returns {Promise<string>} - Transcribed text
 */
async function transcribeAudio(audioFilePath) {
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
    
    // Call OpenAI API with retry logic
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        attempts++;
        
        // Create a fresh file stream for each attempt
        const fileStream = fs.createReadStream(audioFilePath);
        
        const transcription = await openai.audio.transcriptions.create({
          file: fileStream,
          model: "whisper-1",
        });
        
        if (!transcription || !transcription.text) {
          throw new Error("Received empty response from OpenAI API");
        }
        
        return transcription.text;
      } catch (apiError) {
        console.error(`API attempt ${attempts} failed:`, apiError.message);
        
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
 * Extract structured insights from the transcript using OpenAI API with the SDK
 * @param {string} transcript - Transcript text
 * @param {string} userCustomInstructions - Optional custom instructions from the user
 * @param {string} meetingTopic - Optional meeting topic/domain context
 * @returns {Promise<string>} - Structured insights text
 */
async function extractStructuredInsights(transcript, userCustomInstructions = '', meetingTopic = '') {
  if (!transcript || transcript.trim() === '') {
    throw new Error('Cannot analyze empty transcript');
  }
  
  try {
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
        const completion = await openai.chat.completions.create({
          model: MODEL_OPENAI,
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
        
        return completion.choices[0].message.content;
      } catch (apiError) {
        console.error(`API attempt ${attempts} failed:`, apiError.message);
        
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
  processAudio
}; 