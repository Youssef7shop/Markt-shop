// backend/sockets/chatSocket.js
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// خريطة لتتبع السوكيتات النشطة لكل مستخدم
const activeUsers = new Map(); // key: userId, value: socketId

module.exports = (io) => {
  // استخدام Middleware للتحقق من هوية المستخدم قبل قبوله في السيرفر
  io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers['authorization'];
    if (!token) {
      return next(new Error('Authentication error: Token missing'));
    }
    try {
      const cleanedToken = token.startsWith('Bearer ') ? token.slice(7) : token;
      const decoded = jwt.verify(cleanedToken, process.env.JWT_SECRET);
      socket.user = decoded; // حفظ بيانات المستخدم داخل السوكيت
      next();
    } catch (err) {
      return next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user.id;
    activeUsers.set(userId, socket.id);
    console.log(`⚡ مستخدم متصل بالدردشة: ${socket.user.fullName} (${socket.id})`);

    // 1. الانضمام لغرفة محادثة ثنائية فريدة (Private Chat Room)
    socket.on('join_chat', ({ receiverId }) => {
      // توليد اسم غرفة فريد بدمج معرّفات الطرفين أبجدياً لضمان دخولهما نفس الغرفة دائماً
      const roomName = [userId, receiverId].sort().join('_');
      socket.join(roomName);
    });

    // 2. إرسال وحفظ الرسالة الفورية
    socket.on('send_message', async ({ receiverId, content }) => {
      const roomName = [userId, receiverId].sort().join('_');

      try {
        // حفظ الرسالة فورياً بداخل قاعدة بيانات PostgreSQL
        const newMessage = await prisma.message.create({
          data: {
            senderId: userId,
            receiverId: receiverId,
            content: content
          }
        });

        // بث الرسالة الفورية لجميع المتواجدين في الغرفة المشتركة
        io.to(roomName).emit('receive_message', newMessage);

        // إرسال إشعار فوري خارج الغرفة للطرف المستلم (إذا كان متصلاً بالإنترنت) لتحديث واجهاته
        const receiverSocketId = activeUsers.get(receiverId);
        if (receiverSocketId) {
          socket.to(receiverSocketId).emit('new_message_notification', {
            senderId: userId,
            senderName: socket.user.fullName,
            content: content
          });
        }
      } catch (err) {
        console.error('فشل حفظ وإرسال الرسالة السريعة:', err);
      }
    });

    // 3. تتبع مؤشر الكتابة التفاعلية (Typing Indicator)
    socket.on('typing', ({ receiverId, isTyping }) => {
      const roomName = [userId, receiverId].sort().join('_');
      // إبلاغ الطرف الآخر فقط داخل الغرفة بحالة الكتابة
      socket.to(roomName).emit('user_typing', { senderId: userId, isTyping });
    });

    // 4. تحديث مؤشر القراءة الفوري (Seen Receipt)
    socket.on('mark_seen', async ({ senderId }) => {
      const roomName = [userId, senderId].sort().join('_');

      try {
        // تحديث حالة الرسائل غير المقروءة في قاعدة البيانات لتصبح مقروءة
        await prisma.message.updateMany({
          where: {
            senderId: senderId,
            receiverId: userId,
            isRead: false
          },
          data: { isRead: true }
        });

        // إشعار الطرف الآخر فوراً بأن رسائله قد تم قراءتها لتحديث واجهته
        socket.to(roomName).emit('messages_seen', { seenBy: userId });
      } catch (err) {
        console.error('فشل معالجة مؤشر القراءة:', err);
      }
    });

    // عند انقطاع الاتصال
    socket.on('disconnect', () => {
      activeUsers.delete(userId);
      console.log(`🔌 قطع الاتصال للمستخدم: ${socket.user.fullName}`);
    });
  });
};