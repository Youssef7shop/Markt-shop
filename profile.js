// استدعاء مباشر ومسطح من نفس مستوى الجذر
import { supabase, getCurrentUserSession, logSystemActivity } from './supabase.js';

let activeUserId = null;

document.addEventListener('DOMContentLoaded', async () => {
    const sessionData = await getCurrentUserSession();
    if (!sessionData) {
        window.location.href = 'login.html';
        return;
    }

    activeUserId = sessionData.auth.id;

    // ملء حقول النموذج البرمجي بالبيانات المزامنة من PostgreSQL
    document.getElementById('prof-fullname').value = sessionData.profile.full_name || '';
    document.getElementById('prof-username').value = sessionData.profile.username || '';
    document.getElementById('prof-email').value = sessionData.profile.email || '';
    document.getElementById('prof-phone').value = sessionData.profile.phone || '';
    document.getElementById('prof-country').value = sessionData.profile.country || '';
    document.getElementById('profile-display-username').textContent = `@${sessionData.profile.username}`;
    document.getElementById('profile-display-role').textContent = sessionData.role;

    if (sessionData.profile.avatar_url) {
        document.getElementById('profile-preview-img').src = sessionData.profile.avatar_url;
    }

    // تفعيل أحداث الاستماع للعمليات التفاعلية
    setupProfileEventListeners();
});

function setupProfileEventListeners() {
    const form = document.getElementById('profile-update-form');
    const fileInput = document.getElementById('avatar-file-input');
    const deleteBtn = document.getElementById('btn-delete-account');

    // 1. معالجة تحديث البيانات النصية الحقيقية (Update Sync)
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            setAlert('', 'hide');

            const fullName = document.getElementById('prof-fullname').value.trim();
            const phone = document.getElementById('prof-phone').value.trim();
            const country = document.getElementById('prof-country').value.trim();
            const saveBtn = document.getElementById('btn-save-profile');

            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري حفظ التعديلات...';

            try {
                const { error } = await supabase
                    .from('users')
                    .update({
                        full_name: fullName,
                        phone: phone,
                        country: country,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', activeUserId);

                if (error) throw error;

                await logSystemActivity('User Updated Personal Profile Database Record');
                setAlert('تم تحديث وحفظ بيانات ملفك الشخصي بنجاح!', 'success');

            } catch (err) {
                setAlert(err.message, 'error');
            } finally {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> حفظ وتحديث بيانات حسابي';
            }
        });
    }

    // 2. معالجة رفع الصور الشخصية مباشرة إلى الـ Storage Bucket في سوبابيز
    if (fileInput) {
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            setAlert('جاري معالجة ورفع الصورة للسيرفر السحابي...', 'success');

            try {
                const fileExt = file.name.split('.').pop();
                const filePath = `${activeUserId}/${Math.random()}.${fileExt}`;

                const { error: uploadError } = await supabase.storage
                    .from('avatars')
                    .upload(filePath, file, { upsert: true });

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('avatars')
                    .getPublicUrl(filePath);

                await supabase.from('users').update({ avatar_url: publicUrl }).eq('id', activeUserId);

                document.getElementById('profile-preview-img').src = publicUrl;
                setAlert('تم تحديث صورتك الشخصية السحابية بنجاح!', 'success');

            } catch (err) {
                setAlert('فشل رفع الصورة: ' + err.message, 'error');
            }
        });
    }

    // 3. معالجة تدمير وحذف الحساب بالكامل وبأمان (Delete CRUD Operation)
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            const confirmFirst = confirm("🚨 تحذير أمني صارم: هل أنت متأكد تماماً من حذف حسابك؟ لا يمكن استرجاع البيانات بعد ذلك.");
            if (!confirmFirst) return;

            const confirmSecond = prompt("اكتب كلمة 'DELETE' لتأكيد عملية الحذف النهائية:");
            if (confirmSecond !== 'DELETE') {
                alert("تأكيد خاطئ، تم إلغاء العملية.");
                return;
            }

            try {
                const { error } = await supabase.from('users').delete().eq('id', activeUserId);
                if (error) throw error;

                await supabase.auth.signOut();
                alert("تم إتلاف حسابك بنجاح من أنظمة Boostify AI.");
                window.location.href = 'login.html';

            } catch (err) {
                alert("فشلت عملية الحذف: " + err.message);
            }
        });
    }
}

function setAlert(message, type) {
    const box = document.getElementById('profile-alert');
    if (!box) return;
    if (type === 'hide') { box.className = 'alert-box hidden'; return; }
    box.className = `alert-box ${type}`;
    box.textContent = message;
}