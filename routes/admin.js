// routes/admin.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const authMiddleware = require('../middleware/auth');

// Middleware للتحقق من صلاحيات المدير
const adminMiddleware = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'صلاحيات وصول مرفوضة. هذه المنطقة مخصصة للإدارة فقط.' });
  }
  next();
};

// 1. إضافة منتج / خدمة جديدة
// POST /api/admin/products
router.post('/products', [authMiddleware, adminMiddleware], async (req, res) => {
  const { name, slug, description, category_id, price, stock_type } = req.body;

  try {
    const newProduct = await db.query(
      `INSERT INTO products (name, slug, description, category_id, price, stock_type)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, slug, description, category_id, price, stock_type]
    );
    res.status(201).json({ 
      message: 'تمت إضافة الخدمة بنجاح', 
      product: newProduct.rows[0] 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'حدث خطأ أثناء إضافة الخدمة' });
  }
});

module.exports = router;