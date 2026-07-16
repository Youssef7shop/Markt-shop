// backend/controllers/chatController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 1. جلب المحادثات السابقة بين مستخدمين
exports.getChatHistory = async (req, res) => {
  const { otherUserId } = req.params;
  const currentUserId = req.user.id;

  try {
    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: currentUserId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: currentUserId }
        ]
      },
      orderBy: { createdAt: 'asc' }
    });

    res.status(200).json({ success: true, data: messages });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'فشل جلب سجل المحادثة.' });
  }
};

// 2. جلب قائمة جهات الاتصال النشطة (الأشخاص الذين تمت مراسلتهم)
exports.getActiveChats = async (req, res) => {
  const currentUserId = req.user.id;

  try {
    // جلب كافة الرسائل التي تخص المستخدم
    const messages = await prisma.message.findMany({
      where: {
        OR: [{ senderId: currentUserId }, { receiverId: currentUserId }]
      },
      include: {
        sender: { select: { id: true, fullName: true, role: true } },
        receiver: { select: { id: true, fullName: true, role: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    // استخراج جهات اتصال فريدة مع الحفاظ على آخر رسالة
    const contactsMap = new Map();
    for (const msg of messages) {
      const otherUser = msg.senderId === currentUserId ? msg.receiver : msg.sender;
      if (!contactsMap.has(otherUser.id)) {
        contactsMap.set(otherUser.id, {
          user: otherUser,
          lastMessage: msg.content,
          lastMessageTime: msg.createdAt,
          unreadCount: msg.receiverId === currentUserId && !msg.isRead ? 1 : 0
        });
      } else if (msg.receiverId === currentUserId && !msg.isRead) {
        contactsMap.get(otherUser.id).unreadCount += 1;
      }
    }

    res.status(200).json({ success: true, data: Array.from(contactsMap.values()) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'فشل جلب جهات الاتصال.' });
  }
};