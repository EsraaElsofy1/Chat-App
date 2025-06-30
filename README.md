# 💬 Professional Chat App

A modern, real-time chat application built with Node.js, Socket.io, MongoDB, and vanilla JavaScript. Features include user authentication, file uploads, message reactions, typing indicators, and much more.

## ✨ Features

### 🔐 Authentication & Security
- JWT-based authentication
- Password hashing with bcrypt
- Rate limiting for API endpoints
- Input validation and sanitization
- Account lockout after failed attempts
- Secure file upload with type validation

### 💬 Real-time Messaging
- Instant message delivery with Socket.io
- Typing indicators
- Message read receipts
- Message reactions (like, love, etc.)
- Reply to messages
- Forward messages
- Pin important messages
- Message editing and deletion

### 📁 File Sharing
- Upload images, videos, audio files, and documents
- Automatic image compression and thumbnail generation
- Support for multiple file formats
- File size limits and validation
- Secure file storage

### 👥 User Management
- User profiles with avatars
- Online/offline status
- Last seen timestamps
- User search functionality
- Block/unblock users
- Privacy settings

### 🔍 Advanced Search
- Search messages across conversations
- Search users by name or email
- Search conversations
- Global search functionality
- Pagination support

### 🎨 Modern UI/UX
- Responsive design for all devices
- Clean and intuitive interface
- Dark/light theme support
- Smooth animations and transitions
- Professional design patterns

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (v4.4 or higher)
- npm or yarn

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd chat-app
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
Edit `.env` file with your configuration:
```env
# Database
MONGODB_URI=mongodb://127.0.0.1:27017/chat-app

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

# Server
PORT=5000
NODE_ENV=development

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads

# CORS
CORS_ORIGIN=http://localhost:3000
```

4. **Start MongoDB**
Make sure MongoDB is running on your system.

5. **Run the application**
```bash
# Development mode
npm run dev

# Production mode
npm start
```

6. **Open your browser**
Navigate to `http://localhost:5000`

## 📚 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update profile
- `PUT /api/auth/change-password` - Change password

### Messages
- `POST /api/messages/send` - Send message
- `GET /api/messages/:user1/:user2` - Get messages between users
- `PUT /api/messages/:messageId/edit` - Edit message
- `DELETE /api/messages/:messageId/unsend` - Unsend message
- `POST /api/messages/:messageId/reaction` - Add reaction

### File Upload
- `POST /api/upload/files` - Upload multiple files
- `POST /api/upload/avatar` - Upload avatar
- `GET /api/upload/stats` - Get upload statistics

### Search
- `GET /api/search/messages` - Search messages
- `GET /api/search/users` - Search users
- `GET /api/search/conversations` - Search conversations
- `GET /api/search/global` - Global search

## 🏗️ Project Structure

```
chat-app/
├── controllers/           # Request handlers
├── middleware/           # Custom middleware
├── models/              # Database models
├── Routes/              # API routes
├── services/            # Business logic
├── uploads/             # File storage
├── app.js              # Express app setup
├── socket.js           # Socket.io configuration
├── db.js               # Database connection
├── index.html          # Frontend interface
└── .env                # Environment variables
```

## 🔧 Technologies Used

- **Backend**: Node.js, Express.js
- **Database**: MongoDB, Mongoose
- **Real-time**: Socket.io
- **Authentication**: JWT, bcrypt
- **File Upload**: Multer, Sharp
- **Validation**: express-validator
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)

## 🚀 Deployment

### Using PM2
```bash
npm install -g pm2
pm2 start app.js --name "chat-app"
pm2 startup
pm2 save
```

### Environment Variables for Production
```env
NODE_ENV=production
JWT_SECRET=your-production-secret-key
MONGODB_URI=your-production-mongodb-uri
PORT=5000
```

## 📱 Features Overview

✅ **Completed Features:**
- User registration and authentication
- Real-time messaging with Socket.io
- File upload system (images, videos, documents)
- Message reactions and replies
- Typing indicators
- User search functionality
- Professional UI/UX design
- Input validation and security
- Image processing and thumbnails

🚧 **Future Enhancements:**
- Group chat management
- Voice and video calls
- Message encryption
- Push notifications
- Mobile app (React Native)
- Admin dashboard
- Message scheduling
- Chat themes customization

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

---

**Made with ❤️ for modern communication**