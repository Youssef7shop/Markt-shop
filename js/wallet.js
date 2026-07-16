// js/wallet.js
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('boostify_token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    const depositForm = document.getElementById('depositForm');
    const depositModalElement = document.getElementById('depositModal');
    const depositModal = new bootstrap.Modal(depositModalElement);

    // تفعيل تسجيل الخروج
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.clear();
        window.location.href = 'login.html';
    });

    // جلب وتهيئة بيانات المحفظة عند تحميل الصفحة
    async function fetchWalletDetails() {
        try {
            const response = await fetch('/api/client/wallet', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const resData = await response.json();
            if (!response.ok) throw new Error(resData.error);

            const wallet = resData.data;

            document.getElementById('walletBalance').textContent = `${wallet.balance.toFixed(2)} $`;

            // عرض تاريخ المعاملات
            const tbody = document.getElementById('transactionsTableBody');
            if (wallet.transactions.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" class="text-center py-5 text-muted">لا يوجد أي عمليات مسجلة في كشف حسابك حالياً.</td></tr>`;
                document.getElementById('lastDeposit').textContent = `0.00 $`;
                return;
            }

            tbody.innerHTML = wallet.transactions.map(tx => `
                <tr>
                    <td class="font-monospace text-muted small">#${tx.id.substring(0, 8)}</td>
                    <td class="fw-semibold text-white">${formatTxType(tx.type)}</td>
                    <td class="fw-bold ${tx.type === 'DEPOSIT' || tx.type === 'EARNING' ? 'text-success' : 'text-danger'}">
                        ${tx.type === 'DEPOSIT' || tx.type === 'EARNING' ? '+' : '-'}${tx.amount.toFixed(2)} $
                    </td>
                    <td class="text-muted small">${new Date(tx.createdAt).toLocaleString('ar-EG')}</td>
                    <td><span class="status-badge ${tx.status === 'COMPLETED' ? 'status-completed' : 'status-pending'}">${tx.status === 'COMPLETED' ? 'مكتملة' : 'معلقة'}</span></td>
                </tr>
            `).join('');

            // تحديد آخر دفعة مدخلة بنجاح
            const lastDep = wallet.transactions.find(tx => tx.type === 'DEPOSIT' && tx.status === 'COMPLETED');
            document.getElementById('lastDeposit').textContent = lastDep ? `${lastDep.amount.toFixed(2)} $` : `0.00 $`;

        } catch (err) {
            console.error('Error fetching wallet:', err);
        }
    }

    // إرسال طلب الشحن
    depositForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const amount = document.getElementById('depositAmount').value;
        const paymentMethod = document.getElementById('paymentMethod').value;
        const btnConfirm = document.getElementById('btnConfirmDeposit');

        btnConfirm.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> جاري الدفع...`;
        btnConfirm.setAttribute('disabled', 'true');

        try {
            const response = await fetch('/api/client/wallet/deposit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ amount, paymentMethod })
            });

            const resData = await response.json();
            if (!response.ok) throw new Error(resData.error);

            // إعادة تعيين وتحديث الواجهة الفورية
            depositForm.reset();
            depositModal.hide();
            await fetchWalletDetails();

        } catch (err) {
            alert(err.message);
        } finally {
            btnConfirm.innerHTML = `إتِمام الدفع`;
            btnConfirm.removeAttribute('disabled');
        }
    });

    function formatTxType(type) {
        switch (type) {
            case 'DEPOSIT': return 'عملية شحن رصيد';
            case 'WITHDRAW': return 'سحب نقدي خارج السيرفر';
            case 'PAYMENT': return 'دفع قيمة خدمة رقمية';
            case 'REFUND': return 'استرداد مالي لمشروع ملغي';
            default: return 'معاملة مالية عامة';
        }
    }

    // التنفيذ الفوري عند فتح الشاشة
    await fetchWalletDetails();
});