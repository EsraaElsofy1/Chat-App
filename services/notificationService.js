const User = require('../models/user');
const Message = require('../models/message');
const Conversation = require('../models/Conversation');

class NotificationService {
  constructor(io) {
    this.io = io;
    this.onlineUsers = new Map(); // userId -> socketId
  }

  // Register user as online
  userOnline(userId, socketId) {
    this.onlineUsers.set(userId, socketId);
    this.broadcastUserStatus(userId, 'online');
  }

  // Register user as offline
  userOffline(userId) {
    this.onlineUsers.delete(userId);
    this.broadcastUserStatus(userId, 'offline');
  }

  // Broadcast user status to their contacts
  async broadcastUserStatus(userId, status) {
    try {
      // Find conversations where this user is a participant
      const conversations = await Conversation.find({
        participants: userId
      }).populate('participants', '_id');

      // Get all unique participants (contacts)
      const contacts = new Set();
      conversations.forEach(conv => {
        conv.participants.forEach(participant => {
          if (participant._id.toString() !== userId) {
            contacts.add(participant._id.toString());
          }
        });
      });

      // Send status update to online contacts
      contacts.forEach(contactId => {
        const contactSocketId = this.onlineUsers.get(contactId);
        if (contactSocketId) {
          this.io.to(contactSocketId).emit('user-status-update', {
            userId,
            status,
            timestamp: new Date()
          });
        }
      });

    } catch (error) {
      console.error('Error broadcasting user status:', error);
    }
  }

  // Send message notification
  async sendMessageNotification(message, conversationId) {
    try {
      const conversation = await Conversation.findById(conversationId)
        .populate('participants', '_id username firstName lastName avatar notifications');

      if (!conversation) return;

      const sender = await User.findById(message.sender)
        .select('username firstName lastName avatar');

      // Send notification to all participants except sender
      for (const participant of conversation.participants) {
        if (participant._id.toString() !== message.sender.toString()) {
          
          // Check if user wants notifications
          if (!participant.notifications?.messageNotifications) continue;

          const socketId = this.onlineUsers.get(participant._id.toString());
          
          if (socketId) {
            // User is online - send real-time notification
            this.io.to(socketId).emit('new-message-notification', {
              messageId: message._id,
              conversationId,
              sender: {
                id: sender._id,
                username: sender.username,
                fullName: sender.firstName && sender.lastName ? 
                  `${sender.firstName} ${sender.lastName}` : sender.username,
                avatar: sender.avatar
              },
              content: message.content || 'Sent an attachment',
              messageType: message.messageType,
              timestamp: message.createdAt,
              isGroup: conversation.isGroup
            });
          } else {
            // User is offline - store notification for later
            await this.storeOfflineNotification(participant._id, {
              type: 'message',
              messageId: message._id,
              conversationId,
              senderId: sender._id,
              senderName: sender.firstName && sender.lastName ? 
                `${sender.firstName} ${sender.lastName}` : sender.username,
              content: message.content || 'Sent an attachment',
              timestamp: message.createdAt
            });
          }
        }
      }

    } catch (error) {
      console.error('Error sending message notification:', error);
    }
  }

  // Send typing indicator
  sendTypingIndicator(conversationId, userId, isTyping) {
    this.io.to(conversationId).emit('typing-indicator', {
      userId,
      conversationId,
      isTyping,
      timestamp: new Date()
    });
  }

  // Send message read receipt
  async sendReadReceipt(messageId, userId, conversationId) {
    try {
      const message = await Message.findById(messageId);
      if (!message) return;

      // Add user to readBy array if not already there
      const alreadyRead = message.readBy.some(
        read => read.user.toString() === userId
      );

      if (!alreadyRead) {
        message.readBy.push({
          user: userId,
          readAt: new Date()
        });
        await message.save();
      }

      // Notify sender that message was read
      const senderSocketId = this.onlineUsers.get(message.sender.toString());
      if (senderSocketId && message.sender.toString() !== userId) {
        this.io.to(senderSocketId).emit('message-read', {
          messageId,
          conversationId,
          readBy: userId,
          timestamp: new Date()
        });
      }

    } catch (error) {
      console.error('Error sending read receipt:', error);
    }
  }

  // Store offline notification
  async storeOfflineNotification(userId, notification) {
    try {
      // This could be stored in database or Redis
      // For now, we'll just log it
      console.log(`Offline notification for user ${userId}:`, notification);
      
      // TODO: Implement database storage for offline notifications
      // You could create a Notification model and store these
      
    } catch (error) {
      console.error('Error storing offline notification:', error);
    }
  }

  // Get unread notifications for user
  async getUnreadNotifications(userId) {
    try {
      // TODO: Implement fetching from database
      // For now, return empty array
      return [];
      
    } catch (error) {
      console.error('Error getting unread notifications:', error);
      return [];
    }
  }

  // Send conversation update notification
  async sendConversationUpdate(conversationId, updateType, data) {
    try {
      const conversation = await Conversation.findById(conversationId)
        .populate('participants', '_id');

      if (!conversation) return;

      // Send update to all participants
      conversation.participants.forEach(participant => {
        const socketId = this.onlineUsers.get(participant._id.toString());
        if (socketId) {
          this.io.to(socketId).emit('conversation-update', {
            conversationId,
            type: updateType,
            data,
            timestamp: new Date()
          });
        }
      });

    } catch (error) {
      console.error('Error sending conversation update:', error);
    }
  }

  // Send user joined/left conversation notification
  async sendUserJoinedLeft(conversationId, userId, action) {
    try {
      const user = await User.findById(userId)
        .select('username firstName lastName avatar');
      
      const conversation = await Conversation.findById(conversationId)
        .populate('participants', '_id');

      if (!conversation || !user) return;

      const notification = {
        type: action, // 'joined' or 'left'
        conversationId,
        user: {
          id: user._id,
          username: user.username,
          fullName: user.firstName && user.lastName ? 
            `${user.firstName} ${user.lastName}` : user.username,
          avatar: user.avatar
        },
        timestamp: new Date()
      };

      // Send to all participants
      conversation.participants.forEach(participant => {
        const socketId = this.onlineUsers.get(participant._id.toString());
        if (socketId) {
          this.io.to(socketId).emit('user-conversation-update', notification);
        }
      });

    } catch (error) {
      console.error('Error sending user joined/left notification:', error);
    }
  }

  // Get online users count
  getOnlineUsersCount() {
    return this.onlineUsers.size;
  }

  // Get online users list
  getOnlineUsers() {
    return Array.from(this.onlineUsers.keys());
  }

  // Check if user is online
  isUserOnline(userId) {
    return this.onlineUsers.has(userId);
  }
}

module.exports = NotificationService;
