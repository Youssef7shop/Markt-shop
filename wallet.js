import { supabase, getCurrentUserSession, logSystemActivity } from './supabase.js';

let currentClientSession = null;

document.addEventListener('DOMContentLoaded', async () => {
    currentClientSession = await getCurrentUserSession();
    if (!currentClientSession) {
        window.location.href = 'login.html';
        return;
    }

    const userId = currentClientSession.auth.id;

    // تشغيل جلب الرصيد وكشف الحساب المالي آلياً عند الفتح
    await loadWalletBalanceAndTransactions(userId);

    // معالجة نموذج شحن الرصيد التجريبي الفوري
    const rechargeForm = document.getElementById('recharge-form');
    rechargeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const amountInput = document.getElementById('recharge-amount');
        const amount = Number(amountInput.value);

        if (amount <= 0) {
            alert('يرجى إدخال مبلغ شحن حقيقي وصحيح.');
            return;
        }

        await processAccountRecharge(userId, amount);
        amountInput.value = ''; // تصفير الحقل بعد الشحن الناجح
    });
});

// دالة موحدة لجلب الرصيد المالي وسجل المعاملات
async function loadWalletBalanceAndTransactions(userId) {
    const balanceDisplay = document.getElementById('wallet-balance-display');
    const txContainer = document.getElementById('transactions-container');

    try {
        // 1. جلب الرصيد الحالي من جدول wallets
        const { data: wallet, error: walletErr } = await supabase
            .from('wallets')
            .select('balance')
            .eq('user_id', userId)
            .single();

        if (walletErr) throw walletErr;
        
        const currentBalance = wallet ? wallet.balance : 0;
        balanceDisplay.textContent = `$${Number(currentBalance).toFixed(2)}`;

        // 2. جلب الحركات المالية (استيراد ذكي من جدول الفواتير/الطلبات وجدول الإيداعات إن وجد)
        // لتبسيط الهيكلية المسطحة، سنعتمد على دمج وعرض الطلبات التي اشتراها كمصروفات، وعمليات الإيداع المسجلة
        const { data: orders, error: ordersErr } = await supabase
            .from('orders')
            .select(`
                id, price, created_at, status,
                services ( title )
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (ordersErr) throw ordersErr;

        // سنقوم هنا بعرض العمليات بشكل زمني منسق
        if (!orders || orders.length === 0) {
            txContainer.innerHTML = `<div class="loading-spinner-box">لا توجد حركات مالية مسجلة في كشف حسابك حتى الآن.</div>`;
            return;
        }

        txContainer.innerHTML = '';
        orders.forEach(order => {
            const dateStr = new Date(order.created_at).toLocaleDateString('ar-EG', {
                year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            });

            const row = document.createElement('div');
            row.className = 'tx-item-row withdrawal'; // المشتريات تمثل خصم/سحب من الرصيد
            row.innerHTML = `
                <div class="tx-meta">
                    <span class="tx-title">شراء خدمة: ${order.services?.title || 'حل ذكي مخصص'}</span>
                    <span class="tx-date">${dateStr} • الحالة: ${translateStatus(order.status)}</span>
                </div>
                <div class="tx-amount withdrawal">-$${Number(order.price).toFixed(2)}</div>
            `;
            txContainer.appendChild(row);
        });

    } catch (err) {
        console.error(err);
        balanceDisplay.textContent = "$0.00";
        txContainer.innerHTML = `<div class="loading-spinner-box" style="color:var(--danger)">فشل تحديث البيانات المالية: ${err.message}</div>`;
    }
}

// دالة معالجة شحن الرصيد الفوري وتحديث الجدول السحابي
async function processAccountRecharge(userId, amount) {
    const btnSubmit = document.getElementById('btn-submit-recharge');
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> جاري الاتصال بالبوابة المالية...`;

    try {
        // جلب الرصيد الحالي للمحفظة أولاً لإجراء عملية الجمع الدقيقة
        const { data: wallet, error: fetchErr } = await supabase
            .from('wallets')
            .select('balance')
            .eq('user_id', userId)
            .single();

        if (fetchErr) throw fetchErr;

        const currentBalance = wallet ? wallet.balance : 0;
        const updatedBalance = currentBalance + amount;

        // تحديث الرصيد السحابي للمستخدم فوراً
        const { error: updateErr } = await supabase
            .from('wallets')
            .update({ balance: updatedBalance, updated_at: new Date().toISOString() })
            .eq('user_id', userId);

        if (updateErr) throw updateErr;

        await logSystemActivity(`User Recharged Wallet Account with $${amount}`);
        alert(`🎉 رائع! تم إيداع مبلغ $${amount.toFixed(2)} في محفظتك الرقمية بنجاح وتحديث كشف الحساب.`);
        
        // إعادة تحميل البيانات المالية لتعكس التحديث فوراً دون الحاجة لإعادة تحميل الصفحة بالكامل
        await loadWalletBalanceAndTransactions(userId);

    } catch (err) {
        alert("فشلت عملية الشحن التجريبية: " + err.message);
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = `<i class="fa-solid fa-credit-card"></i> تأكيد الإيداع التجريبي`;
    }
}

function translateStatus(status) {
    const mapping = { 'pending': 'معلق', 'processing': 'جاري العمل', 'completed': 'مكتمل', 'cancelled': 'مسترد' };
    return mapping[status] || status;
}