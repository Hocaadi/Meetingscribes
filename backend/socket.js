// Update CORS configuration for socket.io
const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:3000',
      'https://meetingscribe--zeta.vercel.app',
      'https://meetingscribe.vercel.app',
      'https://meetingscribe-zeta.vercel.app'
    ],
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
}); 