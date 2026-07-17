import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
  initNavbarControls();
  monitorAuthStateAndUI();
  fetchLivePublicStats();
});

// إدارة فتح وإغلاق القائمة الجانبية للأجهزة المحمولة
function initNavbarControls() {
  const mobileMenuBtn = document.getElementById("mobileMenuBtn");
  const closeSidebarBtn = document.getElementById("closeSidebarBtn");
  const mobileSidebar = document.getElementById("mobileSidebar");

  if (mobileMenuBtn && mobileSidebar) {
    mobileMenuBtn.addEventListener("click", () => {
      mobileSidebar.classList.add("open");
    });
  }

  if (closeSidebarBtn && mobileSidebar) {
    closeSidebarBtn.addEventListener("click", () => {
      mobileSidebar.classList.remove("open");
    });
  }

  // إغلاق القائمة عند النقر على أي رابط بداخلها
  const sidebarLinks = document.querySelectorAll(".sidebar-link");
  sidebarLinks.forEach(link => {
    link.addEventListener("click", () => {
      mobileSidebar.classList.remove("open");
    });
  });
}

// مراقبة حالة تسجيل الدخول وتغيير أزرار التنقل وفقاً للرتبة
function monitorAuthStateAndUI() {
  const authContainer = document.getElementById("authActionContainer");
  const mobileAuthContainer = document.getElementById("mobileAuthContainer");

  onAuthStateChanged(auth, (user) => {
    if (user) {
      // جلب وثيقة المستخدم لتحديد لوحة التحكم المناسبة (Admin / Provider / Client)
      const userRef = doc(db, "users", user.uid);
      onSnapshot(userRef, (snapshot) => {
        let dashboardUrl = "dashboard.html"; // الافتراضي للعميل
        if (snapshot.exists()) {
          const userData = snapshot.data();
          if (userData.role === "admin") {
            dashboardUrl = "admin.html";
          } else if (userData.role === "provider") {
            dashboardUrl = "provider_dashboard.html";
          }
        }
        
        // تعديل واجهة الأزرار للمستخدم المسجل
        const dashboardBtnHTML = `
          <a href="${dashboardUrl}" class="btn-primary">
            <i class="fa-solid fa-chart-line"></i> لوحة التحكم
          </a>
        `;
        
        if (authContainer) authContainer.innerHTML = dashboardBtnHTML;
        if (mobileAuthContainer) mobileAuthContainer.innerHTML = dashboardBtnHTML;
      });
    } else {
      // واجهة الأزرار الافتراضية إذا لم يكن هناك مستخدم مسجل
      const defaultAuthHTML = `
        <a href="login.html" class="btn-outline">تسجيل الدخول</a>
        <a href="register.html" class="btn-primary">ابدأ مجاناً</a>
      `;
      if (authContainer) authContainer.innerHTML = defaultAuthHTML;
      
      const defaultMobileAuthHTML = `
        <a href="login.html" class="btn-outline w-100">تسجيل الدخول</a>
        <a href="register.html" class="btn-primary w-100 mt-10">ابدأ مجاناً</a>
      `;
      if (mobileAuthContainer) mobileAuthContainer.innerHTML = defaultMobileAuthHTML;
    }
  });
}

// جلب الإحصائيات العامة المباشرة من Firestore
function fetchLivePublicStats() {
  const statsRef = doc(db, "analytics", "public_stats");
  
  // الاستماع للتغيرات في الوقت الفعلي
  onSnapshot(statsRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      animateCounter("statUsers", data.usersCount || 0);
      animateCounter("statOrders", data.ordersCount || 0);
      animateCounter("statServices", data.servicesCount || 0);
      animateCounter("statPayouts", data.payoutsCount || 0);
    } else {
      // قيم افتراضية حية لبدء تشغيل المشروع لأول مرة في حال لم تكن الوثيقة جاهزة
      animateCounter("statUsers", 1420);
      animateCounter("statOrders", 890);
      animateCounter("statServices", 124);
      animateCounter("statPayouts", 15400);
    }
  }, (error) => {
    console.error("Error fetching live stats:", error);
    // إمداد بأرقام ثابتة كمرجع احتياطي في حال وجود خطأ في الصلاحيات قبل التهيئة الكاملة
    animateCounter("statUsers", 1420);
    animateCounter("statOrders", 890);
    animateCounter("statServices", 124);
    animateCounter("statPayouts", 15400);
  });
}

// دالة محاكاة حركة العداد لزيادة جمالية الـ UI
function animateCounter(elementId, targetValue) {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  let currentValue = 0;
  const duration = 1500; // مدة الحركة بالملي ثانية
  const steps = 60;
  const increment = targetValue / steps;
  const stepTime = duration / steps;
  
  const timer = setInterval(() => {
    currentValue += increment;
    if (currentValue >= targetValue) {
      element.textContent = Math.floor(targetValue).toLocaleString();
      clearInterval(timer);
    } else {
      element.textContent = Math.floor(currentValue).toLocaleString();
    }
  }, stepTime);
}