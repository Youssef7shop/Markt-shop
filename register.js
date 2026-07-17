import { auth, db } from "./firebase.js";
import { createUserWithEmailAndPassword, sendEmailVerification } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, setDoc, collection, query, where, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
  const registerForm = document.getElementById("registerForm");
  const alertBox = document.getElementById("alertBox");

  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    showAlert("", "clear");

    const fullName = document.getElementById("fullName").value.trim();
    const username = document.getElementById("username").value.trim().toLowerCase();
    const email = document.getElementById("email").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const country = document.getElementById("country").value.trim();
    const role = document.querySelector('input[name="role"]:checked').value;
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;
    const termsCheck = document.getElementById("termsCheck").checked;

    // 1. التحقق من صحة المدخلات محلياً قبل التخاطب مع السيرفر
    if (!fullName || !username || !email || !phone || !country || !password || !confirmPassword) {
      showAlert("يرجى ملء جميع الحقول المطلوبة دون استثناء.", "danger");
      return;
    }
    if (password.length < 8) {
      showAlert("قوة الأمان ضعيفة: يجب ألا تقل كلمة المرور عن 8 خانات.", "danger");
      return;
    }
    if (password !== confirmPassword) {
      showAlert("تنبيه: كلمة المرور وغير متطابقة مع خانة التأكيد.", "danger");
      return;
    }
    if (!termsCheck) {
      showAlert("يجب الموافقة أولاً على وثيقة شروط الخدمة وسياسة الخصوصية.", "danger");
      return;
    }

    try {
      // 2. التحقق من عدم تكرار اسم المستخدم (Username Uniqueness Checking)
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("username", "==", username));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        showAlert("اسم المستخدم محجوز مسبقاً، يرجى اختيار اسم مستخدم آخر.", "danger");
        return;
      }

      // 3. إنشاء المستخدم في نظام Firebase Authentication السحابي
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 4. إرسال رابط تأكيد وتفعيل الحساب بالبريد الإليكتروني
      await sendEmailVerification(user);

      // 5. تهيئة وحفظ بيانات الملف الشخصي في Firestore collection -> users
      await setDoc(doc(db, "users", user.uid), {
        fullName: fullName,
        username: username,
        email: email,
        phone: phone,
        country: country,
        role: role,
        avatarUrl: "",
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp()
      });

      // 6. تهيئة المحفظة المالية الفورية الخاصة بالمستخدم الجديد
      await setDoc(doc(db, "wallets", user.uid), {
        userId: user.uid,
        balance: 0,
        currency: "USD",
        updatedAt: serverTimestamp()
      });

      // 7. تهيئة الإعدادات الافتراضية المخصصة للحساب
      await setDoc(doc(db, "settings", user.uid), {
        userId: user.uid,
        theme: "dark",
        emailNotifications: true,
        smsNotifications: false,
        updatedAt: serverTimestamp()
      });

      // 8. تسجيل النشاط الأمني الأول في الـ logs
      await setDoc(doc(db, "logs", `log_${Date.now()}_${user.uid}`), {
        userId: user.uid,
        action: "Registration",
        method: "Email/Password",
        timestamp: serverTimestamp(),
        userAgent: navigator.userAgent
      });

      showAlert("تم إنشاء الحساب بنجاح! تم إرسال رابط تأكيد إلى بريدك الإليكتروني.", "success");
      
      // إعادة التوجيه للوحة التحكم المناسبة بعد 3 ثوانٍ لإتاحة قراءة رسالة النجاح
      setTimeout(() => {
        window.location.href = role === "provider" ? "provider_dashboard.html" : "dashboard.html";
      }, 2500);

    } catch (error) {
      console.error("Registration Error:", error);
      let errorMsg = "حدث خطأ غير متوقع أثناء تسجيل البيانات، يرجى المحاولة لاحقاً.";
      if (error.code === "auth/email-already-in-use") {
        errorMsg = "البريد الإلكتروني المكتوب مسجل بالفعل في نظام المنصة.";
      } else if (error.code === "auth/invalid-email") {
        errorMsg = "صيغة البريد الإلكتروني غير صالحة للكتابة.";
      }
      showAlert(errorMsg, "danger");
    }
  });

  function showAlert(msg, type) {
    if (type === "clear") {
      alertBox.className = "alert-box hidden";
      alertBox.textContent = "";
    } else {
      alertBox.className = `alert-box ${type}`;
      alertBox.innerHTML = `<i class="fa-solid ${type === 'danger' ? 'fa-triangle-exclamation' : 'fa-circle-check'}"></i> <span>${msg}</span>`;
    }
  }
});