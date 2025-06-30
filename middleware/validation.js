const { body, param, query, validationResult } = require('express-validator');
const mongoose = require('mongoose');

// Handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: err.path,
        message: err.msg,
        value: err.value
      }))
    });
  }
  next();
};

// User validation rules
const validateRegister = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  
  body('firstName')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('First name cannot exceed 50 characters'),
  
  body('lastName')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Last name cannot exceed 50 characters'),
  
  handleValidationErrors
];

const validateLogin = [
  body('identifier')
    .notEmpty()
    .withMessage('Email or username is required'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  
  handleValidationErrors
];

// Message validation rules
const validateSendMessage = [
  body('conversationId')
    .notEmpty()
    .withMessage('Conversation ID is required')
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('Invalid conversation ID');
      }
      return true;
    }),
  
  body('content')
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage('Message content cannot exceed 5000 characters'),
  
  body('messageType')
    .optional()
    .isIn(['text', 'image', 'video', 'audio', 'file', 'location', 'contact'])
    .withMessage('Invalid message type'),
  
  body('replyTo')
    .optional()
    .custom((value) => {
      if (value && !mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('Invalid reply message ID');
      }
      return true;
    }),
  
  // Custom validation to ensure either content or files exist
  body().custom((value, { req }) => {
    if (!req.body.content?.trim() && (!req.files || req.files.length === 0)) {
      throw new Error('Message must have either text content or file attachments');
    }
    return true;
  }),
  
  handleValidationErrors
];

// Conversation validation rules
const validateCreateConversation = [
  body('participants')
    .isArray({ min: 2 })
    .withMessage('Conversation must have at least 2 participants')
    .custom((participants) => {
      for (const participant of participants) {
        if (!mongoose.Types.ObjectId.isValid(participant)) {
          throw new Error('Invalid participant ID');
        }
      }
      return true;
    }),
  
  body('isGroup')
    .optional()
    .isBoolean()
    .withMessage('isGroup must be a boolean'),
  
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Group name must be between 1 and 100 characters'),
  
  handleValidationErrors
];

// Profile update validation
const validateUpdateProfile = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('First name cannot exceed 50 characters'),
  
  body('lastName')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Last name cannot exceed 50 characters'),
  
  body('bio')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Bio cannot exceed 500 characters'),
  
  body('preferences.theme')
    .optional()
    .isIn(['light', 'dark', 'auto'])
    .withMessage('Invalid theme preference'),
  
  body('preferences.language')
    .optional()
    .isLength({ min: 2, max: 5 })
    .withMessage('Invalid language code'),
  
  handleValidationErrors
];

// Password change validation
const validateChangePassword = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, and one number'),
  
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Password confirmation does not match');
      }
      return true;
    }),
  
  handleValidationErrors
];

// Pagination validation
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  handleValidationErrors
];

// ObjectId parameter validation
const validateObjectId = (paramName) => [
  param(paramName)
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error(`Invalid ${paramName}`);
      }
      return true;
    }),
  
  handleValidationErrors
];

// File upload validation
const validateFileUpload = [
  body('category')
    .optional()
    .isIn(['images', 'videos', 'audio', 'documents'])
    .withMessage('Invalid file category'),
  
  handleValidationErrors
];

// Search validation
const validateSearch = [
  query('query')
    .notEmpty()
    .withMessage('Search query is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('Search query must be between 1 and 100 characters'),
  
  query('type')
    .optional()
    .isIn(['messages', 'users', 'conversations'])
    .withMessage('Invalid search type'),
  
  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  validateRegister,
  validateLogin,
  validateSendMessage,
  validateCreateConversation,
  validateUpdateProfile,
  validateChangePassword,
  validatePagination,
  validateObjectId,
  validateFileUpload,
  validateSearch
};
