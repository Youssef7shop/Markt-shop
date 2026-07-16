// backend/routes/clientRoutes.js
const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

// جميع هذه المسارات تتطلب تسجيل الدخول وأن يكون المستخدم عميلاً (CLIENT)
router.use(authenticateToken);
router.use(authorizeRoles('CLIENT'));

router.get('/dashboard-data', clientController.getClientDashboardData);
router.get('/orders', clientController.getClientOrders);
router.get('/wallet', clientController.getClientWalletData);
router.post('/wallet/deposit', clientController.depositFunds);

module.exports = router;