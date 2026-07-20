// middleware/auth.js
const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ message: 'عذراً، التوثيق مطلوب للوصول' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretkey');
    req.user = decoded; // إرفاق بيانات المستخدم بالطلب
    next();
  } catch (err) {
    res.status(401).json({ message: 'رمز التوثيق غير صالحة أو منتهي الصلاحية' });
  }
};