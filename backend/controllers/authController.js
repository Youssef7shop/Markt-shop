// backend/controllers/authController.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

// تسجيل حساب جديد
exports.register = async (req, res) => {
  const { email, password, fullName, roleName } = req.body;

  if (!email || !password || !fullName || !roleName) {
    return res.status(400).json({ success: false, error: 'يرجى ملء جميع الحقول المطلوبة.' });
  }

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ success: false, error: 'البريد الإلكتروني مسجل بالفعل.' });
    }

    // جلب الـ Role المقابل للاسم المرسل
    const role = await prisma.role.findUnique({ where: { name: roleName.toUpperCase() } });
    if (!role) {
      return res.status(400).json({ success: false, error: 'الرتبة المحددة غير صالحة.' });
    }

    // تشفير كلمة المرور (الأمان العالي)
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // إنشاء الحساب داخل معاملة (Transaction) لضمان اتساق البيانات وإنشاء المحفظة فوراً
    const result = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email,
          passwordHash,
          fullName,
          roleId: role.id
        }
      });

      // إنشاء المحفظة الإلكترونية المرتبطة بالمستخدم تلقائياً
      await tx.wallet.create({
        data: {
          userId: newUser.id,
          balance: 0.0
        }
      });

      // إذا كان مقدم خدمة، ننشئ له سجل في جدول الـ Provider
      if (role.name === 'PROVIDER') {
        await tx.provider.create({
          data: {
            userId: newUser.id,
            isApproved: false
          }
        });
      }

      return newUser;
    });

    res.status(201).json({
      success: true,
      message: 'تم إنشاء الحساب بنجاح، ومحفظتك الإلكترونية جاهزة للاستخدام.'
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'حدث خطأ أثناء عملية التسجيل.' });
  }
};

// تسجيل الدخول
exports.login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'يرجى إدخال البريد الإلكتروني وكلمة المرور.' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { role: true }
    });

    if (!user) {
      return res.status(401).json({ success: false, error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.status(401).json({ success: false, error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' });
    }

    // توليد توكن الـ JWT الآمن بصلاحية 24 ساعة
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role.name },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // تسجيل العملية في سجل النشاطات (Security Audit Log)
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'USER_LOGIN',
        ipAddress: req.ip
      }
    });

    res.status(200).json({
      success: true,
      message: 'تم تسجيل الدخول بنجاح.',
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role.name
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'حدث خطأ داخلي أثناء محاولة تسجيل الدخول.' });
  }
};