// استدعاء مباشر من نفس مستوى المجلد
import { supabase, getCurrentUserSession } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    const sessionData = await getCurrentUserSession();
    if (!sessionData) {
        window.location.href = 'login.html';
        return;
    }

    // تحديث بيانات الترويسة العلوية للمستخدم الحالي
    document.getElementById('client-name').textContent = sessionData.profile.full_name;
    if (sessionData.profile.avatar_url) {
        document.getElementById('client-avatar').src = sessionData.profile.avatar_url;
    }

    // تحميل ومزامنة البيانات الحية من جدول PostgreSQL
    await loadClientDashboardData(sessionData.auth.id);
});

async function loadClientDashboardData(clientId) {
    const tbody = document.getElementById('client-orders-tbody');
    
    try {
        const { data: orders, error } = await supabase
            .from('orders')
            .select(`
                id, price, status, created_at,
                services ( title ),
                providers:provider_id ( users ( full_name ) )
            `)
            .eq('user_id', clientId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (orders) {
            document.getElementById('stat-total-orders').textContent = orders.length;
            
            const pending = orders.filter(o => o.status === 'pending' || o.status === 'processing').length;
            document.getElementById('stat-pending-orders').textContent = pending;

            const totalSpent = orders.reduce((sum, o) => sum + Number(o.price || 0), 0);
            document.getElementById('stat-total-spent').textContent = `$${totalSpent.toFixed(2)}`;
        }

        if (!orders || orders.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="loading-cell">لم تقم بشراء أي خدمات ذكية حتى الآن.</td></tr>`;
            return;
        }

        tbody.innerHTML = '';
        orders.forEach(order => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>#${order.id.substring(0, 8)}</td>
                <td style="font-weight:600;">${order.services?.title || 'خدمة مخصصة'}</td>
                <td>${order.providers?.users?.full_name || 'خبير مجهول'}</td>
                <td style="color:var(--success); font-weight:bold;">$${Number(order.price).toFixed(2)}</td>
                <td><span class="status-badge ${order.status}">${translateStatus(order.status)}</span></td>
                <td><a href="order-details.html?id=${order.id}" class="btn-action-view">تفاصيل <i class="fa-solid fa-chevron-left"></i></a></td>
            `;
            tbody.appendChild(tr);
        });

    } catch (err) {
        console.error(err);
        tbody.innerHTML = `<tr><td colspan="6" class="loading-cell" style="color:var(--danger)">خطأ أثناء الاتصال بقاعدة البيانات: ${err.message}</td></tr>`;
    }
}

function translateStatus(status) {
    const mapping = { 'pending': 'قيد الانتظار', 'processing': 'جاري العمل', 'completed': 'مكتمل', 'cancelled': 'ملغي' };
    return mapping[status] || status;
}