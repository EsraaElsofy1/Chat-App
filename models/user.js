const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const UserSchema = new mongoose.Schema({
  // Basic user information
  username: {
    type: String,
    required: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },

  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },

  password: {
    type: String,
    required: true,
    minlength: 6
  },

  // Profile information
  firstName: {
    type: String,
    trim: true,
    maxlength: 50
  },

  lastName: {
    type: String,
    trim: true,
    maxlength: 50
  },

  avatar: {
    type: String,
    default: null // URL to profile picture
  },

  bio: {
    type: String,
    maxlength: 500,
    default: ""
  },

  // Status and presence
  status: {
    type: String,
    enum: ["online", "offline", "away", "busy"],
    default: "offline"
  },

  lastSeen: {
    type: Date,
    default: Date.now
  },

  isActive: {
    type: Boolean,
    default: true
  },

  // Privacy settings
  privacy: {
    showLastSeen: {
      type: String,
      enum: ["everyone", "contacts", "nobody"],
      default: "everyone"
    },
    showProfilePhoto: {
      type: String,
      enum: ["everyone", "contacts", "nobody"],
      default: "everyone"
    },
    showStatus: {
      type: String,
      enum: ["everyone", "contacts", "nobody"],
      default: "everyone"
    }
  },

  // Notification settings
  notifications: {
    messageNotifications: {
      type: Boolean,
      default: true
    },
    soundEnabled: {
      type: Boolean,
      default: true
    },
    vibrationEnabled: {
      type: Boolean,
      default: true
    }
  },

  // Account verification
  isEmailVerified: {
    type: Boolean,
    default: false
  },

  emailVerificationToken: {
    type: String,
    default: null
  },

  // Password reset
  passwordResetToken: {
    type: String,
    default: null
  },

  passwordResetExpires: {
    type: Date,
    default: null
  },

  // Account security
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },

  twoFactorSecret: {
    type: String,
    default: null
  },

  // Login tracking
  lastLoginAt: {
    type: Date,
    default: null
  },

  loginAttempts: {
    type: Number,
    default: 0
  },

  lockUntil: {
    type: Date,
    default: null
  },

  // Blocked users
  blockedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }],

  // User preferences
  preferences: {
    theme: {
      type: String,
      enum: ["light", "dark", "auto"],
      default: "light"
    },
    language: {
      type: String,
      default: "en"
    },
    timezone: {
      type: String,
      default: "UTC"
    }
  }
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.passwordResetToken;
      delete ret.emailVerificationToken;
      delete ret.twoFactorSecret;
      return ret;
    }
  }
});

// Indexes
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ username: 1 }, { unique: true });
UserSchema.index({ status: 1 });
UserSchema.index({ lastSeen: -1 });

// Virtual for full name
UserSchema.virtual('fullName').get(function() {
  if (this.firstName && this.lastName) {
    return `${this.firstName} ${this.lastName}`;
  }
  return this.username;
});

// Virtual for checking if account is locked
UserSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Pre-save middleware to hash password
UserSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return next();

  try {
    // Hash password with cost of 12
    const hashedPassword = await bcrypt.hash(this.password, 12);
    this.password = hashedPassword;
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
UserSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};

// Method to increment login attempts
UserSchema.methods.incLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }

  const updates = { $inc: { loginAttempts: 1 } };

  // Lock account after 5 failed attempts for 2 hours
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 }; // 2 hours
  }

  return this.updateOne(updates);
};

// Method to reset login attempts
UserSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 }
  });
};

// Method to update last seen
UserSchema.methods.updateLastSeen = function() {
  this.lastSeen = new Date();
  this.status = "online";
  return this.save();
};

// Method to set offline status
UserSchema.methods.setOffline = function() {
  this.status = "offline";
  this.lastSeen = new Date();
  return this.save();
};

// Method to check if user is blocked
UserSchema.methods.isBlockedBy = function(userId) {
  return this.blockedUsers.includes(userId);
};

// Method to block a user
UserSchema.methods.blockUser = function(userId) {
  if (!this.blockedUsers.includes(userId)) {
    this.blockedUsers.push(userId);
  }
  return this.save();
};

// Method to unblock a user
UserSchema.methods.unblockUser = function(userId) {
  this.blockedUsers = this.blockedUsers.filter(id => !id.equals(userId));
  return this.save();
};

module.exports = mongoose.model("User", UserSchema);
