// backend/server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');

const app = express();
const server = http.createServer(app);

// إعداد Socket.IO
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || '*',
    methods: ['GET', 'POST']
  }
});

// إعدادات الحماية والأمان
app.use(helmet()); // حماية هيدرز المتصفح
app.use(cors({ origin: process.env.CLIENT_URL || '*' }));
app.use(express.json()); // تحليل طلبات JSON
app.use(express.urlencoded({ extended: true }));

// تحديد معدل الطلبات لحماية السيرفر من هجمات الـ DDoS
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 دقيقة
  max: 100, // حد أقصى 100 طلب من نفس الـ IP
  message: { error: 'لقد تجاوزت الحد الأقصى من الطلبات المسموح بها، يرجى المحاولة لاحقاً.' }
});
app.use('/api/', limiter);

// توجيه المسارات (API Routes)
app.use('/api/auth', authRoutes);

// برمجية إدارة أخطاء السيرفر (Global Error Handler)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: 'حدث خطأ داخلي في الخادم، يرجى التواصل مع الدعم الفني.'
  });
});

// تفعيل اتصالات Socket.IO الفورية
io.on('connection', (socket) => {
  console.log(`مستخدم متصل: ${socket.id}`);

  socket.on('join_conversation', (conversationId) => {
    socket.join(conversationId);
  });

  socket.on('typing', ({ conversationId, userId }) => {
    socket.to(conversationId).emit('user_typing', { userId });
  });

  socket.on('disconnect', () => {
    console.log(`انقطع اتصال المستخدم: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server is running in production mode on port ${PORT}`);
});
app.use('/api/provider', require('./routes/providerRoutes'));
app.use('/uploads', express.static('uploads'));
app.use('/api/admin', require('./routes/adminRoutes'));
// في ملف backend/server.js الرئيسي

// 1. تسجيل مسارات الدفع (حيث يتمتع مسار الـ Webhook بمحلل خام خاص به)
const paymentRoutes = require('./routes/paymentRoutes');
app.use('/api/payments', paymentRoutes);

// 2. بعد ذلك، يمكنك تفعيل المحلل العام لـ JSON لبقية المسارات الأخرى بأمان دون تداخل
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ... باقي المسارات والروابط العامة والـ Sockets