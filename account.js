// account.js

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('darkboost_token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    loadUserProfile(token);
    loadUserOrders(token);
});

async function loadUserProfile(token) {
    try {
        const res = await fetch('http://localhost:5000/api/auth/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
            const user = await res.json();
            document.getElementById('user-name').innerText = user.name;
            document.getElementById('user-email').innerText = user.email;
            document.getElementById('user-wallet').innerText = `${user.wallet_balance} $`;
        } else {
            logout();
        }
    } catch (err) {
        console.error(err);
    }
}

async function loadUserOrders(token) {
    const tbody = document.getElementById('orders-list');
    try {
        const res = await fetch('http://localhost:5000/api/orders/user', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (res.ok) {
            const orders = await res.json();
            tbody.innerHTML = '';

            if (orders.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">لا توجد طلبات سابقة.</td></tr>';
                return;
            }

            orders.forEach(order => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${order.order_number}</strong></td>
                    <td>${order.total_amount} $</td>
                    <td><span style="color: ${order.payment_status === 'paid' ? '#55efc4' : '#ffeaa7'};">${order.payment_status}</span></td>
                    <td><span style="color: var(--secondary-color);">${order.order_status}</span></td>
                    <td>${new Date(order.created_at).toLocaleDateString('ar-EG')}</td>
                `;
                tbody.appendChild(tr);
            });
        }
    } catch (err) {
        console.error(err);
    }
}

function logout() {
    localStorage.removeItem('darkboost_token');
    window.location.href = 'login.html';
}