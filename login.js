import { supabase, getCurrentUserSession } from './supabase.js';

let authMode = 'login'; // الوضع الافتراضي: تسجيل الدخول

document.addEventListener('DOMContentLoaded', async () => {
    // التحقق إذا كان المستخدم مسجلاً دخوله بالفعل، نقوم بنقله فوراً للمتجر
    const session = await getCurrentUserSession();
    if (session) {
        window.location.href = 'index.html';
        return;
    }

    // تفعيل أزرار التبديل بين الدخول والتسجيل
    document.getElementById('tab-login').addEventListener('click', () => switchMode('login'));
    document.getElementById('tab-register').addEventListener('click', () => switchMode('register'));

    // التقاط حدث إرسال النموذج
    document.getElementById('auth-form').addEventListener('submit', handleAuthSubmit);
});

// دالة التبديل البصري والبرمجي
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

// دالة معالجة البيانات وإرسالها إلى Supabase
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
            // تنفيذ تسجيل الدخول
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            
            window.location.href = 'index.html';
        } else {
            // تنفيذ إنشاء حساب جديد
            const fullName = document.getElementById('user-fullname').value.trim();
            
            const { error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    // نمرر الاسم الكامل في البيانات التعريفية (Metadata) ليقوم تريجر SQL بالالتقاط الآلي
                    data: { full_name: fullName }
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