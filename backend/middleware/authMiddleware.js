// backend/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, error: 'غير مصرح لك بالوصول، يرجى تسجيل الدخول.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_key');
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: { role: true }
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'المستخدم غير موجود بالنظام.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(403).json({ success: false, error: 'جلسة العمل منتهية أو التوكن غير صالح.' });
  }
};

// التحقق من صلاحيات الوصول بناءً على رتبة المستخدم
exports.authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({ success: false, error: 'لا تمتلك الصلاحيات الكافية للوصول.' });
    }

    if (!allowedRoles.includes(req.user.role.name)) {
      return res.status(403).json({ success: false, error: 'تم رفض الوصول، لا تمتلك الصلاحية المطلوبة.' });
    }

    next();
  };
};