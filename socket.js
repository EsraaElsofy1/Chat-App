const Message = require("./models/message");
const Conversation = require("./models/Conversation");
const User = require("./models/user");
const NotificationService = require("./services/notificationService");

const messageRateLimit = new Map(); // Track message sending timestamps for rate limiting
let notificationService; // Will be initialized when io is available

const handleSocketConnection = (io) => {
  // Initialize notification service
  notificationService = new NotificationService(io);

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);
    let currentUserId = null;

    // User authentication and online status
    socket.on("authenticate", async (data) => {
      try {
        const { userId, token } = data;

        // TODO: Verify JWT token here
        // For now, we'll trust the userId

        currentUserId = userId;
        socket.userId = userId;

        // Update user status to online
        await User.findByIdAndUpdate(userId, {
          status: "online",
          lastSeen: new Date()
        });

        // Register user as online
        notificationService.userOnline(userId, socket.id);

        socket.emit("authenticated", { success: true });

      } catch (error) {
        console.error("Authentication error:", error);
        socket.emit("authentication-error", { message: "Authentication failed" });
      }
    });

    // Notify others when a user comes online (legacy support)
    socket.on("user-online", async (userId) => {
      try {
        currentUserId = userId;
        socket.userId = userId;

        await User.findByIdAndUpdate(userId, {
          status: "online",
          lastSeen: new Date()
        });

        notificationService.userOnline(userId, socket.id);

      } catch (error) {
        console.error("User online error:", error);
      }
    });

    // Join a conversation and fetch recent messages
    socket.on("join-conversation", async ({ conversationId, userId }) => {
      try {
        // Verify user is participant in conversation
        const conversation = await Conversation.findById(conversationId);
        if (!conversation || !conversation.participants.includes(userId)) {
          return socket.emit("error", { message: "Access denied to conversation" });
        }

        socket.join(conversationId);
        console.log(`User ${userId} joined conversation: ${conversationId}`);

        // Fetch recent messages (last 50)
        const messages = await Message.find({ conversation: conversationId })
          .sort({ createdAt: -1 })
          .limit(50)
          .populate("sender", "username firstName lastName avatar")
          .populate("replyTo", "content sender");

        socket.emit("conversation-messages", {
          conversationId,
          messages: messages.reverse() // Reverse to show chronological order
        });

        // Mark messages as delivered
        await Message.updateMany(
          {
            conversation: conversationId,
            sender: { $ne: userId },
            "deliveredTo.user": { $ne: userId }
          },
          {
            $addToSet: {
              deliveredTo: {
                user: userId,
                deliveredAt: new Date()
              }
            }
          }
        );

      } catch (error) {
        console.error("Error joining conversation:", error);
        socket.emit("error", { message: "Failed to join conversation" });
      }
    });

    // Leave conversation
    socket.on("leave-conversation", ({ conversationId, userId }) => {
      socket.leave(conversationId);
      console.log(`User ${userId} left conversation: ${conversationId}`);
    });

    // Typing indicators with improved handling
    socket.on("typing", ({ conversationId, userId }) => {
      if (notificationService) {
        notificationService.sendTypingIndicator(conversationId, userId, true);
      }
    });

    socket.on("stop-typing", ({ conversationId, userId }) => {
      if (notificationService) {
        notificationService.sendTypingIndicator(conversationId, userId, false);
      }
    });

    // Mark messages as read
    socket.on("mark-messages-read", async ({ conversationId, messageIds, userId }) => {
      try {
        for (const messageId of messageIds) {
          if (notificationService) {
            await notificationService.sendReadReceipt(messageId, userId, conversationId);
          }
        }
      } catch (error) {
        console.error("Error marking messages as read:", error);
      }
    });

    // Handle sending a message (enhanced)
    socket.on("send-message", async ({ conversationId, sender, content, messageType, replyTo, attachments }) => {
      const now = Date.now();

      // Rate Limiting: Prevent sending more than one message every 1 second
      if (messageRateLimit.has(sender) && now - messageRateLimit.get(sender) < 1000) {
        return socket.emit("error", { message: "You are sending messages too quickly!" });
      }

      // Update the last sent timestamp
      messageRateLimit.set(sender, now);

      try {
        // Verify user is participant in conversation
        const conversation = await Conversation.findById(conversationId);
        if (!conversation || !conversation.participants.includes(sender)) {
          return socket.emit("error", { message: "Access denied to conversation" });
        }

        // Validate message content
        if (!content?.trim() && (!attachments || attachments.length === 0)) {
          return socket.emit("error", { message: "Message cannot be empty" });
        }

        // Create a new message
        const newMessage = await new Message({
          conversation: conversationId,
          sender,
          content: content || "",
          messageType: messageType || "text",
          replyTo: replyTo || null,
          attachments: attachments || []
        }).save();

        // Update conversation's last message
        conversation.lastMessage = newMessage._id;
        await conversation.save();

        // Populate sender details
        await newMessage.populate("sender", "username firstName lastName avatar");
        if (replyTo) {
          await newMessage.populate("replyTo", "content sender");
        }

        // Send the message to all users in the conversation room
        io.to(conversationId).emit("receive-message", newMessage);

        // Send notifications to offline users
        if (notificationService) {
          await notificationService.sendMessageNotification(newMessage, conversationId);
        }

        // Acknowledge message sent
        socket.emit("message-sent", {
          tempId: newMessage.tempId, // If frontend sends tempId
          messageId: newMessage._id,
          timestamp: newMessage.createdAt
        });

      } catch (error) {
        console.error("Error sending message:", error);
        socket.emit("error", { message: "Failed to send message" });
      }
    });

    // Handle message reactions
    socket.on("add-reaction", async ({ messageId, emoji, userId }) => {
      try {
        const message = await Message.findById(messageId);
        if (!message) {
          return socket.emit("error", { message: "Message not found" });
        }

        // Add reaction using the model method
        await message.addReaction(userId, emoji);

        // Broadcast reaction to conversation participants
        io.to(message.conversation.toString()).emit("message-reaction-added", {
          messageId,
          userId,
          emoji,
          timestamp: new Date()
        });

      } catch (error) {
        console.error("Error adding reaction:", error);
        socket.emit("error", { message: "Failed to add reaction" });
      }
    });

    socket.on("remove-reaction", async ({ messageId, userId }) => {
      try {
        const message = await Message.findById(messageId);
        if (!message) {
          return socket.emit("error", { message: "Message not found" });
        }

        // Remove reaction using the model method
        await message.removeReaction(userId);

        // Broadcast reaction removal to conversation participants
        io.to(message.conversation.toString()).emit("message-reaction-removed", {
          messageId,
          userId,
          timestamp: new Date()
        });

      } catch (error) {
        console.error("Error removing reaction:", error);
        socket.emit("error", { message: "Failed to remove reaction" });
      }
    });

    // Handle user disconnection and notify others
    socket.on("disconnect", async () => {
      console.log("Client disconnected:", socket.id);

      if (currentUserId || socket.userId) {
        const userId = currentUserId || socket.userId;

        try {
          // Update user status to offline
          await User.findByIdAndUpdate(userId, {
            status: "offline",
            lastSeen: new Date()
          });

          // Remove user from online users
          if (notificationService) {
            notificationService.userOffline(userId);
          }

          console.log(`User ${userId} went offline`);

        } catch (error) {
          console.error("Error handling user disconnect:", error);
        }
      }

      // Remove the user from all joined rooms
      socket.rooms.forEach((room) => socket.leave(room));
    });

    // Handle errors
    socket.on("error", (error) => {
      console.error("Socket error:", error);
    });
  });
};

module.exports = { handleSocketConnection };
