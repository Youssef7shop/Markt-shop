// js/orders.js
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('boostify_token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    // تفعيل الخروج
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.clear();
        window.location.href = 'login.html';
    });

    try {
        const response = await fetch('/api/client/orders', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const resData = await response.json();
        if (!response.ok) throw new Error(resData.error);

        const orders = resData.data;
        const tbody = document.getElementById('ordersTableBody');

        if (orders.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-5 text-muted">لا يوجد أي طلب مسجل باسمك في النظام حالياً.</td></tr>`;
            return;
        }

        tbody.innerHTML = orders.map(order => `
            <tr>
                <td class="font-monospace text-muted small">#${order.id.substring(0, 8)}</td>
                <td><span class="fw-semibold text-white">${order.service.title}</span></td>
                <td>
                    <div class="d-flex align-items-center gap-2">
                        <img src="${order.provider.user.avatarUrl || 'https://via.placeholder.com/150'}" class="rounded-circle" style="width:28px; height:28px; object-fit:cover;">
                        <span>${order.provider.user.fullName}</span>
                    </div>
                </td>
                <td class="fw-bold text-success">${order.price.toFixed(2)} $</td>
                <td><span class="status-badge ${getStatusClass(order.status)}">${formatStatus(order.status)}</span></td>
                <td class="text-muted small">${new Date(order.createdAt).toLocaleDateString('ar-EG')}</td>
                <td>
                    <a href="service-details.html?id=${order.service.id}" class="btn btn-sm btn-outline-light"><i class="fa-solid fa-circle-info"></i> عرض</a>
                </td>
            </tr>
        `).join('');

    } catch (err) {
        console.error(err);
    }
});

function getStatusClass(status) {
    switch (status) {
        case 'PENDING': return 'status-pending';
        case 'IN_PROGRESS': return 'status-progress';
        case 'COMPLETED': return 'status-completed';
        default: return 'status-cancelled';
    }
}

function formatStatus(status) {
    switch (status) {
        case 'PENDING': return 'بانتظار الموافقة';
        case 'IN_PROGRESS': return 'جاري العمل';
        case 'COMPLETED': return 'مكتمل ومستلم';
        default: return 'تم الإلغاء';
    }
}