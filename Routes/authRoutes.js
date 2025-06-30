const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { authenticateToken, rateLimitAuth } = require("../middleware/auth");
const {
  validateRegister,
  validateLogin,
  validateUpdateProfile,
  validateChangePassword
} = require("../middleware/validation");

// Apply rate limiting to auth routes
router.use(rateLimitAuth(5, 15 * 60 * 1000)); // 5 attempts per 15 minutes

// Public routes
router.post("/register", validateRegister, authController.register);
router.post("/login", validateLogin, authController.login);

// Protected routes (require authentication)
router.post("/logout", authenticateToken, authController.logout);
router.get("/profile", authenticateToken, authController.getProfile);
router.put("/profile", authenticateToken, validateUpdateProfile, authController.updateProfile);
router.put("/change-password", authenticateToken, validateChangePassword, authController.changePassword);

// Route to verify token (useful for frontend)
router.get("/verify", authenticateToken, (req, res) => {
  res.json({
    valid: true,
    user: {
      id: req.user._id,
      username: req.user.username,
      email: req.user.email,
      firstName: req.user.firstName,
      lastName: req.user.lastName,
      fullName: req.user.fullName,
      avatar: req.user.avatar,
      status: req.user.status
    }
  });
});

module.exports = router;
