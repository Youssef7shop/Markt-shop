// backend/routes/chatRoutes.js
const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.use(authenticateToken);

router.get('/history/:otherUserId', chatController.getChatHistory);
router.get('/contacts', chatController.getActiveChats);

module.exports = router;