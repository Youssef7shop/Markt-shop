// backend/routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

// تأمين كامل مسارات الإدارة لمدراء المنصة فقط
router.use(authenticateToken);
router.use(authorizeRoles('ADMIN'));

router.get('/stats', adminController.getAdminStats);
router.get('/users', adminController.getUsersList);
router.put('/users/:userId/status', adminController.toggleUserStatus);

router.get('/withdrawals', adminController.getWithdrawRequests);
router.post('/withdrawals/:requestId/process', adminController.processWithdrawRequest);

router.get('/logs', adminController.getActivityLogs);

module.exports = router;