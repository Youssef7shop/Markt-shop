// routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');
const authMiddleware = require('../middleware/auth');

// 1. إنشاء حساب جديد (Register)
router.post('/register', async (req, res) => {
  const { name, email, phone, password } = req.body;

  try {
    // التحقق من وجود المستخدم سابقاً
    const userExists = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ message: 'البريد الإلكتروني مُسجّل بالفعل' });
    }

    // تشفير كلمة المرور
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // إضافة المستخدم لقاعدة البيانات
    const newUser = await db.query(
      `INSERT INTO users (name, email, phone, password_hash) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, name, email, role, wallet_balance`,
      [name, email, phone, passwordHash]
    );

    const user = newUser.rows[0];

    // إنتاج توكن JWT
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET || 'supersecretkey',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'تم إنشاء الحساب بنجاح',
      token,
      user,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'حدث خطأ في الخادم' });
  }
});

// 2. تسجيل الدخول (Login)
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
    }

    const user = result.rows[0];

    // مطابقة كلمة المرور
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
    }

    // إنتاج توكن JWT
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET || 'supersecretkey',
      { expiresIn: '7d' }
    );

    res.json({
      message: 'تم تسجيل الدخول بنجاح',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        wallet_balance: user.wallet_balance,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'حدث خطأ في الخادم' });
  }
});

// 3. جلب بيانات البروفايل الحالي (Protected)
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await db.query(
      'SELECT id, name, email, phone, role, wallet_balance FROM users WHERE id = $1',
      [req.user.id]
    );
    res.json(user.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'حدث خطأ في الخادم' });
  }
});

module.exports = router;