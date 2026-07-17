import { supabase, getCurrentUserSession } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    const sessionData = await getCurrentUserSession();
    if (!sessionData) {
        window.location.href = 'login.html';
        return;
    }

    await loadUserOrdersArchive(sessionData.auth.id);
});

async function loadUserOrdersArchive(userId) {
    const container = document.getElementById('orders-list-container');
    
    try {
        const { data: orders, error } = await supabase
            .from('orders')
            .select(`
                id, price, status, created_at,
                services ( title )
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!orders || orders.length === 0) {
            container.innerHTML = `<div class="loading-box">لم تقم بإجراء أي طلبات شراء للخدمات حتى الآن.</div>`;
            return;
        }

        container.innerHTML = '';
        orders.forEach(order => {
            const formattedDate = new Date(order.created_at).toLocaleDateString('ar-EG', {
                year: 'numeric', month: 'long', day: 'numeric'
            });

            const row = document.createElement('div');
            row.className = 'order-item-row';
            row.innerHTML = `
                <div class="order-meta-info">
                    <h5>${order.services?.title || 'خدمة مخصصة'}</h5>
                    <span class="order-date-lbl"><i class="fa-solid fa-calendar-day"></i> تاريخ المعاملة: ${formattedDate}</span>
                    <span class="order-date-lbl" style="font-family:monospace; margin-top:2px;">ID: #${order.id}</span>
                </div>
                <div class="order-pricing-status">
                    <span class="order-row-price">$${Number(order.price).toFixed(2)}</span>
                    <span class="order-status-pill ${order.status}">${translateOrderStatusText(order.status)}</span>
                </div>
            `;
            container.appendChild(row);
        });

    } catch (err) {
        console.error(err);
        container.innerHTML = `<div class="loading-box" style="color:var(--danger)">حدث خطأ غير متوقع أثناء الاتصال بالخادم: ${err.message}</div>`;
    }
}

function translateOrderStatusText(status) {
    const mapping = {
        'pending': 'قيد الانتظار الفني',
        'processing': 'جاري العمل والتنفيذ',
        'completed': 'مكتمل وجاهز للتسليم',
        'cancelled': 'ملغي ومسترد بالكامل'
    };
    return mapping[status] || status;
}