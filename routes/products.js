// routes/products.js
const express = require('express');
const router = express.Router();
const db = require('../db');

// جلب تفاصيل منتج معين مع باقاته/خياراته
// GET /api/products/:slug
router.get('/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    // 1. جلب بيانات المنتج الأساسية
    const productQuery = await db.query(
      'SELECT * FROM products WHERE slug = $1 AND is_active = TRUE', 
      [slug]
    );

    if (productQuery.rows.length === 0) {
      return res.status(404).json({ message: 'الخدمة أو المنتج غير موجود' });
    }

    const product = productQuery.rows[0];

    // 2. جلب باقات المنتج (Variants)
    const variantsQuery = await db.query(
      'SELECT id, variant_name, price, stock_qty FROM product_variants WHERE product_id = $1',
      [product.id]
    );

    // إرفاق الباقات مع استجابة المنتج
    product.variants = variantsQuery.rows;

    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'حدث خطأ في الخادم' });
  }
});

module.exports = router;