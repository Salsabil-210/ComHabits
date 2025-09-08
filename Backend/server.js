const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const http = require("http");
const { Server } = require("socket.io");
const connectDB = require("./config/db");
const path = require("path");
const fs = require('fs');
const jwt = require('jsonwebtoken');
const { deliverPendingNotifications } = require('./util/socketHelpers');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');

dotenv.config();

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Enhanced Security Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"]
    }
  },
  crossOriginResourcePolicy: { policy: "same-site" }
}));

app.use(compression());
app.use(mongoSanitize());
app.use(hpp());

// Ensure uploads directory exists
const uploadsPath = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}

// Enhanced CORS configuration
const corsOptions = {
  origin: [
    "http://10.0.2.2:8081",       // Android emulator
    "http://localhost:8081",       // iOS simulator
    "http://192.168.0.104:8081",   // Real Android device
    process.env.FRONTEND_URL       // Production frontend
  ].filter(Boolean),
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Socket.IO Configuration
const io = new Server(server, {
  cors: corsOptions,
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
    skipMiddlewares: true
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many requests from this IP, please try again later."
});

app.use(apiLimiter);

// Body Parsing
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Socket.IO Connection Handling
const connectedUsers = new Map(); // Using Map for better performance

io.on('connection', (socket) => {
  console.log('🔌 New client connected:', socket.id);
  console.log('🔵 New connection:', socket.id);

  socket.on('authenticate', async (token, callback) => {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.userId;
      
      // Store the socket ID for this user
      connectedUsers.set(userId, socket.id);
      socket.join(`user_${userId}`);
      
      console.log(`🟢 Authenticated user ${decoded.userId}`);
      console.log(`✅ User ${userId} authenticated`);
      
      // Deliver any pending notifications
      await deliverPendingNotifications(userId);
      
      callback({ success: true });
    } catch (error) {
      console.error('Socket auth error:', error);
      callback({ success: false, message: 'Authentication failed' });
    }
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    console.log('⚪ Disconnected:', socket.id);

    // Clean up disconnected users
    for (const [userId, socketId] of connectedUsers.entries()) {
      if (socketId === socket.id) {
        connectedUsers.delete(userId);
        console.log(`❌ User ${userId} disconnected`);
        break;
      }
    }
  });

  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
});

// Make io and connectedUsers available globally
global.io = io;
global.connectedUsers = connectedUsers;

// Database Connection
connectDB().catch(err => {
  console.error('Database connection error:', err);
  process.exit(1);
});

// API Routes
const apiRoutes = [
  { path: "/api/auth", route: require("./routes/authRoutes") },
  { path: "/api/password-reset", route: require("./routes/passwordResetRoutes") },
  { path: "/api/me", route: require("./routes/meRoutes") },
  { path: "/api/habits", route: require("./routes/habitRoutes") },
  { path: "/api/badhabits", route: require("./routes/BadhabitRoutes") },
  { path: "/api/friends", route: require("./routes/friendRoutes") },
  { path: "/api/settings", route: require("./routes/settingsRoutes") },
  { path: "/api/notifications", route: require("./routes/notificationRoutes") },
  { path: "/api/distractions", route: require('./routes/distractionRoutes') }
];

// Register routes
apiRoutes.forEach(({ path, route }) => {
  app.use(path, route);
});

// Static files
app.use('/uploads', express.static(uploadsPath, {
  maxAge: '1d',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 404 Handler
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: "Endpoint not found"
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ 
      success: false,
      message: "Invalid token"
    });
  }

  // Handle validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({ 
      success: false,
      message: err.message
    });
  }

  res.status(500).json({ 
    success: false,
    message: "Internal Server Error",
    error: process.env.NODE_ENV === "development" ? err.message : undefined
  });
});

// Server startup
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running in ${process.env.NODE_ENV || "development"} mode on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  server.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  server.close(() => process.exit(1));
});