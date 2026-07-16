// backend/controllers/clientController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 1. جلب إحصائيات لوحة التحكم للعميل
exports.getClientDashboardData = async (req, res) => {
  const clientId = req.user.id;

  try {
    // جلب بيانات المحفظة
    const wallet = await prisma.wallet.findUnique({
      where: { userId: clientId }
    });

    // حساب إجمالي المدفوعات (العمليات المكتملة من نوع PAYMENT)
    const totalSpentResult = await prisma.transaction.aggregate({
      where: {
        walletId: wallet?.id,
        type: 'PAYMENT',
        status: 'COMPLETED'
      },
      _sum: {
        amount: true
      }
    });

    const totalSpent = totalSpentResult._sum.amount || 0.0;

    // حساب الطلبات النشطة والطلب المكتملة
    const activeOrdersCount = await prisma.order.count({
      where: {
        clientId: clientId,
        status: { in: ['PENDING', 'IN_PROGRESS'] }
      }
    });

    const completedOrdersCount = await prisma.order.count({
      where: {
        clientId: clientId,
        status: 'COMPLETED'
      }
    });

    // جلب آخر 5 طلبات مع تفاصيل الخدمة والمزود
    const recentOrders = await prisma.order.findMany({
      where: { clientId: clientId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        service: {
          select: { title: true, price: true }
        },
        provider: {
          include: {
            user: {
              select: { fullName: true }
            }
          }
        }
      }
    });

    res.status(200).json({
      success: true,
      data: {
        balance: wallet?.balance || 0.0,
        totalSpent,
        activeOrdersCount,
        completedOrdersCount,
        recentOrders
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'حدث خطأ أثناء جلب بيانات لوحة التحكم.' });
  }
};

// 2. جلب جميع طلبات العميل
exports.getClientOrders = async (req, res) => {
  const clientId = req.user.id;

  try {
    const orders = await prisma.order.findMany({
      where: { clientId: clientId },
      orderBy: { createdAt: 'desc' },
      include: {
        service: true,
        provider: {
          include: {
            user: {
              select: { fullName: true, avatarUrl: true }
            }
          }
        }
      }
    });

    res.status(200).json({ success: true, data: orders });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'حدث خطأ أثناء جلب الطلبات.' });
  }
};

// 3. جلب بيانات المحفظة والمعاملات
exports.getClientWalletData = async (req, res) => {
  const clientId = req.user.id;

  try {
    const wallet = await prisma.wallet.findUnique({
      where: { userId: clientId },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!wallet) {
      return res.status(404).json({ success: false, error: 'المحفظة غير موجودة.' });
    }

    res.status(200).json({ success: true, data: wallet });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'حدث خطأ أثناء جلب بيانات المحفظة.' });
  }
};

// 4. إيداع أموال في المحفظة (Simulated Deposit)
exports.depositFunds = async (req, res) => {
  const clientId = req.user.id;
  const { amount, paymentMethod } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ success: false, error: 'يرجى إدخال مبلغ صحيح للإيداع.' });
  }

  try {
    const wallet = await prisma.wallet.findUnique({
      where: { userId: clientId }
    });

    if (!wallet) {
      return res.status(404).json({ success: false, error: 'المحفظة غير موجودة.' });
    }

    // إجراء العملية داخل Transaction لضمان الأمان المالي والاتساق
    const updatedWallet = await prisma.$transaction(async (tx) => {
      // تحديث رصيد المحفظة
      const updated = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: parseFloat(amount) } }
      });

      // تسجيل المعاملة المالية
      await tx.transaction.create({
        data: {
          walletId: wallet.id,
          amount: parseFloat(amount),
          type: 'DEPOSIT',
          status: 'COMPLETED'
        }
      });

      // تسجيل النشاط الأمني
      await tx.activityLog.create({
        data: {
          userId: clientId,
          action: `DEPOSIT_FUNDS: ${amount} USD via ${paymentMethod || 'UNKNOWN'}`
        }
      });

      return updated;
    });

    res.status(200).json({
      success: true,
      message: 'تم شحن الرصيد بنجاح!',
      data: { balance: updatedWallet.balance }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'فشلت عملية الإيداع المالي.' });
  }
};