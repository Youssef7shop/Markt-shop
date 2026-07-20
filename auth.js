// auth.js

function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));

    if (tab === 'login') {
        document.querySelectorAll('.tab-btn')[0].classList.add('active');
        document.getElementById('login-form').classList.add('active');
    } else {
        document.querySelectorAll('.tab-btn')[1].classList.add('active');
        document.getElementById('register-form').classList.add('active');
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        const res = await fetch('http://localhost:5000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();

        if (res.ok) {
            localStorage.setItem('darkboost_token', data.token);
            alert('تم تسجيل الدخول بنجاح!');
            window.location.href = 'account.html';
        } else {
            alert(data.message || 'خطأ في بيانات الدخول');
        }
    } catch (err) {
        alert('حدث خطأ أثناء الاتصال بالخادم.');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const phone = document.getElementById('reg-phone').value;
    const password = document.getElementById('reg-password').value;

    try {
        const res = await fetch('http://localhost:5000/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, phone, password })
        });

        const data = await res.json();

        if (res.ok) {
            localStorage.setItem('darkboost_token', data.token);
            alert('تم إنشاء الحساب بنجاح!');
            window.location.href = 'account.html';
        } else {
            alert(data.message || 'فشل إنشاء الحساب');
        }
    } catch (err) {
        alert('حدث خطأ أثناء الاتصال بالخادم.');
    }
}