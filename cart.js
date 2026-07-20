// cart.js

document.addEventListener('DOMContentLoaded', () => {
    loadCart();
});

let cart = [];

function loadCart() {
    cart = JSON.parse(localStorage.getItem('darkboost_cart')) || [];
    const tbody = document.getElementById('cart-items-body');
    const emptyCartMsg = document.getElementById('empty-cart-msg');
    const cartTable = document.querySelector('.cart-table');
    const totalElement = document.getElementById('cart-total');

    if (cart.length === 0) {
        cartTable.style.display = 'none';
        emptyCartMsg.style.display = 'block';
        totalElement.innerText = '0.00 $';
        return;
    }

    cartTable.style.display = 'table';
    emptyCartMsg.style.display = 'none';

    tbody.innerHTML = '';
    let total = 0;

    cart.forEach((item, index) => {
        total += item.price * item.quantity;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${item.name}</strong></td>
            <td>
                <div><small style="color: var(--secondary-color);">${item.variant_name}</small></div>
                <div style="font-size: 0.85rem; color: var(--text-muted); word-break: break-all;">${item.target_link}</div>
            </td>
            <td>${item.price} $</td>
            <td>
                <button class="remove-btn" onclick="removeItem(${index})">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    totalElement.innerText = `${total.toFixed(2)} $`;
}

function removeItem(index) {
    cart.splice(index, 1);
    localStorage.setItem('darkboost_cart', JSON.stringify(cart));
    loadCart();
}

function applyCoupon() {
    const code = document.getElementById('coupon-code').value.trim();
    if (!code) {
        alert('الرجاء إدخال رمز الكوبون.');
        return;
    }
    // يمكنك هنا ربط API الكوبونات /api/coupons/validate المذكورة بالمستند
    alert('الكوبون غير صالحة أو منتهي الصلاحية.');
}

async function checkout() {
    if (cart.length === 0) {
        alert('سلة المشتريات فارغة!');
        return;
    }

    // التحقق من وجود رمز تسجيل الدخول JWT
    const token = localStorage.getItem('darkboost_token');
    if (!token) {
        alert('يجب عليك تسجيل الدخول أو إنشاء حساب لإتمام الطلب.');
        window.location.href = 'login.html';
        return;
    }

    const paymentMethod = document.getElementById('payment-method').value;

    const orderPayload = {
        items: cart,
        payment_method: paymentMethod
    };

    try {
        const response = await fetch('http://localhost:5000/api/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(orderPayload)
        });

        const data = await response.json();

        if (response.ok) {
            alert(`تم استلام طلبك بنجاح! رقم الطلب: ${data.order_number}`);
            // تفريغ السلة بعد نجاح الطلب
            localStorage.removeItem('darkboost_cart');
            window.location.href = 'index.html';
        } else {
            alert(data.message || 'حدث خطأ أثناء تنفيذ الطلب.');
        }
    } catch (error) {
        console.error('Error submitting order:', error);
        alert('حدث خطأ في الاتصال بالخادم.');
    }
}