const express = require("express");
const mongoose = require("mongoose");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const connectDB = require("./db");
// import routes
const authRoutes = require("./Routes/authRoutes");
const messageRoutes = require("./Routes/messageRoutes");
const conversationRoutes = require("./Routes/conversationRoutes");

const { handleSocketConnection } = require("./socket");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());
//route section
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/conversations", conversationRoutes);

connectDB();

// تشغيل WebSocketsChat
handleSocketConnection(io);

server.listen(5000, () => {
  console.log(" Server running at http://localhost:5000");
});
