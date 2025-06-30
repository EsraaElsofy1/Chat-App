const express = require('express');
const router = express.Router();
const searchController = require('../controllers/searchController');
const { authenticateToken } = require('../middleware/auth');
const { validateSearch, validatePagination } = require('../middleware/validation');

// Apply authentication to all search routes
router.use(authenticateToken);

// Search messages
router.get('/messages', 
  validateSearch,
  validatePagination,
  searchController.searchMessages
);

// Search users
router.get('/users',
  validateSearch,
  validatePagination,
  searchController.searchUsers
);

// Search conversations
router.get('/conversations',
  validateSearch,
  validatePagination,
  searchController.searchConversations
);

// Global search (all types)
router.get('/global',
  validateSearch,
  searchController.globalSearch
);

module.exports = router;
