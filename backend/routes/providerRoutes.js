// backend/routes/providerRoutes.js
const express = require('express');
const router = express.Router();
const providerController = require('../controllers/providerController');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// تأمين جميع المسارات والتأكد من رتبة المزود
router.use(authenticateToken);
router.use(authorizeRoles('PROVIDER'));

router.get('/dashboard-data', providerController.getProviderDashboardData);
router.get('/services', providerController.getProviderServices);
router.get('/categories', providerController.getCategories);

// مسار إنشاء خدمة جديدة مدمج به الـ Middleware المخصص لرفع الصور
router.post('/services', upload.single('image'), providerController.createService);
router.delete('/services/:id', providerController.deleteService);

router.post('/withdraw', providerController.requestWithdrawal);

module.exports = router;