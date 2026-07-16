// backend/controllers/providerController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 1. جلب إحصائيات لوحة المزود
exports.getProviderDashboardData = async (req, res) => {
  const userId = req.user.id;

  try {
    const provider = await prisma.provider.findUnique({
      where: { userId }
    });

    if (!provider) {
      return res.status(404).json({ success: false, error: 'لم يتم العثور على حساب مقدم الخدمة.' });
    }

    // جلب محفظة المستخدم لمعرفة الرصيد القابل للسحب
    const wallet = await prisma.wallet.findUnique({
      where: { userId }
    });

    // حساب إجمالي الأرباح المستلمة (العمليات المكتملة من نوع EARNING)
    const totalEarningsResult = await prisma.transaction.aggregate({
      where: {
        walletId: wallet?.id,
        type: 'EARNING',
        status: 'COMPLETED'
      },
      _sum: { amount: true }
    });
    const totalEarnings = totalEarningsResult._sum.amount || 0.0;

    // حساب عدد الخدمات النشطة المنشورة
    const servicesCount = await prisma.service.count({
      where: { providerId: provider.id }
    });

    // حساب الطلبات النشطة (المباعة قيد العمل)
    const activeSalesCount = await prisma.order.count({
      where: {
        providerId: provider.id,
        status: { in: ['PENDING', 'IN_PROGRESS'] }
      }
    });

    // جلب المبيعات الأخيرة مع تفاصيل المشتري والخدمة
    const recentSales = await prisma.order.findMany({
      where: { providerId: provider.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        service: { select: { title: true, price: true } },
        client: { select: { fullName: true, avatarUrl: true } }
      }
    });

    res.status(200).json({
      success: true,
      data: {
        balance: wallet?.balance || 0.0,
        totalEarnings,
        servicesCount,
        activeSalesCount,
        recentSales
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'حدث خطأ أثناء جلب بيانات لوحة المزود.' });
  }
};

// 2. جلب جميع خدمات المزود الحالي
exports.getProviderServices = async (req, res) => {
  const userId = req.user.id;

  try {
    const provider = await prisma.provider.findUnique({ where: { userId } });
    if (!provider) {
      return res.status(404).json({ success: false, error: 'مقدم الخدمة غير موجود.' });
    }

    const services = await prisma.service.findMany({
      where: { providerId: provider.id },
      include: { category: { select: { name: true } } },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json({ success: true, data: services });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'حدث خطأ أثناء جلب قائمة الخدمات.' });
  }
};

// 3. إنشاء خدمة رقمية جديدة مع إمكانية رفع صورة غلاف
exports.createService = async (req, res) => {
  const userId = req.user.id;
  const { title, description, price, deliveryTime, categoryId } = req.body;

  if (!title || !description || !price || !deliveryTime || !categoryId) {
    return res.status(400).json({ success: false, error: 'يرجى تزويدنا بكافة الحقول الأساسية للخدمة.' });
  }

  try {
    const provider = await prisma.provider.findUnique({ where: { userId } });
    if (!provider) {
      return res.status(404).json({ success: false, error: 'عذراً، لم يتم العثور على حساب المزود الخاص بك.' });
    }

    // تحديد مسار الصورة المرفوعة إن وجدت
    let imageUrl = null;
    if (req.file) {
      imageUrl = `/uploads/services/${req.file.filename}`;
    }

    const newService = await prisma.service.create({
      data: {
        title,
        description,
        price: parseFloat(price),
        deliveryTime: parseInt(deliveryTime),
        categoryId,
        providerId: provider.id,
        imageUrl
      }
    });

    res.status(201).json({
      success: true,
      message: 'تم نشر خدمتك الرقمية الجديدة بنجاح وهي معروضة للجمهور الآن!',
      data: newService
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'حدث خطأ أثناء محاولة إنشاء الخدمة.' });
  }
};

// 4. حذف خدمة رقمية
exports.deleteService = async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  try {
    const provider = await prisma.provider.findUnique({ where: { userId } });
    const service = await prisma.service.findFirst({
      where: { id, providerId: provider?.id }
    });

    if (!service) {
      return res.status(404).json({ success: false, error: 'الخدمة غير موجودة أو لا تملك صلاحية حذفها.' });
    }

    await prisma.service.delete({ where: { id } });

    res.status(200).json({ success: true, message: 'تم حذف الخدمة الرقمية بنجاح من المنصة.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'فشل حذف الخدمة، قد تكون مرتبطة بطلبات نشطة.' });
  }
};

// 5. جلب تصنيفات الخدمات (لتعبئة حقل الاختيار بالواجهة)
exports.getCategories = async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' }
    });
    res.status(200).json({ success: true, data: categories });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'فشل جلب التصنيفات.' });
  }
};

// 6. طلب سحب الأرباح
exports.requestWithdrawal = async (req, res) => {
  const userId = req.user.id;
  const { amount } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ success: false, error: 'يرجى إدخال مبلغ صحيح لطلب السحب.' });
  }

  try {
    const provider = await prisma.provider.findUnique({ where: { userId } });
    const wallet = await prisma.wallet.findUnique({ where: { userId } });

    if (!provider || !wallet) {
      return res.status(404).json({ success: false, error: 'الحساب المالي غير متوفر.' });
    }

    if (wallet.balance < parseFloat(amount)) {
      return res.status(400).json({ success: false, error: 'رصيدك الحالي غير كافٍ لإتمام عملية السحب المطلوبة.' });
    }

    // السحب الآمن عبر عملية Transaction
    await prisma.$transaction(async (tx) => {
      // 1. خصم الرصيد من المحفظة
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: parseFloat(amount) } }
      });

      // 2. إنشاء المعاملة المالية (سحب معلق بانتظار موافقة الإدارة)
      const transaction = await tx.transaction.create({
        data: {
          walletId: wallet.id,
          amount: parseFloat(amount),
          type: 'WITHDRAW',
          status: 'PENDING'
        }
      });

      // 3. إنشاء طلب سحب لمراجعته من لوحة التحكم الخاصة بالمسؤولين (Admin)
      await tx.withdrawRequest.create({
        data: {
          providerId: provider.id,
          amount: parseFloat(amount),
          status: 'PENDING'
        }
      });

      // 4. تسجيل العملية في سجل التدقيق الأمني
      await tx.activityLog.create({
        data: {
          userId,
          action: `WITHDRAW_REQUESTED: ${amount} USD (Transaction #${transaction.id})`
        }
      });
    });

    res.status(200).json({
      success: true,
      message: 'تم إرسال طلب السحب بنجاح! سيقوم فريق المالية بالتحقق منه وتحويل الأموال خلال 24 ساعة.'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'فشل تسجيل طلب سحب الأرباح.' });
  }
};