const User = require("../models/user");
const { generateToken } = require("../middleware/auth");
const crypto = require("crypto");

// Register new user
const register = async (req, res) => {
  try {
    const { username, email, password, firstName, lastName } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({
        error: "Username, email, and password are required"
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: "Password must be at least 6 characters long"
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      if (existingUser.email === email) {
        return res.status(400).json({
          error: "Email already registered"
        });
      } else {
        return res.status(400).json({
          error: "Username already taken"
        });
      }
    }

    // Create new user
    const user = new User({
      username: username.trim(),
      email: email.toLowerCase().trim(),
      password,
      firstName: firstName?.trim(),
      lastName: lastName?.trim(),
      emailVerificationToken: crypto.randomBytes(32).toString('hex')
    });

    await user.save();

    // Generate JWT token
    const token = generateToken(user._id);

    // Update last login
    user.lastLoginAt = new Date();
    await user.save();

    res.status(201).json({
      message: "User registered successfully",
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        avatar: user.avatar,
        status: user.status,
        isEmailVerified: user.isEmailVerified
      }
    });

  } catch (error) {
    console.error("Registration error:", error);
    
    if (error.code === 11000) {
      // Duplicate key error
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        error: `${field} already exists`
      });
    }

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        error: errors.join(', ')
      });
    }

    res.status(500).json({
      error: "Internal server error during registration"
    });
  }
};

// Login user
const login = async (req, res) => {
  try {
    const { identifier, password } = req.body; // identifier can be email or username

    // Validation
    if (!identifier || !password) {
      return res.status(400).json({
        error: "Email/username and password are required"
      });
    }

    // Find user by email or username
    const user = await User.findOne({
      $or: [
        { email: identifier.toLowerCase() },
        { username: identifier }
      ]
    });

    if (!user) {
      return res.status(401).json({
        error: "Invalid credentials"
      });
    }

    // Check if account is locked
    if (user.isLocked) {
      return res.status(401).json({
        error: "Account is temporarily locked due to too many failed login attempts"
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(401).json({
        error: "Account is deactivated"
      });
    }

    // Compare password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      // Increment login attempts
      await user.incLoginAttempts();
      
      return res.status(401).json({
        error: "Invalid credentials"
      });
    }

    // Reset login attempts on successful login
    if (user.loginAttempts > 0) {
      await user.resetLoginAttempts();
    }

    // Generate JWT token
    const token = generateToken(user._id);

    // Update last login and set online status
    user.lastLoginAt = new Date();
    user.status = "online";
    await user.save();

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        avatar: user.avatar,
        status: user.status,
        lastSeen: user.lastSeen,
        isEmailVerified: user.isEmailVerified,
        preferences: user.preferences,
        notifications: user.notifications
      }
    });

  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      error: "Internal server error during login"
    });
  }
};

// Logout user
const logout = async (req, res) => {
  try {
    const user = req.user;
    
    // Set user status to offline
    user.status = "offline";
    user.lastSeen = new Date();
    await user.save();

    res.json({
      message: "Logout successful"
    });

  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({
      error: "Internal server error during logout"
    });
  }
};

// Get current user profile
const getProfile = async (req, res) => {
  try {
    const user = req.user;

    res.json({
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        avatar: user.avatar,
        bio: user.bio,
        status: user.status,
        lastSeen: user.lastSeen,
        isEmailVerified: user.isEmailVerified,
        preferences: user.preferences,
        notifications: user.notifications,
        privacy: user.privacy,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({
      error: "Internal server error"
    });
  }
};

// Update user profile
const updateProfile = async (req, res) => {
  try {
    const user = req.user;
    const { firstName, lastName, bio, preferences, notifications, privacy } = req.body;

    // Update allowed fields
    if (firstName !== undefined) user.firstName = firstName.trim();
    if (lastName !== undefined) user.lastName = lastName.trim();
    if (bio !== undefined) user.bio = bio.trim();
    
    if (preferences) {
      user.preferences = { ...user.preferences, ...preferences };
    }
    
    if (notifications) {
      user.notifications = { ...user.notifications, ...notifications };
    }
    
    if (privacy) {
      user.privacy = { ...user.privacy, ...privacy };
    }

    await user.save();

    res.json({
      message: "Profile updated successfully",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        avatar: user.avatar,
        bio: user.bio,
        preferences: user.preferences,
        notifications: user.notifications,
        privacy: user.privacy
      }
    });

  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({
      error: "Internal server error"
    });
  }
};

// Change password
const changePassword = async (req, res) => {
  try {
    const user = req.user;
    const { currentPassword, newPassword } = req.body;

    // Validation
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: "Current password and new password are required"
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        error: "New password must be at least 6 characters long"
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    
    if (!isCurrentPasswordValid) {
      return res.status(401).json({
        error: "Current password is incorrect"
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      message: "Password changed successfully"
    });

  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({
      error: "Internal server error"
    });
  }
};

module.exports = {
  register,
  login,
  logout,
  getProfile,
  updateProfile,
  changePassword
};
