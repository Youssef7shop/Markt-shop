import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  doc, 
  getDoc, 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot, 
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
  let currentUser = null;

  // 1. التحقق من جلسة المصادقة وصلاحيات الرتبة (Client Authorization check)
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      // إذا لم يكن هناك جلسة، يوجهه فوراً لصفحة الدخول لحماية البيانات
      window.location.href = "login.html";
      return;
    }

    currentUser = user;
    const userDocRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists()) {
      const userData = userDoc.data();
      
      // تأكيد أنه عميل عادي وليس مقدم خدمة أو مدير
      if (userData.role !== "client") {
        alert("مسار غير مصرح به لرتبة حسابك.");
        await signOut(auth);
        window.location.href = "login.html";
        return;
      }

      // تحديث واجهة المستخدم العلوية والجانبية بالبيانات الشخصية الحقيقية
      document.getElementById("userFullName").textContent = userData.fullName || "مستخدم غير معرف";
      document.getElementById("headerGreetingName").textContent = (userData.fullName || "عميل").split(" ")[0];
      if (userData.avatarUrl) {
        document.getElementById("userAvatar").src = userData.avatarUrl;
      }
    }

    // تشغيل مستمعي البيانات السحابية الحية للعميل
    initRealtimeWalletListener(user.uid);
    initRealtimeOrdersListener(user.uid);
    initNotificationListener(user.uid);
  });

  // 2. مستمع المحفظة في الوقت الفعلي (Realtime Wallet Listener)
  function initRealtimeWalletListener(userId) {
    const walletRef = doc(db, "wallets", userId);
    onSnapshot(walletRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const walletData = docSnapshot.data();
        const balance = walletData.balance || 0;
        document.getElementById("walletBalance").textContent = `$${balance.toFixed(2)}`;
      } else {
        document.getElementById("walletBalance").textContent = "$0.00";
      }
    }, (error) => {
      console.error("خطأ أثناء جلب الرصيد لحظياً:", error);
    });
  }

  // 3. مستمع الطلبات والإحصائيات في الوقت الفعلي (Realtime Orders & Stats Listener)
  function initRealtimeOrdersListener(userId) {
    const ordersRef = collection(db, "orders");
    const q = query(ordersRef, where("clientId", "==", userId));

    onSnapshot(q, (snapshot) => {
      let totalOrders = 0;
      let activeOrders = 0;
      let totalSpent = 0;
      let ordersList = [];

      snapshot.forEach((orderDoc) => {
        const order = orderDoc.data();
        order.id = orderDoc.id;
        totalOrders++;
        
        // احتساب الحالات النشطة (Pending or In Progress)
        if (order.status === "pending" || order.status === "progress") {
          activeOrders++;
        }
        
        // احتساب المجموع الإجمالي للمشتريات المكتملة
        if (order.status === "completed") {
          totalSpent += Number(order.price || 0);
        }

        ordersList.push(order);
      });

      // تحديث البطاقات الإحصائية
      document.getElementById("totalOrdersCount").textContent = totalOrders;
      document.getElementById("activeOrdersCount").textContent = activeOrders;
      document.getElementById("totalSpentAmount").textContent = `$${totalSpent.toFixed(2)}`;

      // ترتيب الطلبات وعرض آخر 5 طلبات في الجدول الرئيسي للوحة التحكم
      ordersList.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      renderRecentOrdersTable(ordersList.slice(0, 5));
    }, (error) => {
      console.error("خطأ أثناء الاستماع للطلبات:", error);
    });
  }

  // بناء أسطر جدول الطلبات الأخيرة ديناميكياً
  function renderRecentOrdersTable(orders) {
    const tableBody = document.getElementById("recentOrdersTableBody");
    if (orders.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center; padding: 2.5rem; color:var(--text-secondary);">
            <i class="fa-solid fa-folder-open" style="font-size:2rem; margin-bottom:0.5rem; display:block; color:rgba(255,255,255,0.1)"></i>
            لم تقم بطلب أي خدمات ذكاء اصطناعي بعد.
          </td>
        </tr>
      `;
      return;
    }

    let html = "";
    orders.forEach(order => {
      const formattedDate = order.createdAt ? new Date(order.createdAt.seconds * 1000).toLocaleDateString("ar-EG") : "قيد المعالجة";
      let statusClass = "pending";
      let statusLabel = "معلق";

      if (order.status === "progress") { statusClass = "progress"; statusLabel = "جاري العمل"; }
      else if (order.status === "completed") { statusClass = "completed"; statusLabel = "مكتمل"; }
      else if (order.status === "cancelled") { statusClass = "cancelled"; statusLabel = "ملغي"; }

      html += `
        <tr>
          <td style="font-family: monospace; font-weight:700;">#${order.id.substring(0, 8)}</td>
          <td style="font-weight:700;">${order.serviceTitle || "خدمة ذكية"}</td>
          <td>${order.providerName || "خبير النظام"}</td>
          <td>${formattedDate}</td>
          <td style="font-weight:700; color:var(--accent-glow);">$${Number(order.price).toFixed(2)}</td>
          <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
          <td>
            <a href="order-details.html?id=${order.id}" class="btn-action">التفاصيل</a>
          </td>
        </tr>
      `;
    });
    tableBody.innerHTML = html;
  }

  // 4. مستمع التنبيهات غير المقروءة (Notifications Listener)
  function initNotificationListener(userId) {
    const notifsRef = collection(db, "notifications");
    const q = query(notifsRef, where("userId", "==", userId), where("seen", "==", false));

    onSnapshot(q, (snapshot) => {
      const unreadCount = snapshot.size;
      const badge = document.getElementById("notificationBadge");
      
      if (unreadCount > 0) {
        badge.textContent = unreadCount;
        badge.classList.remove("hidden");
      } else {
        badge.classList.add("hidden");
      }
    });
  }

  // 5. محاكاة المساعد الذكي السريع محلياً قبل ربطه بنماذج OpenAI/Gemini بالمراحل اللاحقة
  const aiInput = document.getElementById("aiQuickPrompt");
  const sendAiBtn = document.getElementById("sendAiPromptBtn");
  const aiResponseBox = document.getElementById("aiResponseBox");
  const aiResponseText = document.getElementById("aiResponseText");

  sendAiBtn.addEventListener("click", () => {
    const promptValue = aiInput.value.trim();
    if (!promptValue) return;

    aiResponseBox.classList.remove("hidden");
    aiResponseText.innerHTML = `<div class="spinner-inline"></div> جاري التفكير وتحليل الطلب...`;

    // استجابة تفاعلية ذكية من النظام لمحاكاة الـ AI Assistant الفوري
    setTimeout(() => {
      aiResponseText.textContent = `مرحباً بك! بناءً على رغبتك في "${promptValue}"، قمنا بتحليل قاعدة بيانات مقدمي الخدمة لدينا. نرشح لك الخبير "مروان أحمد - متخصص معالجة اللغات الطبيعية ونماذج التوليد العميق"، حيث يمتلك تقييم 4.9/5 ولديه 14 عملاً منجزاً بنجاح. يمكنك استكشاف صفحته عبر قسم الخدمات الآن.`;
    }, 1800);
  });

  // 6. التحكم بالسايدبار وتجاوبه على الهواتف
  const toggleBtn = document.getElementById("toggleSidebar");
  const sidebar = document.getElementById("sidebar");

  toggleBtn.addEventListener("click", () => {
    sidebar.classList.toggle("open");
  });

  // إغلاق السايدبار عند النقر بالخارج في الأجهزة المحمولة
  document.addEventListener("click", (e) => {
    if (window.innerWidth <= 900) {
      if (!sidebar.contains(e.target) && !toggleBtn.contains(e.target) && sidebar.classList.contains("open")) {
        sidebar.classList.remove("open");
      }
    }
  });

  // 7. تسجيل الخروج الآمن
  const logoutBtn = document.getElementById("logoutBtn");
  logoutBtn.addEventListener("click", async () => {
    if (confirm("هل تود بالتأكيد الخروج من حسابك؟")) {
      try {
        if (currentUser) {
          // تسجيل نشاط الخروج في logs
          const logRef = doc(db, "logs", `log_${Date.now()}_${currentUser.uid}`);
          await setDoc(logRef, {
            userId: currentUser.uid,
            action: "Logout",
            timestamp: serverTimestamp(),
            userAgent: navigator.userAgent
          });
        }
        await signOut(auth);
        window.location.href = "login.html";
      } catch (error) {
        console.error("خطأ أثناء تسجيل الخروج:", error);
      }
    }
  });
});