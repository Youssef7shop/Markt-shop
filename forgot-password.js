import { auth } from "./firebase.js";
import { sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

document.addEventListener("DOMContentLoaded", () => {
  const forgotForm = document.getElementById("forgotForm");
  const alertBox = document.getElementById("alertBox");

  forgotForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    showAlert("", "clear");

    const email = document.getElementById("email").value.trim();

    if (!email) {
      showAlert("يرجى تدوين عنوان البريد الإلكتروني.", "danger");
      return;
    }

    try {
      // إرسال رابط إعادة التعيين الرسمي من خوادم فايربيس
      await sendPasswordResetEmail(auth, email);
      showAlert("تم إرسال رابط تعيين كلمة المرور بنجاح. تفقد علبة الوارد أو البريد غير الهام (Spam).", "success");
      forgotForm.reset();
    } catch (error) {
      console.error("Reset Password Link Error:", error);
      let errorMsg = "فشل إرسال الرابط السحابي. يرجى التحقق من صحة البريد الإلكتروني المكتوب.";
      if (error.code === "auth/user-not-found") {
        errorMsg = "لا يوجد حساب مسجل بالمنصة بهذا البريد الإليكتروني.";
      }
      showAlert(errorMsg, "danger");
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