import { supabase, getCurrentUserSession } from './supabase.js';

let authMode = 'login'; // الوضع الافتراضي للنافذة

document.addEventListener('DOMContentLoaded', async () => {
    // 1. التحقق إذا كان المستخدم مسجلاً دخوله مسبقاً، نوجهه فوراً للمتجر
    const session = await getCurrentUserSession();
    if (session) {
        window.location.href = 'index.html';
        return;
    }

    // 2. مستمعات الأحداث لأزرار التبديل (Tabs)
    document.getElementById('tab-login').addEventListener('click', () => switchMode('login'));
    document.getElementById('tab-register').addEventListener('click', () => switchMode('register'));

    // 3. مستمع حدث نموذج البريد الإلكتروني وكلمة المرور
    document.getElementById('auth-form').addEventListener('submit', handleAuthSubmit);

    // 4. مستمع حدث زر Google OAuth الجديد
    document.getElementById('btn-google-login').addEventListener('click', handleGoogleLogin);
});

// دالة التبديل البصري بين وضعي الدخول والتسجيل
function switchMode(mode) {
    authMode = mode;
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const groupFullName = document.getElementById('group-fullname');
    const inputFullName = document.getElementById('user-fullname');
    const submitText = document.getElementById('submit-text');
    const authSubtitle = document.getElementById('auth-subtitle');

    if (mode === 'login') {
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        groupFullName.classList.add('hidden');
        inputFullName.removeAttribute('required');
        submitText.textContent = 'دخول للمنصة';
        authSubtitle.textContent = 'سجل دخولك للوصول إلى سوق الخدمات الذكية';
    } else {
        tabRegister.classList.add('active');
        tabLogin.classList.remove('active');
        groupFullName.classList.remove('hidden');
        inputFullName.setAttribute('required', 'required');
        submitText.textContent = 'إنشاء حساب جديد';
        authSubtitle.textContent = 'انضم إلينا واحصل على محفظة ترحيبية مجانية';
    }
}

// دالة معالجة المصادقة التقليدية (Email / Password)
async function handleAuthSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-auth-submit');
    const email = document.getElementById('user-email').value.trim();
    const password = document.getElementById('user-password').value;

    btn.disabled = true;
    const originalContent = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري التحقق...';

    try {
        if (authMode === 'login') {
            // تسجيل الدخول العادي
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            
            window.location.href = 'index.html';
        } else {
            // إنشاء الحساب العادي الجديد
            const fullName = document.getElementById('user-fullname').value.trim();
            
            const { error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: { full_name: fullName } // تمرير الاسم لقاعدة البيانات ليقوم الـ Trigger بالتقاطه
                }
            });
            if (error) throw error;

            alert('🎉 تم إنشاء الحساب بنجاح! تم شحن محفظتك بـ 100$ كهدية ترحيبية.');
            window.location.href = 'index.html';
        }
    } catch (err) {
        alert('⚠️ فشلت العملية: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalContent;
    }
}

// دالة تسجيل الدخول السحابي السريع عبر جيت واي Google
async function handleGoogleLogin() {
    const btn = document.getElementById('btn-google-login');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري الاتصال بـ Google...';

    try {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                // بعد إتمام العميل للدخول في صفحة جوجل الآمنة، يعيده المتصفح تلقائياً للمتجر رئيسياً
                redirectTo: window.location.origin + '/index.html'
            }
        });
        
        if (error) throw error;
    } catch (err) {
        alert('⚠️ خطأ أثناء الاتصال بـ Google: ' + err.message);
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-brands fa-google" style="color: #ea4335;"></i> تسجيل الدخول بواسطة Google';
    }
}