// ملف: login.js
import { supabase, getCurrentUserSession } from './supabase.js';

let authMode = 'login'; // الوضع الافتراضي

document.addEventListener('DOMContentLoaded', async () => {
    // التحقق إذا كان المستخدم مسجلاً دخوله مسبقاً، نوجهه فوراً للمتجر
    const session = await getCurrentUserSession();
    if (session) {
        window.location.href = 'index.html';
        return;
    }

    // مستمعات الأحداث لأزرار التبديل (Tabs)
    document.getElementById('tab-login').addEventListener('click', () => switchMode('login'));
    document.getElementById('tab-register').addEventListener('click', () => switchMode('register'));

    // مستمع حدث نموذج البريد الإلكتروني وكلمة المرور
    document.getElementById('auth-form').addEventListener('submit', handleAuthSubmit);

    // مستمع حدث زر Google OAuth
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

// دالة معالجة المصادقة وإنشاء الحساب
async function handleAuthSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-auth-submit');
    const email = document.getElementById('user-email').value.trim();
    const password = document.getElementById('user-password').value;

    btn.disabled = true;
    const originalContent = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري المعالجة...';

    try {
        if (authMode === 'login') {
            // 1. تسجيل الدخول العادي
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            
            // التوجيه فوراً للموقع عند نجاح الدخول
            window.location.href = 'index.html';
        } else {
            // 2. إنشاء الحساب الجديد وحفظ البيانات
            const fullName = document.getElementById('user-fullname').value.trim();
            
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: { full_name: fullName } // يتم حفظ الاسم داخل حقول الـ User Metadata في الـ Auth
                }
            });
            if (error) throw error;

            // بما أن خيار Confirm Email مغلق، فإن Supabase تسجل دخوله تلقائياً هنا
            alert('🎉 تم إنشاء حسابك بنجاح! جاري تحويلك للمنصة...');
            
            // التوجيه التلقائي الفوري للموقع دون الحاجة للذهاب لصفحة الدخول مرة أخرى
            window.location.href = 'index.html';
        }
    } catch (err) {
        alert('⚠️ فشلت العملية: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalContent;
    }
}

// دالة تسجيل الدخول عبر Google
async function handleGoogleLogin() {
    const btn = document.getElementById('btn-google-login');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري الاتصال بـ Google...';

    try {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
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