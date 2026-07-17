import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  doc, 
  getDoc, 
  collection, 
  query, 
  getDocs, 
  addDoc, 
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
  let currentUser = null;
  let currentUserRole = null;
  let selectedService = null;

  // 1. مراقبة حالة تسجيل دخول العميل وحظر غير المصرح لهم
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }

    currentUser = user;
    const userDocRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists()) {
      const userData = userDoc.data();
      currentUserRole = userData.role;

      // تحديث بيانات السايدبار
      document.getElementById("userFullName").textContent = userData.fullName || "عضو المنصة";
      document.getElementById("userRole").textContent = currentUserRole === "client" ? "عميل مميز" : "خبير ذكاء اصطناعي";
      if (userData.avatarUrl) {
        document.getElementById("userAvatar").src = userData.avatarUrl;
      }

      // تعديل مسار رابط لوحة التحكم في السايدبار بناءً على رتبة العضو
      const navDashboardLink = document.getElementById("navDashboardLink");
      if (currentUserRole === "provider") {
        navDashboardLink.href = "provider-dashboard.html";
      } else {
        navDashboardLink.href = "dashboard.html";
      }
    }

    // تهيئة البيانات والبدء بسحب الخدمات المتوفرة
    await initializeServicesCatalog();
  });

  // 2. تصفية وبناء سوق الخدمات تلقائياً عند الدخول الأول للمنصة (Bootstrap / Pre-population)
  async function initializeServicesCatalog() {
    const servicesGrid = document.getElementById("servicesGrid");
    const servicesRef = collection(db, "services");
    
    let snapshot = await getDocs(servicesRef);

    // للتسهيل وسهولة الاختبار: إذا كانت قاعدة البيانات فارغة، نقوم بزرع 3 خدمات افتراضية ممتازة
    if (snapshot.empty) {
      const defaultServices = [
        {
          title: "تطوير روبوت محادثة مخصص ذكي (GPT-4o)",
          description: "بناء نظام شات متقدم مدعوم بذكاء GPT-4o لخدمة العملاء على موقعك مع ربطه بملفات شركتك عبر الـ RAG.",
          price: 249.00,
          category: "nlp",
          providerId: "Hk7W9Yx64dPfRz21", // معرّف خبير افتراضي
          providerName: "م. أحمد الشافعي",
          providerAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80"
        },
        {
          title: "تدريب نموذج رؤية حاسوبية فريد (YOLOv8)",
          description: "تدريب نموذج فائق الدقة لاكتشاف المنتجات المعيبة في خطوط الإنتاج والتعرف على كائنات الفحص الفني.",
          price: 480.00,
          category: "vision",
          providerId: "Hk7W9Yx64dPfRz21",
          providerName: "م. أحمد الشافعي",
          providerAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80"
        },
        {
          title: "دمج واجهات API الذكية وبناء سير عمل ذكي",
          description: "ربط أنظمتك الحالية بمعالجات الصور والنصوص من OpenAI و Anthropic لتشغيل آليات المهام المعقدة تلقائياً.",
          price: 180.00,
          category: "integration",
          providerId: "Hk7W9Yx64dPfRz21",
          providerName: "م. أحمد الشافعي",
          providerAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80"
        }
      ];

      for (const service of defaultServices) {
        await addDoc(servicesRef, service);
      }
      snapshot = await getDocs(servicesRef);
    }

    renderServices(snapshot);
  }

  // 3. عرض الخدمات في شبكة الكتالوج
  function renderServices(snapshot) {
    const servicesGrid = document.getElementById("servicesGrid");
    servicesGrid.innerHTML = "";

    snapshot.forEach((serviceDoc) => {
      const service = serviceDoc.data();
      service.id = serviceDoc.id;

      const card = document.createElement("div");
      card.className = "service-card";
      card.setAttribute("data-category", service.category);

      let categoryLabel = "عام";
      if (service.category === "nlp") categoryLabel = "معالجة لغات";
      else if (service.category === "vision") categoryLabel = "رؤية حاسوبية";
      else if (service.category === "integration") categoryLabel = "دمج النماذج";

      card.innerHTML = `
        <div>
          <div class="service-card-header">
            <span class="service-category-badge">${categoryLabel}</span>
            <span class="service-price-tag">$${Number(service.price).toFixed(2)}</span>
          </div>
          <h3 class="service-title">${service.title}</h3>
          <p class="service-desc">${service.description}</p>
        </div>
        <div>
          <div class="service-provider-info">
            <img src="${service.providerAvatar || 'https://via.placeholder.com/150'}" alt="صورة المزود">
            <span>الخبير: ${service.providerName || "خبير معتمد"}</span>
          </div>
          <button class="order-service-btn" data-service-id="${service.id}">طلب الخدمة والبدء</button>
        </div>
      `;

      // نقر المستخدم على زر الشراء
      card.querySelector(".order-service-btn").addEventListener("click", () => {
        triggerCheckoutModal(service);
      });

      servicesGrid.appendChild(card);
    });
  }

  // 4. تفعيل فلترة الخدمات بحسب الأقسام
  const filterChips = document.querySelectorAll(".filter-chip");
  filterChips.forEach(chip => {
    chip.addEventListener("click", (e) => {
      filterChips.forEach(c => c.classList.remove("active"));
      e.target.classList.add("active");

      const category = e.target.getAttribute("data-category");
      const cards = document.querySelectorAll(".service-card");

      cards.forEach(card => {
        if (category === "all" || card.getAttribute("data-category") === category) {
          card.style.display = "flex";
        } else {
          card.style.display = "none";
        }
      });
    });
  });

  // 5. نافذة Stripe التفاعلية وعملية تحديث البطاقة الفورية
  const stripeModal = document.getElementById("stripeModal");
  const closeStripeModal = document.getElementById("closeStripeModal");

  function triggerCheckoutModal(service) {
    selectedService = service;
    
    // حقن معلومات الفاتورة والخدمة المحددة بالنافذة
    document.getElementById("checkoutServiceTitle").textContent = service.title;
    document.getElementById("checkoutServicePrice").textContent = `$${Number(service.price).toFixed(2)}`;

    // إعادة تعيين البطاقة واستمارة المدخلات
    document.getElementById("stripePaymentForm").reset();
    document.getElementById("cardNumDisplay").textContent = "•••• •••• •••• ••••";
    document.getElementById("cardHolderDisplay").textContent = "BOOSTIFY CLIENT";
    document.getElementById("cardExpiryDisplay").textContent = "MM/YY";

    stripeModal.classList.remove("hidden");
  }

  // إغلاق النافذة
  closeStripeModal.addEventListener("click", () => {
    stripeModal.classList.add("hidden");
  });

  // ربط حركة وتعبئة أرقام البطاقة مع العرض البصري المباشر
  document.getElementById("cardNumber").addEventListener("input", (e) => {
    let value = e.target.value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    let matches = value.match(/\d{4,16}/g);
    let match = matches && matches[0] || '';
    let parts = [];

    for (let i=0, len=match.length; i<len; i+=4) {
      parts.push(match.substring(i, i+4));
    }

    if (parts.length > 0) {
      e.target.value = parts.join(' ');
      document.getElementById("cardNumDisplay").textContent = parts.join(' ');
    } else {
      e.target.value = value;
      document.getElementById("cardNumDisplay").textContent = "•••• •••• •••• ••••";
    }
  });

  document.getElementById("cardName").addEventListener("input", (e) => {
    const val = e.target.value.toUpperCase();
    document.getElementById("cardHolderDisplay").textContent = val || "BOOSTIFY CLIENT";
  });

  document.getElementById("cardExpiry").addEventListener("input", (e) => {
    let val = e.target.value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (val.length >= 2) {
      e.target.value = val.substring(0,2) + '/' + val.substring(2,4);
    }
    document.getElementById("cardExpiryDisplay").textContent = e.target.value || "MM/YY";
  });

  // 6. استكمال معالجة الدفع السحابي (Stripe Processing Sandbox)
  const paymentForm = document.getElementById("stripePaymentForm");
  paymentForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!selectedService || !currentUser) return;

    const payBtn = document.getElementById("stripePayBtn");
    const paySpinner = document.getElementById("payBtnSpinner");
    const payText = document.getElementById("payBtnText");

    // تشغيل وضع الانتظار البصري لمحاكاة الاتصال بخوادم البنك والدفع
    payBtn.disabled = true;
    paySpinner.classList.remove("hidden");
    payText.classList.add("hidden");

    setTimeout(async () => {
      try {
        // أ) إنشاء الطلب الجديد في فرع "orders" بداخل Firestore
        const ordersRef = collection(db, "orders");
        const newOrderDoc = await addDoc(ordersRef, {
          clientId: currentUser.uid,
          clientName: document.getElementById("userFullName").textContent,
          providerId: selectedService.providerId,
          providerName: selectedService.providerName,
          serviceId: selectedService.id,
          serviceTitle: selectedService.title,
          price: selectedService.price,
          status: "pending", // حالة معلقة بانتظار استلام المزود للعمل
          createdAt: serverTimestamp(),
          paymentStatus: "paid", // مدفوع ومؤمن
          cardLast4: document.getElementById("cardNumber").value.slice(-4) || "4242"
        });

        // ب) إنشاء وتأسيس غرفة محادثة سحابية جديدة للمشروع لربط الطرفين معاً فوراً
        const chatsRef = collection(db, "chats");
        await addDoc(chatsRef, {
          participants: [currentUser.uid, selectedService.providerId],
          lastMessage: `تم تأكيد شراء الخدمة: "${selectedService.title}". تواصل الآن لبدء العمل!`,
          lastMessageTime: serverTimestamp(),
          unreadCount: {
            [currentUser.uid]: 0,
            [selectedService.providerId]: 1
          }
        });

        // إغلاق نافذة الدفع وإظهار إشعار النجاح والتوجيه التلقائي
        stripeModal.classList.add("hidden");
        alert("🎉 تم تأكيد معاملتك المالية وحجز خدمتك بنجاح! تم إحالة الطلب مباشرة للخبير وفتح غرفة عمل فورية لكما.");
        
        // التوجيه التلقائي للوحة تحكم العميل لمتابعة سير المشروع
        window.location.href = "dashboard.html";

      } catch (err) {
        console.error("فشل تأكيد عملية الشراء:", err);
        alert("حدث خطأ في الشبكة أثناء إرسال المعاملة المالية. يرجى المحاولة لاحقاً.");
      } finally {
        // إعادة تهيئة الأزرار
        payBtn.disabled = false;
        paySpinner.classList.add("hidden");
        payText.classList.remove("hidden");
      }
    }, 2500); // محاكاة زمن تأكيد الدفع لثانيتين ونصف لإعطاء إحساس بالأمان والتحقق الفعلي
  });

  // 7. تحسين التجاوب للسايدبار
  const toggleBtn = document.getElementById("toggleSidebar");
  const sidebar = document.getElementById("sidebar");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      sidebar.classList.toggle("open");
    });
  }

  // 8. تسجيل الخروج
  const logoutBtn = document.getElementById("logoutBtn");
  logoutBtn.addEventListener("click", async () => {
    if (confirm("هل تريد تسجيل الخروج؟")) {
      await signOut(auth);
      window.location.href = "login.html";
    }
  });
});