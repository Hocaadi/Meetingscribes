# MeetingScribe

MeetingScribe is an AI-powered application that transcribes audio recordings of meetings and generates structured insights including key discussion points, action items, requests, and decisions.

## Features

- Upload audio recordings of meetings
- Automatically transcribe audio using OpenAI Whisper API
- Generate structured insights from the transcript using OpenAI GPT-4o
- Download meeting analysis reports in DOCX format

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

## License

[MIT](LICENSE)

## Contact

For any inquiries, please contact: aadarshrathorea@gmail.com 