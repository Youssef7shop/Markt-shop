// js/login.js
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');
    const alertBox = document.getElementById('alertBox');
    const loginSpinner = document.getElementById('loginSpinner');
    const submitBtn = loginForm.querySelector('.btn-login');

    // تفعيل إخفاء وإظهار كلمة المرور بشكل سلس
    togglePassword.addEventListener('click', () => {
        const isPassword = passwordInput.getAttribute('type') === 'password';
        passwordInput.setAttribute('type', isPassword ? 'text' : 'password');
        
        const icon = togglePassword.querySelector('i');
        if (isPassword) {
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        } else {
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        }
    });

    // معالجة إرسال النموذج واستدعاء الـ API
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value.trim();
        const password = passwordInput.value;

        // التحقق الأولي
        if (!email || !password) {
            showAlert('يرجى ملء جميع الحقول المطلوبة.', 'danger');
            return;
        }

        // إظهار حالة التحميل للعميل
        setLoading(true);

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'فشل تسجيل الدخول، يرجى التحقق من بياناتك.');
            }

            // في حال نجاح الدخول، نقوم بحفظ التوكن وبيانات المستخدم في localStorage
            localStorage.setItem('boostify_token', data.token);
            localStorage.setItem('boostify_user', JSON.stringify(data.user));

            showAlert('تم تسجيل الدخول بنجاح! جاري تحويلك لوحة التحكم...', 'success');

            // توجيه المستخدم لوحة التحكم الخاصة برتبته بعد ثانية واحدة
            setTimeout(() => {
                const userRole = data.user.role;
                if (userRole === 'ADMIN') {
                    window.location.href = 'reports.html'; // أو لوحة تحكم الأدمن
                } else {
                    window.location.href = 'dashboard.html';
                }
            }, 1200);

        } catch (err) {
            showAlert(err.message, 'danger');
            setLoading(false);
        }
    });

    function showAlert(message, type) {
        alertBox.textContent = message;
        alertBox.className = `alert alert-${type}`;
        alertBox.classList.remove('d-none');
    }

    function setLoading(isLoading) {
        if (isLoading) {
            loginSpinner.classList.remove('d-none');
            submitBtn.setAttribute('disabled', 'true');
        } else {
            loginSpinner.classList.add('d-none');
            submitBtn.removeAttribute('disabled');
        }
    }
});