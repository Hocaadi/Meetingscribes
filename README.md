# MeetingScribe

MeetingScribe is an application that automatically transcribes and analyzes audio recordings of meetings, generating structured documents in both DOCX and PDF formats.

## Features

- **Audio Transcription**: Upload audio files from meetings and convert them to text.
- **Meeting Analysis**: Automatically extracts key information, action items, and decisions.
- **Document Generation**: Creates formatted DOCX and PDF reports from the meeting content.
- **Document Q&A**: Ask questions about your meeting content and get AI-powered answers based on the generated document.
- **Real-time Processing Status**: Track the progress of your audio processing via WebSocket updates.
- **Customizable Instructions**: Provide specific instructions to tailor the analysis to your needs.

## Technical Stack

- **Frontend**: React.js with Bootstrap
- **Backend**: Node.js with Express
- **Real-time Communication**: Socket.io for live processing updates
- **Document Processing**: Mammoth for DOCX parsing, pdf-parse for PDF content
- **AI Integration**:
  - Whisper API for speech-to-text transcription
  - GPT models for content analysis and document generation
  - LLM integration for document question-answering

## Getting Started

### Prerequisites

- Node.js (v14+)
- NPM or Yarn

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/meetingscribe.git
   cd meetingscribe
   ```

2. Install dependencies:
   ```
   npm install
   cd frontend && npm install
   cd ../backend && npm install
   ```

3. Create a `.env` file in the `backend` directory based on `.env.example` and add your configuration.

4. Start the development servers:
   ```
   npm start
   ```

## Usage

1. Navigate to `http://localhost:3000` in your browser
2. Upload an audio file of your meeting
3. Wait for the processing to complete (you'll see real-time status updates)
4. Download the generated DOCX and/or PDF reports
5. Use the Q&A feature to ask questions about your meeting content

## Document Q&A Feature

The Document Q&A feature allows you to:

- Ask specific questions about the content of your meeting document
- Get answers that are directly extracted from the document content
- Explore complex topics without re-reading the entire document
- Clarify points that might be unclear from the summary alone

For optimal results:
- Ask clear, specific questions
- Configure an OpenAI API key in your `.env` file
- Be aware that answers are only as good as the content in your document

## Environment Variables

Create a `.env` file in the `backend` directory with the following variables:

```
PORT=5000
NODE_ENV=development
MAX_FILE_SIZE=50000000
FRONTEND_URL=http://localhost:3000
OPENAI_API_KEY=your_openai_api_key_here
TRANSCRIPTION_MODEL=whisper
ANALYSIS_MODEL=gpt-3.5-turbo
```

## License

[MIT License](LICENSE)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Live Demo

Access the application at: [MeetingScribe](#) (URL will be updated after deployment)

## Tech Stack

- **Frontend**: React, Bootstrap
- **Backend**: Node.js, Express
- **APIs**: OpenAI (Whisper API and GPT-4o)
- **Document Generation**: docx library

## Local Development

### Prerequisites

- Node.js (v16+)
- npm or yarn
- OpenAI API key

### Setup

1. Clone the repository
   ```
   git clone <repository-url>
   cd MeetingScribe
   ```

2. Install dependencies
   ```
   npm install
   cd frontend && npm install
   cd ../backend && npm install
   ```

3. Create `.env` file in the backend directory
   ```
   # API Keys
   OPENAI_API_KEY=your_openai_api_key
   PORT=5000

   # Upload limits
   MAX_FILE_SIZE=50000000
   ```

4. Start the development server
   ```
   npm start
   ```

5. Access the application at http://localhost:3000

## Deployment

### Frontend Deployment (Vercel)

1. Create a Vercel account at [vercel.com](https://vercel.com)
2. Install Vercel CLI: `npm i -g vercel`
3. Navigate to the frontend directory: `cd frontend`
4. Run `vercel` and follow the prompts
5. Set the API_URL environment variable to point to your backend deployment

### Backend Deployment (Render)

1. Create a [Render](https://render.com) account
2. Create a new Web Service
3. Connect your GitHub repository
4. Configure the service:
   - Build Command: `npm install`
   - Start Command: `cd backend && node server.js`
   - Environment Variables:
     - OPENAI_API_KEY: Your OpenAI API key
     - NODE_ENV: production
     - FRONTEND_URL: Your frontend deployment URL
     - PORT: 10000 (Render default)

### Environment Variables

Ensure these environment variables are set on your deployment platform:

- `OPENAI_API_KEY`: Your OpenAI API key
- `NODE_ENV`: Set to "production" for production environments
- `FRONTEND_URL`: The URL of your frontend deployment
- `PORT`: The port your backend server should listen on

## Security Considerations

- Never commit your OpenAI API key to version control
- Set up rate limiting to control API usage
- Implement user authentication for production use

## Contact

For any inquiries, please contact: aadarshrathorea@gmail.com 