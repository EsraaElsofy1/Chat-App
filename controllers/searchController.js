const User = require('../models/user');
const Message = require('../models/message');
const Conversation = require('../models/Conversation');
const mongoose = require('mongoose');

// Search messages
const searchMessages = async (req, res) => {
  try {
    const userId = req.user._id;
    const { query, conversationId, page = 1, limit = 20 } = req.query;

    if (!query || query.trim().length < 1) {
      return res.status(400).json({
        error: 'Search query is required'
      });
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build search criteria
    let searchCriteria = {
      content: { $regex: query, $options: 'i' },
      deleted: false
    };

    // If specific conversation, search only in that conversation
    if (conversationId) {
      // Verify user has access to this conversation
      const conversation = await Conversation.findById(conversationId);
      if (!conversation || !conversation.participants.includes(userId)) {
        return res.status(403).json({
          error: 'Access denied to this conversation'
        });
      }
      searchCriteria.conversation = conversationId;
    } else {
      // Search in all user's conversations
      const userConversations = await Conversation.find({
        participants: userId
      }).select('_id');
      
      const conversationIds = userConversations.map(conv => conv._id);
      searchCriteria.conversation = { $in: conversationIds };
    }

    // Get total count for pagination
    const totalMessages = await Message.countDocuments(searchCriteria);

    // Search messages
    const messages = await Message.find(searchCriteria)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('sender', 'username firstName lastName avatar')
      .populate('conversation', 'name isGroup participants')
      .populate('replyTo', 'content sender');

    // Group messages by conversation for better UX
    const messagesByConversation = {};
    messages.forEach(message => {
      const convId = message.conversation._id.toString();
      if (!messagesByConversation[convId]) {
        messagesByConversation[convId] = {
          conversation: message.conversation,
          messages: []
        };
      }
      messagesByConversation[convId].messages.push(message);
    });

    res.json({
      query,
      results: Object.values(messagesByConversation),
      pagination: {
        total: totalMessages,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(totalMessages / limitNum)
      }
    });

  } catch (error) {
    console.error('Search messages error:', error);
    res.status(500).json({
      error: 'Internal server error during search'
    });
  }
};

// Search users
const searchUsers = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const { query, page = 1, limit = 20 } = req.query;

    if (!query || query.trim().length < 1) {
      return res.status(400).json({
        error: 'Search query is required'
      });
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Search criteria
    const searchCriteria = {
      $and: [
        { _id: { $ne: currentUserId } }, // Exclude current user
        { isActive: true }, // Only active users
        {
          $or: [
            { username: { $regex: query, $options: 'i' } },
            { firstName: { $regex: query, $options: 'i' } },
            { lastName: { $regex: query, $options: 'i' } },
            { email: { $regex: query, $options: 'i' } }
          ]
        }
      ]
    };

    // Get total count
    const totalUsers = await User.countDocuments(searchCriteria);

    // Search users
    const users = await User.find(searchCriteria)
      .select('username firstName lastName avatar bio status lastSeen')
      .sort({ username: 1 })
      .skip(skip)
      .limit(limitNum);

    // Check if current user has conversations with these users
    const usersWithConversationStatus = await Promise.all(
      users.map(async (user) => {
        const existingConversation = await Conversation.findOne({
          participants: { $all: [currentUserId, user._id] },
          isGroup: false
        });

        return {
          ...user.toObject(),
          hasConversation: !!existingConversation,
          conversationId: existingConversation?._id || null
        };
      })
    );

    res.json({
      query,
      users: usersWithConversationStatus,
      pagination: {
        total: totalUsers,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(totalUsers / limitNum)
      }
    });

  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({
      error: 'Internal server error during user search'
    });
  }
};

// Search conversations
const searchConversations = async (req, res) => {
  try {
    const userId = req.user._id;
    const { query, page = 1, limit = 20 } = req.query;

    if (!query || query.trim().length < 1) {
      return res.status(400).json({
        error: 'Search query is required'
      });
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Search in user's conversations
    const searchCriteria = {
      participants: userId,
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { 'groupSettings.description': { $regex: query, $options: 'i' } }
      ]
    };

    // Get total count
    const totalConversations = await Conversation.countDocuments(searchCriteria);

    // Search conversations
    const conversations = await Conversation.find(searchCriteria)
      .populate('participants', 'username firstName lastName avatar')
      .populate('lastMessage', 'content createdAt sender')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limitNum);

    // Format conversations for response
    const formattedConversations = conversations.map(conv => {
      let displayName = conv.name;
      
      // For direct conversations, use other participant's name
      if (!conv.isGroup && conv.participants.length === 2) {
        const otherParticipant = conv.participants.find(
          p => p._id.toString() !== userId.toString()
        );
        displayName = otherParticipant ? 
          (otherParticipant.firstName && otherParticipant.lastName ? 
            `${otherParticipant.firstName} ${otherParticipant.lastName}` : 
            otherParticipant.username) : 'Unknown User';
      }

      return {
        _id: conv._id,
        name: displayName,
        isGroup: conv.isGroup,
        participants: conv.participants,
        lastMessage: conv.lastMessage,
        updatedAt: conv.updatedAt,
        avatar: conv.groupSettings?.avatar || null
      };
    });

    res.json({
      query,
      conversations: formattedConversations,
      pagination: {
        total: totalConversations,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(totalConversations / limitNum)
      }
    });

  } catch (error) {
    console.error('Search conversations error:', error);
    res.status(500).json({
      error: 'Internal server error during conversation search'
    });
  }
};

// Global search (messages, users, conversations)
const globalSearch = async (req, res) => {
  try {
    const { query, limit = 5 } = req.query;

    if (!query || query.trim().length < 1) {
      return res.status(400).json({
        error: 'Search query is required'
      });
    }

    const limitNum = parseInt(limit);

    // Search in parallel
    const [messagesResult, usersResult, conversationsResult] = await Promise.all([
      // Search messages
      searchMessages({ ...req, query: { ...req.query, limit: limitNum } }, { json: () => {} }),
      // Search users  
      searchUsers({ ...req, query: { ...req.query, limit: limitNum } }, { json: () => {} }),
      // Search conversations
      searchConversations({ ...req, query: { ...req.query, limit: limitNum } }, { json: () => {} })
    ]);

    res.json({
      query,
      results: {
        messages: messagesResult?.results || [],
        users: usersResult?.users || [],
        conversations: conversationsResult?.conversations || []
      }
    });

  } catch (error) {
    console.error('Global search error:', error);
    res.status(500).json({
      error: 'Internal server error during global search'
    });
  }
};

module.exports = {
  searchMessages,
  searchUsers,
  searchConversations,
  globalSearch
};
