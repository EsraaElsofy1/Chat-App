require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const path = require("path");
const connectDB = require("./db");

// Import routes
const authRoutes = require("./Routes/authRoutes");
const messageRoutes = require("./Routes/messageRoutes");
const conversationRoutes = require("./Routes/conversationRoutes");
const uploadRoutes = require("./Routes/uploadRoutes");
const searchRoutes = require("./Routes/searchRoutes");

const { handleSocketConnection } = require("./socket");

const app = express();
const server = http.createServer(app);

// Socket.io configuration with CORS
const io = socketIo(server, {
  cors: {
    origin: process.env.SOCKET_CORS_ORIGIN || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files (for uploaded files)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Basic security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/search", searchRoutes);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development"
  });
});

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'build')));

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON in request body' });
  }

  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request entity too large' });
  }

  res.status(500).json({
    error: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { details: err.message })
  });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Connect to database
connectDB();

// Initialize WebSocket connections
handleSocketConnection(io);

// Start server

const port = process.env.PORT || 1235;
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
}); 