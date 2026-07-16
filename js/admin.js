// js/admin.js
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('boostify_token');
    const userStr = localStorage.getItem('boostify_user');

    // تأمين الدخول بالواجهة الأمامية
    if (!token || !userStr) {
        window.location.href = 'login.html';
        return;
    }

    const adminUser = JSON.parse(userStr);
    if (adminUser.role !== 'ADMIN') {
        alert('وصول مرفوض! هذه الصفحة مخصصة لمدراء الإدارة العليا فقط.');
        window.location.href = 'dashboard.html';
        return;
    }

    document.getElementById('adminName').textContent = adminUser.fullName;

    // زر الخروج الآمن
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.clear();
        window.location.href = 'login.html';
    });

    // 1. جلب وعرض الإحصائيات الفورية الكلية
    async function loadAdminStats() {
        try {
            const response = await fetch('/api/admin/stats', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const res = await response.json();
            if (!response.ok) throw new Error(res.error);

            document.getElementById('statTotalUsers').textContent = res.data.totalUsers;
            document.getElementById('statTotalProviders').textContent = res.data.totalProviders;
            document.getElementById('statPendingWithdrawals').textContent = res.data.pendingWithdrawals;
            document.getElementById('statTotalVolume').textContent = `${res.data.totalVolume.toFixed(2)} $`;
        } catch (err) {
            console.error('Stats Error:', err);
        }
    }

    // 2. جلب وإدارة حسابات الأعضاء بالمنصة
    async function loadUsers() {
        try {
            const response = await fetch('/api/admin/users', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const res = await response.json();
            const tbody = document.getElementById('usersTableBody');

            if (res.data.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">لا يوجد مستخدمين مسجلين بالمنصة حالياً.</td></tr>`;
                return;
            }

            tbody.innerHTML = res.data.map(u => `
                <tr>
                    <td><span class="fw-semibold text-white">${u.fullName}</span></td>
                    <td><span class="text-muted small">${u.email}</span></td>
                    <td><span class="badge ${u.role === 'ADMIN' ? 'bg-warning text-dark' : u.role === 'PROVIDER' ? 'bg-info' : 'bg-secondary'}">${u.role}</span></td>
                    <td class="fw-bold text-success">${u.wallet ? u.wallet.balance.toFixed(2) : '0.00'} $</td>
                    <td class="text-muted small">${new Date(u.createdAt).toLocaleDateString('ar-EG')}</td>
                    <td>
                        <span class="badge ${u.isActive ? 'bg-success' : 'bg-danger'}">
                            ${u.isActive ? 'نشط' : 'مجمد'}
                        </span>
                    </td>
                    <td>
                        ${u.id === adminUser.id ? '<span class="text-muted small">حسابك الحالي</span>' : `
                        <button class="btn btn-sm ${u.isActive ? 'btn-outline-danger' : 'btn-outline-success'} btn-toggle-status" data-id="${u.id}" data-active="${u.isActive}">
                            ${u.isActive ? '<i class="fa-solid fa-user-slash me-1"></i> تجميد' : '<i class="fa-solid fa-user-check me-1"></i> تنشيط'}
                        </button>
                        `}
                    </td>
                </tr>
            `).join('');

            // تفعيل أزرار تجميد/تنشيط الحسابات
            document.querySelectorAll('.btn-toggle-status').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const uId = btn.getAttribute('data-id');
                    const currentActive = btn.getAttribute('data-active') === 'true';
                    if (confirm(`هل أنت متأكد من رغبتك في ${currentActive ? 'تجميد ودفع حساب العضو للاستبعاد المؤقت؟' : 'تنشيط حساب العضو وإتاحته مجدداً بالمنصة؟'}`)) {
                        await toggleUserStatus(uId, !currentActive);
                    }
                });
            });

        } catch (err) {
            console.error('Users Loading Error:', err);
        }
    }

    async function toggleUserStatus(userId, newStatus) {
        try {
            const response = await fetch(`/api/admin/users/${userId}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ isActive: newStatus })
            });
            const res = await response.json();
            if (!response.ok) throw new Error(res.error);

            await loadUsers();
            await loadAdminStats();
        } catch (err) {
            alert(err.message);
        }
    }

    // 3. جلب ومعالجة طلبات تحويل الأرباح
    async function loadWithdrawRequests() {
        try {
            const response = await fetch('/api/admin/withdrawals', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const res = await response.json();
            const tbody = document.getElementById('withdrawTableBody');

            if (res.data.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">لا توجد طلبات سحب مسجلة بالمنصة حالياً.</td></tr>`;
                return;
            }

            tbody.innerHTML = res.data.map(req => `
                <tr>
                    <td><span class="fw-semibold text-white">${req.provider.user.fullName}</span></td>
                    <td><span class="text-muted small">${req.provider.user.email}</span></td>
                    <td class="fw-bold text-success">${req.amount.toFixed(2)} $</td>
                    <td class="text-muted small">${new Date(req.createdAt).toLocaleDateString('ar-EG')}</td>
                    <td><span class="status-badge ${getWithdrawStatusClass(req.status)}">${formatWithdrawStatus(req.status)}</span></td>
                    <td>
                        ${req.status === 'PENDING' ? `
                        <div class="d-flex gap-2">
                            <button class="btn btn-sm btn-success btn-process" data-id="${req.id}" data-action="APPROVE"><i class="fa-solid fa-circle-check"></i> تأكيد وصرف</button>
                            <button class="btn btn-sm btn-danger btn-process" data-id="${req.id}" data-action="REJECT"><i class="fa-solid fa-circle-xmark"></i> رفض</button>
                        </div>
                        ` : `<span class="text-muted small">مكتمل ومعالج</span>`}
                    </td>
                </tr>
            `).join('');

            // تفعيل أزرار معالجة سحوبات الرصيد
            document.querySelectorAll('.btn-process').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const reqId = btn.getAttribute('data-id');
                    const action = btn.getAttribute('data-action');
                    const msg = action === 'APPROVE' 
                        ? 'هل قمت بتحويل المبلغ بالفعل وتود تأكيد وصرف المعاملة من رصيد الحساب رسمياً؟'
                        : 'هل تود رفض طلب سحب الأرباح هذا وإعادة القيمة المحجوزة تلقائياً لمحفظة المزود؟';

                    if (confirm(msg)) {
                        await processWithdrawal(reqId, action);
                    }
                });
            });

        } catch (err) {
            console.error('Withdrawals Loading Error:', err);
        }
    }

    async function processWithdrawal(requestId, action) {
        try {
            const response = await fetch(`/api/admin/withdrawals/${requestId}/process`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ action })
            });
            const res = await response.json();
            if (!response.ok) throw new Error(res.error);

            alert(res.message);
            await loadWithdrawRequests();
            await loadAdminStats();
        } catch (err) {
            alert(err.message);
        }
    }

    // 4. جلب سجلات النشاط الأمني والتدقيق
    async function loadActivityLogs() {
        try {
            const response = await fetch('/api/admin/logs', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const res = await response.json();
            const tbody = document.getElementById('logsTableBody');

            if (res.data.length === 0) {
                tbody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-muted">لا تتوفر أي سجلات للأنشطة الأمنية حالياً.</td></tr>`;
                return;
            }

            tbody.innerHTML = res.data.map(log => `
                <tr>
                    <td><span class="fw-semibold text-white">${log.user ? log.user.fullName : 'نظام غير معروف'}</span></td>
                    <td><span class="badge bg-dark border border-secondary">${log.user ? log.user.role : 'SYSTEM'}</span></td>
                    <td><code class="log-row-text text-warning">${log.action}</code></td>
                    <td class="text-muted small">${new Date(log.createdAt).toLocaleString('ar-EG')}</td>
                </tr>
            `).join('');
        } catch (err) {
            console.error('Logs Loading Error:', err);
        }
    }

    function getWithdrawStatusClass(status) {
        switch (status) {
            case 'PENDING': return 'status-pending';
            case 'APPROVED': return 'status-completed';
            case 'REJECTED': return 'status-cancelled';
            default: return '';
        }
    }

    function formatWithdrawStatus(status) {
        switch (status) {
            case 'PENDING': return 'بانتظار التحويل المالي والتدقيق';
            case 'APPROVED': return 'مكتمل ومصروف';
            case 'REJECTED': return 'مرفوض من الإدارة';
            default: return status;
        }
    }

    // التنفيذ الفوري لتحميل البيانات بمجرد تشغيل لوحة الإدارة
    await loadAdminStats();
    await loadUsers();
    await loadWithdrawRequests();
    await loadActivityLogs();
});