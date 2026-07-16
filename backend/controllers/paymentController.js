// backend/controllers/paymentController.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 1. إنشاء جلسة الدفع لإيداع الأموال (Stripe Checkout Session)
exports.createDepositSession = async (req, res) => {
  const { amount } = req.body; // المبلغ بالدولار الأمريكي (USD) مثلاً: 50
  const userId = req.user.id;

  if (!amount || amount <= 0) {
    return res.status(400).json({ success: false, error: 'يرجى تحديد قيمة شحن صالحة أكبر من صفر.' });
  }

  try {
    // إنشاء جلسة دفع مشفرة بداخل Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'شحن رصيد المحفظة - Boostify AI',
              description: `إيداع آمن لمبلغ بقيمة $${amount} في رصيد حسابك الترويجي`,
            },
            unit_amount: Math.round(amount * 100), // القيمة بالسنت (Stripe يتعامل بأصغر وحدة نقدية)
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}/pages/dashboard.html?payment=success`,
      cancel_url: `${process.env.FRONTEND_URL}/pages/dashboard.html?payment=cancel`,
      // تمرير البيانات المخصصة (Metadata) لربط العملية بالمستخدم عند تأكيد الدفع
      metadata: {
        userId: userId,
        amount: amount.toString()
      }
    });

    res.status(200).json({ success: true, url: session.url });
  } catch (err) {
    console.error('Stripe Session Error:', err);
    res.status(500).json({ success: false, error: 'فشل تهيئة بوابة الدفع الإلكتروني حالياً.' });
  }
};

// 2. معالج الـ Webhook الفوري للتحقق من سلامة الدفع وتغذية المحفظة
exports.handleStripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // التحقق الفوري من توقيع الحدث لضمان أن الطلب مرسل من Stripe حصراً وليس من طرف خارجي
    event = stripe.webhooks.constructEvent(
      req.body, // يجب تزويد الدالة بـ RAW Buffer الخاص بالجسم لضمان سلامة التوقيع
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error(`❌ خطأ أمني في توقيع الويب هوك: ${err.message}`);
    return res.status(400).send(`Webhook Signature Verification Failed: ${err.message}`);
  }

  // الاستماع لحدث اكتمال عملية الدفع بنجاح
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata.userId;
    const amount = parseFloat(session.metadata.amount);

    console.log(`💸 دفع ناجح مكتشف! جاري شحن حساب العضو: ${userId} بمبلغ: ${amount} USD`);

    try {
      // شحن الرصيد وتسجيل المعاملة المعتمدة في قاعدة البيانات بخطوة واحدة محصنة (Atomicity)
      await prisma.$transaction(async (tx) => {
        // أ. البحث عن محفظة العضو أو تكوين واحدة جديدة له
        let wallet = await tx.wallet.findUnique({
          where: { userId: userId }
        });

        if (!wallet) {
          wallet = await tx.wallet.create({
            data: { userId: userId, balance: 0.0 }
          });
        }

        // ب. تحديث الرصيد وإضافة القيمة الجديدة
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: { increment: amount } }
        });

        // ج. تدوين الفاتورة المالية بجدول المعاملات لتدقيق الحسابات
        await tx.transaction.create({
          data: {
            walletId: wallet.id,
            amount: amount,
            type: 'DEPOSIT', // نوع العملية: إيداع
            status: 'COMPLETED',
            description: `إيداع وتغذية آلية للمحفظة عبر بوابة Stripe الإلكترونية`
          }
        });

        // د. تسجيل التغيير المالي كحدث أمني
        await tx.activityLog.create({
          data: {
            userId: userId,
            action: `DEPOSIT_STRIPE: Wallet credited with $${amount} successfully.`
          }
        });
      });

      console.log(`✅ تمت عملية تغذية الرصيد وتسجيل المعاملة بنجاح في قاعدة البيانات.`);
    } catch (dbErr) {
      console.error('❌ تضارب مالي! فشل إتمام معاملة تغذية الرصيد في قاعدة البيانات:', dbErr);
      return res.status(500).json({ error: 'حدث خطأ غير متوقع في معالجة الحساب الداخلي.' });
    }
  }

  // إرسال رد فوري لـ Stripe لتأكيد استلام الحدث بنجاح
  res.status(200).json({ received: true });
};