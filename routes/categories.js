// routes/categories.js
const express = require('express');
const router = express.Router();
const db = require('../db');

// جلب جميع التصنيفات
// GET /api/categories
router.get('/', async (req, res) => {
  try {
    const categories = await db.query('SELECT * FROM categories ORDER BY sort_order ASC');
    res.json(categories.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'حدث خطأ في الخادم أثناء جلب التصنيفات' });
  }
});

// جلب المنتجات التابعة لتصنيف معين
// GET /api/categories/:slug/products
router.get('/:slug/products', async (req, res) => {
  try {
    const { slug } = req.params;
    
    // البحث عن معرّف التصنيف
    const categoryQuery = await db.query('SELECT id, name FROM categories WHERE slug = $1', [slug]);
    
    if (categoryQuery.rows.length === 0) {
      return res.status(404).json({ message: 'التصنيف غير موجود' });
    }

    const categoryId = categoryQuery.rows[0].id;

    // جلب المنتجات النشطة فقط
    const products = await db.query(
      'SELECT * FROM products WHERE category_id = $1 AND is_active = TRUE ORDER BY created_at DESC',
      [categoryId]
    );

    res.json({
      category: categoryQuery.rows[0].name,
      products: products.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'حدث خطأ في الخادم' });
  }
});

module.exports = router;