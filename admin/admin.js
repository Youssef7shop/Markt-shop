// admin/admin.js

document.addEventListener('DOMContentLoaded', () => {
    // التأكد من تسجيل الدخول ووجود توكن JWT
    const token = localStorage.getItem('darkboost_token');
    if (!token) {
        alert('يرجى تسجيل الدخول كمسؤول أولاً.');
        window.location.href = '../login.html';
    }
});

function showPanel(panelId, element) {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.sidebar-menu a').forEach(a => a.classList.remove('active'));
    
    document.getElementById(panelId).classList.add('active');
    element.classList.add('active');
}

async function handleAddProduct(e) {
    e.preventDefault();
    
    const token = localStorage.getItem('darkboost_token');
    const name = document.getElementById('p-name').value;
    const slug = document.getElementById('p-slug').value;
    const category_id = document.getElementById('p-category').value;
    const price = document.getElementById('p-price').value;
    const description = document.getElementById('p-desc').value;

    try {
        const response = await fetch('http://localhost:5000/api/admin/products', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ name, slug, category_id, price, description, stock_type: 'unlimited' })
        });

        const data = await response.json();

        if (response.ok) {
            alert('تمت إضافة الخدمة بنجاح إلى قاعدة البيانات!');
            document.getElementById('add-product-form').reset();
        } else {
            alert(data.message || 'حدث خطأ أثناء إضافة الخدمة. تأكد من امتلاك صلاحية الأدمن.');
        }
    } catch (error) {
        console.error('Error adding product:', error);
        alert('حدث خطأ في الاتصال بالخادم.');
    }
}