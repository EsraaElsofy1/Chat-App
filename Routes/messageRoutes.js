const express = require("express");
const messageController = require("../controllers/messageController");
const { authenticateToken } = require("../middleware/auth");
const { upload, processImage, handleUploadError } = require("../middleware/upload");
const {
  validateSendMessage,
  validateObjectId,
  validatePagination
} = require("../middleware/validation");
const router = express.Router();

// Apply authentication to all message routes
router.use(authenticateToken);

// Send a new message (with optional file attachments)
router.post("/send",
  upload.array('files', 5), // Allow up to 5 files
  processImage,
  handleUploadError,
  validateSendMessage,
  messageController.sendMessage
);

// Get messages between two users
router.get("/:user1/:user2",
  validateObjectId('user1'),
  validateObjectId('user2'),
  validatePagination,
  messageController.getMessagesBetweenUsers
);

// Mark messages as read between two users
router.put("/read/:user1/:user2",
  validateObjectId('user1'),
  validateObjectId('user2'),
  messageController.markMessagesAsRead
);

// Edit a message
router.put("/:messageId/edit",
  validateObjectId('messageId'),
  messageController.editMessage
);

// Soft delete a message
router.put("/:messageId/delete",
  validateObjectId('messageId'),
  messageController.deleteMessage
);

// Unsend a message
router.delete("/:messageId/unsend",
  validateObjectId('messageId'),
  messageController.unsendMessage
);

// Add a reaction to a message
router.post("/:messageId/reaction",
  validateObjectId('messageId'),
  messageController.addReaction
);

// Remove a reaction from a message
router.delete("/:messageId/reaction",
  validateObjectId('messageId'),
  messageController.removeReaction
);

// Forward a message
router.post("/:messageId/forward",
  validateObjectId('messageId'),
  messageController.forwardMessage
);

// Pin/Unpin a message
router.put("/:messageId/pin",
  validateObjectId('messageId'),
  messageController.togglePinMessage
);

// Get pinned messages in a conversation
router.get("/conversation/:conversationId/pinned",
  validateObjectId('conversationId'),
  messageController.getPinnedMessages
);



module.exports = router;
