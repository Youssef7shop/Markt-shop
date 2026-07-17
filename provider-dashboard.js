import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  doc, 
  getDoc, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  updateDoc,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
  let currentProvider = null;

  // 1. التحقق الصارم من رتبة مقدم الخدمة (Provider Access Control)
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }

    currentProvider = user;
    const providerDocRef = doc(db, "users", user.uid);
    const providerDoc = await getDoc(providerDocRef);

    if (providerDoc.exists()) {
      const providerData = providerDoc.data();
      
      // حظر الدخول إذا كانت الرتبة لا تطابق "provider"
      if (providerData.role !== "provider") {
        alert("خطأ في صلاحيات الوصول. هذه المنطقة مخصصة لمقدمي الخدمة المعتمدين.");
        await signOut(auth);
        window.location.href = "login.html";
        return;
      }

      // حقن البيانات الشخصية في السايدبار والهيدر
      document.getElementById("providerFullName").textContent = providerData.fullName || "خبير النظام";
      document.getElementById("providerGreetingName").textContent = (providerData.fullName || "الخبير").split(" ")[0];
      if (providerData.avatarUrl) {
        document.getElementById("providerAvatar").src = providerData.avatarUrl;
      }
      if (providerData.rating) {
        document.getElementById("providerRating").textContent = Number(providerData.rating).toFixed(1);
      }
    }

    // تشغيل القنوات السحابية المباشرة للمبيعات والمشاريع الموكلة
    initRealtimeProviderOrders(user.uid);
  });

  // 2. مستمع المبيعات والطلبات الواردة لحظة بلحظة
  function initRealtimeProviderOrders(providerId) {
    const ordersRef = collection(db, "orders");
    const q = query(ordersRef, where("providerId", "==", providerId));

    onSnapshot(q, (snapshot) => {
      let netEarnings = 0;
      let pendingCount = 0;
      let progressCount = 0;
      let providerOrdersList = [];

      snapshot.forEach((orderDoc) => {
        const order = orderDoc.data();
        order.id = orderDoc.id;
        
        // حساب المبيعات والإحصائيات بناءً على حالة كل مشروع في الفايرستور
        if (order.status === "pending") {
          pendingCount++;
        } else if (order.status === "progress") {
          progressCount++;
        } else if (order.status === "completed") {
          // احتساب الأرباح الصافية (افترضنا جدلاً اقتطاع 10% عمولة للمنصة و 90% للمزود)
          const totalCost = Number(order.price || 0);
          netEarnings += totalCost * 0.90; 
        }

        providerOrdersList.push(order);
      });

      // تحديث شاشات الأرقام الإحصائية فوراً أمام الخبير
      document.getElementById("totalEarnings").textContent = `$${netEarnings.toFixed(2)}`;
      document.getElementById("pendingOrdersCount").textContent = pendingCount;
      document.getElementById("progressOrdersCount").textContent = progressCount;

      // ترتيب المشاريع حسب الأحدث تلو الأقدم وعرضها بالجدول
      providerOrdersList.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      renderIncomingOrdersTable(providerOrdersList.slice(0, 5));
    }, (error) => {
      console.error("خطأ استقصاء بيانات مشاريع المزود:", error);
    });
  }

  // 3. بناء وتحديث هيكل جدول الطلبات الواردة ديناميكياً مع تفعيل أزرار التحكم بالحالة
  function renderIncomingOrdersTable(orders) {
    const tableBody = document.getElementById("incomingOrdersTableBody");
    
    if (orders.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center; padding: 3rem; color:var(--text-secondary);">
            <i class="fa-solid fa-bell-slashed" style="font-size:2rem; margin-bottom:0.6rem; display:block; color:rgba(255,255,255,0.08)"></i>
            لا توجد طلبات شراء موكلة إليك حالياً في النظام.
          </td>
        </tr>
      `;
      return;
    }

    let html = "";
    orders.forEach(order => {
      const createdDate = order.createdAt ? new Date(order.createdAt.seconds * 1000).toLocaleDateString("ar-EG") : "فوري";
      const providerShare = (Number(order.price || 0) * 0.90).toFixed(2);
      
      let statusClass = "pending";
      let statusLabel = "معلق";
      if (order.status === "progress") { statusClass = "progress"; statusLabel = "جاري العمل"; }
      else if (order.status === "completed") { statusClass = "completed"; statusLabel = "مكتمل"; }
      else if (order.status === "cancelled") { statusClass = "cancelled"; statusLabel = "ملغي"; }

      html += `
        <tr>
          <td style="font-family: monospace; font-weight:700;">#${order.id.substring(0, 8)}</td>
          <td style="font-weight:700;">${order.serviceTitle || "تطوير نموذج ذكي"}</td>
          <td>${order.clientName || "عميل المنصة"}</td>
          <td>${createdDate}</td>
          <td style="font-weight:700; color:var(--success);">$${providerShare}</td>
          <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
          <td>
            <select class="select-status-inline" data-order-id="${order.id}">
              <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>معلق</option>
              <option value="progress" ${order.status === 'progress' ? 'selected' : ''}>جاري العمل</option>
              <option value="completed" ${order.status === 'completed' ? 'selected' : ''}>مكتمل</option>
              <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>إلغاء المشروع</option>
            </select>
          </td>
        </tr>
      `;
    });
    
    tableBody.innerHTML = html;

    // ربط أحداث التغيير الفوري لكل عنصر قائمة منسدلة (Status Change Event)
    const statusSelectors = tableBody.querySelectorAll(".select-status-inline");
    statusSelectors.forEach(selector => {
      selector.addEventListener("change", async (e) => {
        const orderId = e.target.getAttribute("data-order-id");
        const newStatus = e.target.value;
        
        try {
          const orderDocRef = doc(db, "orders", orderId);
          await updateDoc(orderDocRef, {
            status: newStatus,
            updatedAt: serverTimestamp()
          });
          
          // إشعار نجاح داخلي سريع (أو يمكنك استخدام Toast مخصص لاحقاً)
          console.log(`تم تحديث حالة الطلب ${orderId} بنجاح إلى ${newStatus}`);
        } catch (err) {
          console.error("فشل تحديث حالة الطلب السحابي:", err);
          alert("لم نتمكن من تحديث حالة الطلب، يرجى مراجعة اتصال الشبكة.");
        }
      });
    });
  }

  // 4. التحكم في فتح وإغلاق قائمة السايدبار بالهواتف المحمولة
  const toggleSidebar = document.getElementById("toggleSidebar");
  const sidebar = document.getElementById("sidebar");
  if (toggleSidebar && sidebar) {
    toggleSidebar.addEventListener("click", () => sidebar.classList.toggle("open"));
  }

  // 5. تسجيل الخروج الآمن وبناء سجل الأحداث المتزامن
  const logoutBtn = document.getElementById("logoutBtn");
  logoutBtn.addEventListener("click", async () => {
    if (confirm("هل تريد تسجيل الخروج من لوحة التحكم الآمنة؟")) {
      try {
        if (currentProvider) {
          const logRef = doc(db, "logs", `log_${Date.now()}_${currentProvider.uid}`);
          await setDoc(logRef, {
            userId: currentProvider.uid,
            action: "Provider Logout",
            timestamp: serverTimestamp(),
            userAgent: navigator.userAgent
          });
        }
        await signOut(auth);
        window.location.href = "login.html";
      } catch (error) {
        console.error("حدث خطأ أثناء تسجيل الخروج:", error);
      }
    }
  });
});