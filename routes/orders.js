// routes/orders.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../middleware/auth');

// 1. إنشاء طلب جديد (Checkout)
// POST /api/orders
router.post('/', authMiddleware, async (req, res) => {
  // الكائن items يحتوي على: product_id, variant_id, quantity, target_link, price
  const { items, payment_method } = req.body; 
  const userId = req.user.id;

  try {
    // إنشاء رقم طلب مميز
    const orderNumber = 'ORD-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    
    // حساب الإجمالي (ملاحظة أمنية: في بيئة الإنتاج يجب استدعاء السعر من قاعدة البيانات لمنع التلاعب)
    const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // إدخال الطلب الرئيسي في جدول الطلبات
    const newOrder = await db.query(
      `INSERT INTO orders (user_id, order_number, total_amount, payment_method)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [userId, orderNumber, totalAmount, payment_method]
    );

    const orderId = newOrder.rows[0].id;

    // إدخال عناصر الطلب (الباقات والروابط المستهدفة)
    for (let item of items) {
      await db.query(
        `INSERT INTO order_items (order_id, product_id, variant_id, target_link, quantity, price)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [orderId, item.product_id, item.variant_id, item.target_link, item.quantity, item.price]
      );
    }

    res.status(201).json({
      message: 'تم استلام طلبك بنجاح',
      order_number: orderNumber,
      order_id: orderId
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'حدث خطأ أثناء معالجة الطلب' });
  }
});

// 2. جلب جميع الطلبات الخاصة بالمستخدم للوحة التحكم الخاصة به
// GET /api/user/orders
router.get('/user', authMiddleware, async (req, res) => {
  try {
    const orders = await db.query(
      'SELECT id, order_number, total_amount, payment_status, order_status, created_at FROM orders WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(orders.rows);
  } catch (err) {
    res.status(500).json({ message: 'حدث خطأ في الخادم' });
  }
});

module.exports = router;