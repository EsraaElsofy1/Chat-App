const jwt = require("jsonwebtoken");
const User = require("../models/user");

// JWT Secret (should be in environment variables)
const JWT_SECRET = process.env.JWT_SECRET || "your-super-secret-jwt-key-change-this-in-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

// Middleware to verify JWT token
const authenticateToken = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ 
        error: "Access denied. No token provided." 
      });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Get user from database
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({ 
        error: "Invalid token. User not found." 
      });
    }

    // Check if user account is active
    if (!user.isActive) {
      return res.status(401).json({ 
        error: "Account is deactivated." 
      });
    }

    // Check if account is locked
    if (user.isLocked) {
      return res.status(401).json({ 
        error: "Account is temporarily locked due to too many failed login attempts." 
      });
    }

    // Add user to request object
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: "Invalid token." 
      });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: "Token expired." 
      });
    } else {
      console.error("Auth middleware error:", error);
      return res.status(500).json({ 
        error: "Internal server error." 
      });
    }
  }
};

// Optional authentication middleware (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findById(decoded.userId).select('-password');
      
      if (user && user.isActive && !user.isLocked) {
        req.user = user;
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

// Middleware to check if user is admin (if you plan to add admin features)
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: "Authentication required." 
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      error: "Admin access required." 
    });
  }

  next();
};

// Rate limiting for authentication endpoints
const authRateLimit = {};

const rateLimitAuth = (maxAttempts = 5, windowMs = 15 * 60 * 1000) => {
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    
    if (!authRateLimit[ip]) {
      authRateLimit[ip] = { attempts: 0, resetTime: now + windowMs };
    }
    
    const userLimit = authRateLimit[ip];
    
    // Reset if window has passed
    if (now > userLimit.resetTime) {
      userLimit.attempts = 0;
      userLimit.resetTime = now + windowMs;
    }
    
    // Check if limit exceeded
    if (userLimit.attempts >= maxAttempts) {
      const timeLeft = Math.ceil((userLimit.resetTime - now) / 1000 / 60);
      return res.status(429).json({
        error: `Too many authentication attempts. Try again in ${timeLeft} minutes.`
      });
    }
    
    // Increment attempts
    userLimit.attempts++;
    next();
  };
};

module.exports = {
  generateToken,
  authenticateToken,
  optionalAuth,
  requireAdmin,
  rateLimitAuth
};
