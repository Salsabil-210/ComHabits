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
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const { deliverPendingNotifications } = require('./util/socketHelpers');

dotenv.config();

const app = express();
const server = http.createServer(app);

const ensureUploadsDirectory = (directoryPath) => {
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
  }
};

const configureSecurity = (expressApp) => {
  expressApp.use(helmet({
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

  expressApp.use(compression());
  expressApp.use(mongoSanitize());
  expressApp.use(hpp());
};

const createCorsOptions = () => ({
  origin: [
    "http://10.0.2.2:8081",       // Android emulator
    "http://localhost:8081",       // iOS simulator
    "http://192.168.0.104:8081",   // Real Android device
    process.env.FRONTEND_URL       // Production frontend
  ].filter(Boolean),
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  credentials: true,
  optionsSuccessStatus: 200
});

const configureParsers = (expressApp) => {
  expressApp.use(express.json({ limit: '10kb' }));
  expressApp.use(express.urlencoded({ extended: true, limit: '10kb' }));
};

const applyRateLimiting = (expressApp, options) => {
  expressApp.use(rateLimit(options));
};

const registerApiRoutes = (expressApp, routes) => {
  routes.forEach(({ path, route }) => {
    expressApp.use(path, route);
  });
};

const removeDisconnectedUser = (socketId, connectedUsers) => {
  for (const [userId, registeredSocketId] of connectedUsers.entries()) {
    if (registeredSocketId === socketId) {
      connectedUsers.delete(userId);
      console.log(`❌ User ${userId} disconnected`);
      break;
    }
  }
};

const handleSocketAuthentication = async (socket, token, callback, connectedUsers) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.userId;

    connectedUsers.set(userId, socket.id);
    socket.join(`user_${userId}`);

    console.log(`🟢 Authenticated user ${userId}`);

    await deliverPendingNotifications(userId);

    callback({ success: true });
  } catch (error) {
    console.error('Socket auth error:', error);
    callback({ success: false, message: 'Authentication failed' });
  }
};

const registerSocketEvents = (io, connectedUsers) => {
  io.on('connection', (socket) => {
    console.log('🔌 New client connected:', socket.id);

    socket.on('authenticate', (token, callback) =>
      handleSocketAuthentication(socket, token, callback, connectedUsers)
    );

    socket.on('disconnect', () => {
      console.log(`⚪ Client disconnected: ${socket.id}`);
      removeDisconnectedUser(socket.id, connectedUsers);
    });

    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  });
};

const initializeSocketServer = (httpServer, corsOptions) => {
  const io = new Server(httpServer, {
    cors: corsOptions,
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
      skipMiddlewares: true
    },
    pingTimeout: 60000,
    pingInterval: 25000
  });

  const connectedUsers = new Map();
  registerSocketEvents(io, connectedUsers);

  return { io, connectedUsers };
};

const uploadsPath = path.join(__dirname, 'public/uploads');
ensureUploadsDirectory(uploadsPath);

configureSecurity(app);

const corsOptions = createCorsOptions();
app.use(cors(corsOptions));

applyRateLimiting(app, {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many requests from this IP, please try again later."
});

configureParsers(app);

const { io, connectedUsers } = initializeSocketServer(server, corsOptions);

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
registerApiRoutes(app, apiRoutes);

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