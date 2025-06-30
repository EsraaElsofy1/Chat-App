const mongoose = require("mongoose");
const Message = require("../models/message");
const Conversation = require("../models/Conversation");
const mime = require('mime-types');
const path = require('path');


// Helper function to check if a user ID is a non-empty string
const validateUserId = (id, res, fieldName) => {
  if (typeof id !== "string" || !id.trim()) {
    res.status(400).json({ error: `Invalid ${fieldName} ID` });
    return false;
  }
  return true;
};


const validateObjectId = (id, res, fieldName = "ID") => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ error: `Invalid ${fieldName}` });
    return false;
  }
  return true;
}; 
// Send a new message.const  

module.exports.sendMessage = async (req, res) => {
  try {
    const sender = req.user._id;
    const { conversationId, content, messageType, replyTo } = req.body;

    // Get processed files from upload middleware (if any)
    const attachments = req.processedFiles || [];

    // Validate required fields: either text or attachments must exist
    if (!conversationId || !sender || (!content?.trim() && attachments.length === 0)) {
      return res.status(400).json({ error: "Message must have text or attachments" });
    }

    // Validate conversation exists and user is participant
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    if (!conversation.participants.includes(sender)) {
      return res.status(403).json({ error: "You are not a participant in this conversation" });
    }

    // Determine message type
    let finalMessageType = messageType || "text";
    if (attachments.length > 0 && !messageType) {
      finalMessageType = attachments[0].category === "images" ? "image" :
                        attachments[0].category === "videos" ? "video" :
                        attachments[0].category === "audio" ? "audio" : "file";
    }

    // Prepare attachments for database
    const formattedAttachments = attachments.map(file => ({
      url: file.url,
      fileType: file.category === "images" ? "image" :
                file.category === "videos" ? "video" :
                file.category === "audio" ? "audio" : "file",
      fileName: file.originalName,
      fileSize: file.size,
      mimeType: file.mimetype,
      thumbnailUrl: file.thumbnailUrl || null
    }));

    const newMessage = new Message({
      conversation: conversationId,
      sender,
      content: content || "",
      messageType: finalMessageType,
      attachments: formattedAttachments,
      replyTo: replyTo || null,
    });

    // Save the message to the database
    await newMessage.save();

    // Update conversation's last message
    conversation.lastMessage = newMessage._id;
    await conversation.save();

    // Populate sender info for response
    await newMessage.populate('sender', 'username firstName lastName avatar');
    if (replyTo) {
      await newMessage.populate('replyTo', 'content sender');
    }

    res.status(201).json({
      message: "Message sent successfully",
      data: newMessage
    });

  } catch (error) {
    console.error("Send message error:", error);
    res.status(500).json({
      error: "Error sending message",
      details: error.message
    });
  }
};



 //Retrieve messages between two users.
 
module.exports.getMessagesBetweenUsers = async (req, res) => {
  try {
    const user1 = req.user.userId;
    const { user2 } = req.params;
    const { page = 1, limit = 20 } = req.query;
    
    // Convert to numbers
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    
    if (!validateObjectId(user1, res, "user1") || !validateObjectId(user2, res, "user2")) {
      return;
    }

    const conversation = await Conversation.findOne({
      participants: { $all: [user1, user2] }
    });

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    // Get total count for pagination
    const totalMessages = await Message.countDocuments({
      conversation: conversation._id
    });

    // Get paginated messages
    const messages = await Message.find({
      conversation: conversation._id
    })
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .populate("sender", "username avatar")
      .populate("replyTo")
      .populate("reactions.user", "username avatar");

    res.status(200).json({
      messages: messages.reverse(), // Reverse to maintain chronological order
      pagination: {
        total: totalMessages,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(totalMessages / limitNum)
      }
    });
  } catch (error) {
    res.status(500).json({ error: "Error fetching messages", details: error.message });
  }
};

//mark messages as delivered
module.exports.markMessagesAsDelivered = async (req, res) => {
  try {
    const UserId = req.user.userId;
    const { userId: otherUserId } = req.params;

    if (!validateUserId(UserId, res, "User") || !validateUserId(otherUserId, res, "otherUser")) {
      return;
    }

    await Message.updateMany(
      {
        sender: otherUserId,
        deliveredTo: { $ne: UserId }
      },
      {
        $addToSet: { deliveredTo: UserId }
      }
    );

    res.status(200).json({ message: "Messages marked as delivered" });
  } catch (error) {
    res.status(500).json({ error: "Error updating messages", details: error.message });
  }
};


 // Mark messages as read between two users.
 module.exports.markMessagesAsRead = async (req, res) => {
  try {
    const UserId = req.user.userId; 
    const { userId: otherUserId } = req.params;

    if (!validateUserId(UserId, res, "User") || !validateUserId(otherUserId, res, "otherUser")) {
      return;
    }

    await Message.updateMany(
      {
        sender: otherUserId,
        readBy: { $ne: UserId }
      },
      {
        $addToSet: { readBy: UserId }
      }
    );

    res.status(200).json({ message: "Messages marked as read " });
  } catch (error) {
    res.status(500).json({ error: "Error updating messages", details: error.message });
  }
};




//edit message
module.exports.editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.userId;
    const { content } = req.body;

    if (!validateObjectId(messageId, res, "message")) {
      return;
    }

    if (!content || content.trim() === '') {
      return res.status(400).json({ error: "Message content cannot be empty" });
    }

    // Find the message first
    const message = await Message.findById(messageId);
    
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }
    
    // Check if the user is the sender of the message
    if (message.sender.toString() !== userId) {
      return res.status(403).json({ error: "Unauthorized: You can only edit your own messages" });
    }

    // Save the original content to edit history
    if (!message.editHistory) {
      message.editHistory = [];
    }
    
    message.editHistory.push({
      content: message.content,
      editedAt: new Date()
    });
    
    // Update the message
    message.content = content;
    message.edited = true;
    await message.save();

    res.status(200).json({ 
      message: "Message edited successfully", 
      data: message 
    });
  } catch (error) {
    res.status(500).json({ error: "Error editing message", details: error.message });
  }
};


 //Delete a message (soft delete).
 
module.exports.deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.userId;

    if (!validateObjectId(messageId, res, "message")) {
      return;
    }

    // Find the message first
    const message = await Message.findById(messageId);
    
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }
    
    // Check if the user is the sender of the message
    if (message.sender.toString() !== userId) {
      return res.status(403).json({ error: "Unauthorized: You can only delete your own messages" });
    }

    // Proceed with soft delete
    const deletedMessage = await Message.findByIdAndUpdate(
      messageId,
      { deleted: true, content: "This message was deleted." },
      { new: true }
    );

    res.status(200).json({ message: "Message deleted successfully", data: deletedMessage });
  } catch (error) {
    res.status(500).json({ error: "Error deleting message" });
  }
};


 //Unsend a message (permanent deletion).
 
module.exports.unsendMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.userId;

    if (!validateObjectId(messageId, res, "message")) {
      return;
    }

    // Find the message first
    const message = await Message.findById(messageId);
    
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }
    
    // Check if the user is the sender of the message
    if (message.sender.toString() !== userId) {
      return res.status(403).json({ error: "Unauthorized: You can only unsend your own messages" });
    }

    // Proceed with permanent deletion
    const deletedMessage = await Message.findByIdAndDelete(messageId);

    res.status(200).json({ message: "Message unsent successfully" });
  } catch (error) {
    res.status(500).json({ error: "Error unsending message" });
  }
};


 //Add a reaction to a message.
 
module.exports.addReaction = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.userId;
    const { emoji } = req.body;

    if (!validateObjectId(messageId, res, "message")) {
      return;
    }

    const allowedReactions = ["like", "love", "haha", "sad", "angry", "wow", "care"];
    if (!allowedReactions.includes(emoji)) {
      return res.status(400).json({ error: "Invalid reaction emoji" });
    }

    const updatedMessage = await Message.findByIdAndUpdate(
      messageId,
      { $addToSet: { reactions: { user: userId, emoji } } },
      { new: true }
    );

    if (!updatedMessage) {
      return res.status(404).json({ error: "Message not found" });
    }

    res.status(200).json({ message: "Reaction added successfully", data: updatedMessage });
  } catch (error) {
    res.status(500).json({ error: "Error adding reaction", details: error.message });
  }
}; 

//remove reaction
module.exports.removeReaction = async (req, res) => {
  try {
    const sender = req.user.userId;
    const { messageId } = req.params;

    if (!messageId || !sender) {
      return res.status(400).json({ error: "messageId and userId are required" });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    message.reactions = message.reactions.filter(
      reaction => reaction.user.toString() !== sender
    );

    await message.save();

    res.status(200).json({ message: "Reaction removed successfully", data: message });
  } catch (error) {
    res.status(500).json({ error: "Error removing reaction" });
  }
};
//forward message
module.exports.forwardMessage = async (req, res) => {
  try {
    const sender = req.user.userId;
    const { messageId, conversationId } = req.body;
    
    if (!validateObjectId(messageId, res, "message") || 
        !validateObjectId(conversationId, res, "conversation")) {
      return;
    }
    
    // Find original message
    const originalMessage = await Message.findById(messageId);
    if (!originalMessage) {
      return res.status(404).json({ error: "Original message not found" });
    }
    
    // Create new message with same content
    const newMessage = new Message({
      conversation: conversationId,
      sender,
      content: originalMessage.content,
      messageType: originalMessage.messageType,
      attachments: originalMessage.attachments,
      forwardedFrom: messageId
    });
    
    await newMessage.save();
    
    res.status(201).json({ 
      message: "Message forwarded successfully", 
      data: newMessage 
    });
  } catch (error) {
    res.status(500).json({ error: "Error forwarding message", details: error.message });
  }
};

//search messages
module.exports.searchMessages = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { query } = req.query;
    
    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: "Search query is required" });
    }
    
    // Find conversations where user is a participant
    const conversations = await Conversation.find({
      participants: userId
    });
    
    if (conversations.length === 0) {
      return res.status(200).json([]);
    }
    
    const conversationIds = conversations.map(conv => conv._id);
    
    // Search for messages in user's conversations
    const messages = await Message.find({
      conversation: { $in: conversationIds },
      content: { $regex: query, $options: 'i' },
      deleted: false
    })
    .sort({ createdAt: -1 })
    .populate("sender", "username avatar")
    .limit(20);
    
    res.status(200).json(messages);
  } catch (error) {
    res.status(500).json({ error: "Error searching messages", details: error.message });
  }
};


 //Pin/Unpin a message in a conversation
 
module.exports.togglePinMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.userId;

    if (!validateObjectId(messageId, res, "message")) {
      return;
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    // Check if the user is the sender of the message
    if (message.sender.toString() !== userId) {
      return res.status(403).json({ error: "Unauthorized: You can only pin/unpin your own messages" });
    }

    // Toggle pin status
    message.isPinned = !message.isPinned;
    message.pinnedBy = message.isPinned ? userId : null;
    
    await message.save();

    res.status(200).json({ 
      message: `Message ${message.isPinned ? 'pinned' : 'unpinned'} successfully`, 
      data: {
        _id: message._id,
        isPinned: message.isPinned
      }
    });
  } catch (error) {
    res.status(500).json({ error: "Error updating message pin status", details: error.message });
  }
};

 //Get pinned messages in a conversation
 
module.exports.getPinnedMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    
    if (!validateObjectId(conversationId, res, "conversation")) {
      return;
    }
    
    const pinnedMessages = await Message.find({
      conversation: conversationId,
      isPinned: true,
      deleted: false
    })
    .sort({ createdAt: -1 })
    .populate("sender", "username avatar");
    
    res.status(200).json({ messages: pinnedMessages });
  } catch (error) {
    res.status(500).json({ error: "Error fetching pinned messages", details: error.message });
  }
};

