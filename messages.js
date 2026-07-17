import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  doc, 
  getDoc, 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc,
  serverTimestamp,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
  let currentUser = null;
  let currentUserRole = null;
  let activeChatId = null;
  let activeUnsubscribe = null; // للاشتراك اللحظي في الرسائل

  // 1. التحقق من الهوية وبناء معلومات المستخدم الحالية
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

      // ضبط السايدبار
      document.getElementById("userFullName").textContent = userData.fullName || "مستخدم غير معروف";
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

      // تحميل غرف المحادثة المباشرة
      initRealtimeRooms(user.uid);
    }
  });

  // 2. مستمع غرف الدردشة في الوقت الفعلي (Realtime Chat Rooms Listener)
  function initRealtimeRooms(userId) {
    const roomsRef = collection(db, "chats");
    // استدعاء الغرف التي تشمل معرف المستخدم الحالي ضمن المشاركين
    const q = query(roomsRef, where("participants", "array-contains", userId));

    onSnapshot(q, async (snapshot) => {
      const roomsContainer = document.getElementById("roomsContainer");
      
      if (snapshot.empty) {
        roomsContainer.innerHTML = `
          <div class="rooms-loading" style="padding: 2.5rem 1rem;">
            لا توجد غرف محادثة نشطة حالياً.
          </div>
        `;
        return;
      }

      roomsContainer.innerHTML = ""; // تصفية شاشة التحميل

      // استخدام مصفوفة وعود لجلب بيانات الطرف الآخر في كل غرفة بالتوازي
      const roomPromises = [];
      snapshot.forEach((roomDoc) => {
        const roomData = roomDoc.data();
        roomData.id = roomDoc.id;
        
        // تحديد معرف الطرف الآخر من الغرفة
        const otherParticipantId = roomData.participants.find(id => id !== userId);
        
        const fetchPartnerMeta = async () => {
          const partnerDocRef = doc(db, "users", otherParticipantId);
          const partnerDoc = await getDoc(partnerDocRef);
          return {
            room: roomData,
            partner: partnerDoc.exists() ? partnerDoc.data() : { fullName: "مستخدم محذوف", role: "غير متوفر" }
          };
        };
        roomPromises.push(fetchPartnerMeta());
      });

      const resolvedRooms = await Promise.all(roomPromises);

      // ترتيب الغرف تنازلياً حسب توقيت آخر رسالة مرسلة
      resolvedRooms.sort((a, b) => {
        const timeA = a.room.lastMessageTime?.seconds || 0;
        const timeB = b.room.lastMessageTime?.seconds || 0;
        return timeB - timeA;
      });

      resolvedRooms.forEach(({ room, partner }) => {
        const roomItem = document.createElement("div");
        roomItem.className = `room-item ${room.id === activeChatId ? 'active' : ''}`;
        roomItem.setAttribute("data-chat-id", room.id);

        const lastMsgText = room.lastMessage || "لا توجد رسائل سابقة";
        const msgTime = room.lastMessageTime ? new Date(room.lastMessageTime.seconds * 1000).toLocaleTimeString("ar-EG", { hour: '2-digit', minute: '2-digit' }) : "";
        const unreadCount = room.unreadCount && room.unreadCount[userId] ? room.unreadCount[userId] : 0;

        roomItem.innerHTML = `
          <div class="room-avatar-wrapper">
            <img src="${partner.avatarUrl || 'https://via.placeholder.com/150'}" alt="الطرف الآخر">
          </div>
          <div class="room-details">
            <div class="room-meta-header">
              <span class="room-partner-name">${partner.fullName}</span>
              <span class="room-time">${msgTime}</span>
            </div>
            <div class="room-bottom-preview">
              <span class="room-last-msg-preview">${lastMsgText}</span>
              ${unreadCount > 0 ? `<span class="room-unread-count">${unreadCount}</span>` : ""}
            </div>
          </div>
        `;

        // نقر المستخدم على المحادثة لفتحها
        roomItem.addEventListener("click", () => {
          openChatRoom(room.id, partner);
        });

        roomsContainer.appendChild(roomItem);
      });
    });
  }

  // 3. فتح غرفة الدردشة وتحميل الرسائل السحابية
  function openChatRoom(chatId, partnerData) {
    activeChatId = chatId;
    
    // إدارة الواجهات المتجاوبة للهواتف
    const mainContainer = document.querySelector(".chat-main-container");
    mainContainer.classList.add("chat-active");

    // إخفاء الحالة الافتراضية وإظهار نافذة الشات
    document.getElementById("chatEmptyState").classList.add("hidden");
    document.getElementById("chatActiveBox").classList.remove("hidden");

    // تحديث بيانات الترويسة العليا للمستقبل
    document.getElementById("activePartnerName").textContent = partnerData.fullName;
    document.getElementById("activePartnerRole").textContent = partnerData.role === "provider" ? "خبير ذكاء اصطناعي" : "عميل مميز";
    document.getElementById("activePartnerAvatar").src = partnerData.avatarUrl || 'https://via.placeholder.com/150';

    // إعادة تعيين قراءة الرسائل لهذه الغرفة
    markRoomAsRead(chatId);

    // تحديث تمييز الغرفة النشطة في الجانب الأيمن
    document.querySelectorAll(".room-item").forEach(item => {
      item.classList.remove("active");
      if (item.getAttribute("data-chat-id") === chatId) {
        item.classList.add("active");
      }
    });

    // تنظيف المستمع السابق للرسائل إن وُجد
    if (activeUnsubscribe) {
      activeUnsubscribe();
    }

    // فتح اشتراك فوري في فرع رسائل هذه الغرفة
    const messagesRef = collection(db, "chats", chatId, "messages");
    const q = query(messagesRef, orderBy("createdAt", "asc"));

    activeUnsubscribe = onSnapshot(q, (snapshot) => {
      const messagesArea = document.getElementById("chatMessagesArea");
      messagesArea.innerHTML = "";

      snapshot.forEach((msgDoc) => {
        const msg = msgDoc.data();
        const isOutgoing = msg.senderId === currentUser.uid;
        const msgWrapper = document.createElement("div");
        msgWrapper.className = `msg-bubble-wrapper ${isOutgoing ? 'outgoing' : 'incoming'}`;

        const msgTime = msg.createdAt ? new Date(msg.createdAt.seconds * 1000).toLocaleTimeString("ar-EG", { hour: '2-digit', minute: '2-digit' }) : "";

        msgWrapper.innerHTML = `
          <div class="msg-bubble">
            <p>${msg.text}</p>
            <span class="msg-time">${msgTime}</span>
          </div>
        `;
        messagesArea.appendChild(msgWrapper);
      });

      // النزول التلقائي لنهاية الرسائل (Scroll to bottom)
      messagesArea.scrollTop = messagesArea.scrollHeight;
    });
  }

  // 4. إرسال الرسالة النصية وحقنها في السحاب
  const messageForm = document.getElementById("chatMessageForm");
  const messageInput = document.getElementById("chatMessageInput");

  messageForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const textToSend = messageInput.value.trim();
    if (!textToSend || !activeChatId) return;

    messageInput.value = ""; // تفريغ الحقل فوراً

    try {
      // أ) إضافة الرسالة إلى الـ Subcollection
      const messagesRef = collection(db, "chats", activeChatId, "messages");
      await addDoc(messagesRef, {
        senderId: currentUser.uid,
        text: textToSend,
        createdAt: serverTimestamp()
      });

      // ب) تحديث السطر العلوي للغرفة الرئيسية (Last Message) والعدادات
      const chatDocRef = doc(db, "chats", activeChatId);
      const chatSnapshot = await getDoc(chatDocRef);
      const chatData = chatSnapshot.data();
      
      const otherParticipantId = chatData.participants.find(id => id !== currentUser.uid);
      
      // زيادة عدد الرسائل غير المقروءة للطرف الآخر
      const currentUnreads = chatData.unreadCount || {};
      currentUnreads[otherParticipantId] = (currentUnreads[otherParticipantId] || 0) + 1;

      await updateDoc(chatDocRef, {
        lastMessage: textToSend,
        lastMessageTime: serverTimestamp(),
        unreadCount: currentUnreads
      });

    } catch (err) {
      console.error("فشل إرسال الرسالة:", err);
    }
  });

  // 5. تصفير العداد عند دخول الغرفة
  async function markRoomAsRead(chatId) {
    try {
      const chatDocRef = doc(db, "chats", chatId);
      const chatSnapshot = await getDoc(chatDocRef);
      if (chatSnapshot.exists()) {
        const chatData = chatSnapshot.data();
        const unreads = chatData.unreadCount || {};
        unreads[currentUser.uid] = 0; // تصفير عداد الرسائل الخاصة بالمستخدم الحالي
        
        await updateDoc(chatDocRef, {
          unreadCount: unreads
        });
      }
    } catch (err) {
      console.error("فشل تصفير عداد القراءة:", err);
    }
  }

  // 6. زر الرجوع للهواتف
  const closeChatMobileBtn = document.getElementById("closeChatMobileBtn");
  if (closeChatMobileBtn) {
    closeChatMobileBtn.addEventListener("click", () => {
      const mainContainer = document.querySelector(".chat-main-container");
      mainContainer.classList.remove("chat-active");
      if (activeUnsubscribe) {
        activeUnsubscribe();
      }
      activeChatId = null;
    });
  }

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
    if (confirm("هل تريد مغادرة المحادثة وتسجيل الخروج؟")) {
      await signOut(auth);
      window.location.href = "login.html";
    }
  });
});