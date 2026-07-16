// backend/routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticateToken } = require('../middleware/authMiddleware');

// 1. مسار إنشاء جلسة الدفع (محمي بتوكين العضو لحفظ الأمان)
router.post('/create-deposit', authenticateToken, express.json(), paymentController.createDepositSession);

// 2. مسار استقبال إشعارات الدفع الفوري (مفتوح ومؤمن داخلياً عبر تشفير توقيع Stripe)
router.post('/webhook', express.raw({ type: 'application/json' }), paymentController.handleStripeWebhook);

module.exports = router;