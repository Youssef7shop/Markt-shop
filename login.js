import { auth, db } from "./firebase.js";
import { 
  signInWithEmailAndPassword, 
  GoogleAuthProvider, 
  signInWithPopup, 
  setPersistence, 
  browserLocalPersistence, 
  browserSessionPersistence 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");
  const togglePassword = document.getElementById("togglePassword");
  const passwordInput = document.getElementById("password");
  const googleLoginBtn = document.getElementById("googleLoginBtn");
  const alertBox = document.getElementById("alertBox");

  // إظهار وإخفاء كلمة المرور
  togglePassword.addEventListener("click", () => {
    const isPassword = passwordInput.getAttribute("type") === "password";
    passwordInput.setAttribute("type", isPassword ? "text" : "password");
    togglePassword.querySelector("i").className = isPassword ? "fa-solid fa-eye-slash" : "fa-solid fa-eye";
  });

  // نموذج معالجة تسجيل الدخول التقليدي
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    showAlert("", "clear");

    const email = document.getElementById("email").value.trim();
    const password = passwordInput.value;
    const rememberMe = document.getElementById("rememberMe").checked;

    if (!email || !password) {
      showAlert("يرجى ملء جميع الحقول المطلوبة.", "danger");
      return;
    }

    try {
      // إعداد آلية تذكر الجلسة المستمرة أو المؤقتة لتبويب المتصفح الحالي
      const persistenceType = rememberMe ? browserLocalPersistence : browserSessionPersistence;
      await setPersistence(auth, persistenceType);

      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await handleUserRoutingAndLog(userCredential.user, "Email/Password");

    } catch (error) {
      console.error("Login error:", error);
      let errorMsg = "فشل تسجيل الدخول. يرجى التحقق من صحة البيانات.";
      if (error.code === "auth/invalid-credential") {
        errorMsg = "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
      } else if (error.code === "auth/too-many-requests") {
        errorMsg = "تم حظر الحساب مؤقتاً بسبب محاولات خاطئة متكررة. حاول لاحقاً.";
      }
      showAlert(errorMsg, "danger");
    }
  });

  // تسجيل الدخول بواسطة جوغل
  googleLoginBtn.addEventListener("click", async () => {
    showAlert("", "clear");
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      await handleUserRoutingAndLog(result.user, "Google OAuth");
    } catch (error) {
      console.error("Google Auth error:", error);
      showAlert("تم إلغاء عملية تسجيل الدخول بواسطة Google أو حدث خطأ بالاتصال.", "danger");
    }
  });

  // دالة توجيه الحساب وتسجيل الأنشطة الحية
  async function handleUserRoutingAndLog(user, method) {
    const userRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userRef);

    let role = "client"; // القيمة الافتراضية للعملاء الجدد عبر جوجل

    if (userDoc.exists()) {
      role = userDoc.data().role || "client";
      // تحديث توقيت الدخول الأخير في Firestore
      await setDoc(userRef, { lastLogin: serverTimestamp() }, { merge: true });
    } else {
      // في حال كان تسجيل الدخول لأول مرة عبر Google، ننشئ له وثيقة ومحفظة متكاملة
      const displayName = user.displayName || "مستخدم جديد";
      const username = "user_" + Math.random().toString(36).substring(2, 8);
      
      await setDoc(userRef, {
        fullName: displayName,
        username: username,
        email: user.email,
        phone: user.phoneNumber || "",
        country: "",
        avatarUrl: user.photoURL || "",
        role: role,
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp()
      });

      // إنشاء المحفظة التلقائية له
      await setDoc(doc(db, "wallets", user.uid), {
        userId: user.uid,
        balance: 0,
        currency: "USD",
        updatedAt: serverTimestamp()
      });
    }

    // كتابة السجل الأمني للنشاط logs
    const logRef = doc(db, "logs", `log_${Date.now()}_${user.uid}`);
    await setDoc(logRef, {
      userId: user.uid,
      action: "Login",
      method: method,
      timestamp: serverTimestamp(),
      userAgent: navigator.userAgent
    });

    // التوجيه الذكي للمستخدم بناءً على رتبته وصلاحياته المعتمدة
    if (role === "admin") {
      window.location.href = "admin.html";
    } else if (role === "provider") {
      window.location.href = "provider_dashboard.html";
    } else {
      window.location.href = "dashboard.html";
    }
  }

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