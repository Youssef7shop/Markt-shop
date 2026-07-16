// backend/controllers/adminController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 1. جلب الإحصائيات العامة للمنصة
exports.getAdminStats = async (req, res) => {
  try {
    const totalUsers = await prisma.user.count();
    const totalProviders = await prisma.provider.count();
    const pendingWithdrawals = await prisma.withdrawRequest.count({
      where: { status: 'PENDING' }
    });

    // حساب إجمالي حجم التداول المالي بالمنصة (المبيعات المكتملة)
    const salesVolumeResult = await prisma.transaction.aggregate({
      where: { type: 'EARNING', status: 'COMPLETED' },
      _sum: { amount: true }
    });
    const totalVolume = salesVolumeResult._sum.amount || 0.0;

    res.status(200).json({
      success: true,
      data: {
        totalUsers,
        totalProviders,
        pendingWithdrawals,
        totalVolume
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'فشل جلب إحصائيات الإدارة.' });
  }
};

// 2. جلب قائمة المستخدمين مع ميزة تغيير الحالة أو الرتبة
exports.getUsersList = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        wallet: { select: { balance: true } }
      }
    });
    res.status(200).json({ success: true, data: users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'فشل جلب قائمة المستخدمين.' });
  }
};

// 3. تعديل حالة حساب المستخدم (تجميد / تنشيط الحساب)
exports.toggleUserStatus = async (req, res) => {
  const { userId } = req.params;
  const { isActive } = req.body;

  try {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { isActive: Boolean(isActive) }
    });

    // تسجيل العملية أمنياً
    await prisma.activityLog.create({
      data: {
        userId: req.user.id,
        action: `TOGGLE_USER_STATUS: User #${userId} active set to ${isActive}`
      }
    });

    res.status(200).json({
      success: true,
      message: `تم تحديث حالة المستخدم بنجاح إلى: ${isActive ? 'نشط' : 'مجمد'}`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'فشل تعديل حالة الحساب.' });
  }
};

// 4. جلب طلبات السحب المعلقة والمنتهية
exports.getWithdrawRequests = async (req, res) => {
  try {
    const requests = await prisma.withdrawRequest.findMany({
      include: {
        provider: {
          include: {
            user: { select: { fullName: true, email: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json({ success: true, data: requests });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'فشل جلب طلبات السحب.' });
  }
};

// 5. معالجة طلب سحب الأرباح (تأكيد أو رفض مع استرجاع الرصيد آلياً)
exports.processWithdrawRequest = async (req, res) => {
  const { requestId } = req.params;
  const { action } = req.body; // 'APPROVE' أو 'REJECT'

  try {
    const request = await prisma.withdrawRequest.findUnique({
      where: { id: requestId },
      include: { provider: true }
    });

    if (!request) {
      return res.status(404).json({ success: false, error: 'طلب السحب غير موجود.' });
    }

    if (request.status !== 'PENDING') {
      return res.status(400).json({ success: false, error: 'تمت معالجة هذا الطلب مسبقاً.' });
    }

    // جلب محفظة مقدم الخدمة بناءً على الـ userId المرتبط به
    const wallet = await prisma.wallet.findUnique({
      where: { userId: request.provider.userId }
    });

    await prisma.$transaction(async (tx) => {
      if (action === 'APPROVE') {
        // 1. تحديث حالة طلب السحب
        await tx.withdrawRequest.update({
          where: { id: requestId },
          data: { status: 'APPROVED' }
        });

        // 2. تحديث سجل المعاملات المالية المتربط بالسحب المعلق
        await tx.transaction.updateMany({
          where: {
            walletId: wallet.id,
            amount: request.amount,
            type: 'WITHDRAW',
            status: 'PENDING'
          },
          data: { status: 'COMPLETED' }
        });

      } else if (action === 'REJECT') {
        // 1. تحديث حالة طلب السحب إلى مرفوض
        await tx.withdrawRequest.update({
          where: { id: requestId },
          data: { status: 'REJECTED' }
        });

        // 2. تحديث المعاملة المالية لملغية
        await tx.transaction.updateMany({
          where: {
            walletId: wallet.id,
            amount: request.amount,
            type: 'WITHDRAW',
            status: 'PENDING'
          },
          data: { status: 'CANCELLED' }
        });

        // 3. إعادة الأموال مجدداً إلى رصيد المزود في محفظته بحركة واحدة آمنة
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: { increment: request.amount } }
        });
      }

      // 4. تدوين الحدث الأمني
      await tx.activityLog.create({
        data: {
          userId: req.user.id,
          action: `DECISION_WITHDRAW: Request #${requestId} is ${action}D for amount ${request.amount} USD`
        }
      });
    });

    res.status(200).json({
      success: true,
      message: `تم معالجة الطلب بـ (${action === 'APPROVE' ? 'الموافقة والإرسال' : 'الرفض وإعادة الرصيد'}) بنجاح.`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'حدث خطأ غير متوقع أثناء معالجة الطلب المالي.' });
  }
};

// 6. جلب سجل النشاطات لمراقبة حركة المسؤولين والمستخدمين (Audit Trail)
exports.getActivityLogs = async (req, res) => {
  try {
    const logs = await prisma.activityLog.findMany({
      include: {
        user: { select: { fullName: true, role: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 100 // جلب آخر 100 نشاط أمني بالمنصة
    });
    res.status(200).json({ success: true, data: logs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'فشل جلب سجلات النشاط الأمني.' });
  }
};