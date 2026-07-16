// js/dashboard.js
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('boostify_token');
    const userStr = localStorage.getItem('boostify_user');

    if (!token || !userStr) {
        window.location.href = 'login.html';
        return;
    }

    const user = JSON.parse(userStr);
    document.getElementById('clientName').textContent = user.fullName;
    document.getElementById('navName').textContent = user.fullName;

    // تسجيل الخروج الآمن
    document.getElementById('logoutBtn').addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('boostify_token');
        localStorage.removeItem('boostify_user');
        window.location.href = 'login.html';
    });

    try {
        const response = await fetch('/api/client/dashboard-data', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const resData = await response.json();
        if (!response.ok) throw new Error(resData.error);

        const data = resData.data;

        // تعبئة واجهة المستخدم بالأرقام الحقيقية القادمة من PostgreSQL
        document.getElementById('statBalance').textContent = `${data.balance.toFixed(2)} $`;
        document.getElementById('statActiveOrders').textContent = data.activeOrdersCount;
        document.getElementById('statCompletedOrders').textContent = data.completedOrdersCount;
        document.getElementById('statTotalSpent').textContent = `${data.totalSpent.toFixed(2)} $`;

        // تعبئة الطلبات الأخيرة
        const recentOrdersList = document.getElementById('recentOrdersList');
        if (data.recentOrders && data.recentOrders.length > 0) {
            recentOrdersList.innerHTML = data.recentOrders.map(order => `
                <div class="list-group-item bg-transparent border-0 px-0 py-3 d-flex justify-content-between align-items-center">
                    <div>
                        <h6 class="mb-1 text-white fw-semibold">${order.service.title}</h6>
                        <small class="text-muted">المزود: ${order.provider.user.fullName}</small>
                    </div>
                    <span class="status-badge ${getStatusClass(order.status)}">${formatStatus(order.status)}</span>
                </div>
            `).join('');
        } else {
            recentOrdersList.innerHTML = `<p class="text-muted text-center py-5">لا توجد طلبات حديثة.</p>`;
        }

        // بناء المخطط البياني للمصروفات الشهرية
        buildChart(data.totalSpent);

    } catch (err) {
        console.error('Error loading dashboard:', err);
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
        case 'PENDING': return 'في الانتظار';
        case 'IN_PROGRESS': return 'قيد التنفيذ';
        case 'COMPLETED': return 'مكتمل';
        default: return 'ملغي';
    }
}

function buildChart(totalSpent) {
    const ctx = document.getElementById('spendingChart').getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو'],
            datasets: [{
                label: 'حجم الإنفاق المالي ($)',
                data: [totalSpent * 0.1, totalSpent * 0.3, totalSpent * 0.2, totalSpent * 0.5, totalSpent * 0.8, totalSpent],
                borderColor: '#6c5dd3',
                backgroundColor: 'rgba(108, 93, 211, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#858095' } },
                x: { grid: { display: false }, ticks: { color: '#858095' } }
            }
        }
    });
}