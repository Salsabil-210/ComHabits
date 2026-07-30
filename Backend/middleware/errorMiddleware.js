const { AppError } = require("../util/errors");

const errorHandler = (err, req, res, next) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }

  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ 
      success: false,
      message: "Invalid token"
    });
  }

  if (err.name === 'ValidationError') {
    return res.status(400).json({ 
      success: false,
      message: err.message
    });
  }

  console.error("❌ Unhandled Error:", err);
  res.status(500).json({
    success: false,
    message: "Internal Server Error",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
};

module.exports = { errorHandler };