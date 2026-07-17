import { auth } from "./firebase.js";
import { confirmPasswordReset, verifyPasswordResetCode } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

document.addEventListener("DOMContentLoaded", async () => {
  const resetForm = document.getElementById("resetForm");
  const alertBox = document.getElementById("alertBox");

  // استخراج كود التحقق (oobCode) القادم من معلمة الرابط السحابي المبعوث للمستخدم عبر البريد
  const urlParams = new URLSearchParams(window.location.search);
  const oobCode = urlParams.get("oobCode");

  if (!oobCode) {
    showAlert("كود الاستعادة مفقود أو غير صالح للوصول، يرجى طلب رابط جديد.", "danger");
    document.getElementById("submitBtn").disabled = true;
    return;
  }

  try {
    // التأكد التام من صلاحية الـ code وصلاحية وقت تشغيله وسريانه
    await verifyPasswordResetCode(auth, oobCode);
  } catch (error) {
    console.error("Verification code invalid:", error);
    showAlert("انتهت صلاحية هذا الرابط أو تم استخدامه مسبقاً، يرجى طلب رابط استعادة جديد.", "danger");
    document.getElementById("submitBtn").disabled = true;
    return;
  }

  resetForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    showAlert("", "clear");

    const newPassword = document.getElementById("newPassword").value;
    const confirmNewPassword = document.getElementById("confirmNewPassword").value;

    if (!newPassword || !confirmNewPassword) {
      showAlert("يرجى ملء كافة حقول كلمة المرور الجديدة.", "danger");
      return;
    }
    if (newPassword.length < 8) {
      showAlert("يجب ألا تقل كلمة المرور المحدثة عن 8 رموز.", "danger");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      showAlert("تأكيد كلمة المرور الجديدة غير متطابق مع المدخل الأول.", "danger");
      return;
    }

    try {
      // إتمام الحفظ والتعديل الفعلي لكلمة المرور في خوادم المصادقة
      await confirmPasswordReset(auth, oobCode, newPassword);
      showAlert("تم تحديث وحفظ كلمة المرور الجديدة بنجاح! يتم الآن تحويلك لصفحة الدخول...", "success");
      
      setTimeout(() => {
        window.location.href = "login.html";
      }, 3000);
    } catch (error) {
      console.error("Firebase Reset Execution Error:", error);
      showAlert("فشل إتمام حفظ التغييرات، قد يكون الرابط قد انتهى مفعوله الفني.", "danger");
    }
  });

  function showAlert(msg, type) {
    if (type === "clear") {
      alertBox.className = "alert-box hidden";
    } else {
      alertBox.className = `alert-box ${type}`;
      alertBox.innerHTML = `<i class="fa-solid ${type === 'danger' ? 'fa-triangle-exclamation' : 'fa-circle-check'}"></i> <span>${msg}</span>`;
    }
  }
});