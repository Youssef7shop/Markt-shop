// js/chat.js
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('boostify_token');
    const currentUserStr = localStorage.getItem('boostify_user');

    if (!token || !currentUserStr) {
        window.location.href = 'login.html';
        return;
    }

    const currentUser = JSON.parse(currentUserStr);
    let selectedUserId = null;
    let socket = null;
    let typingTimeout = null;

    // 1. الاتصال بـ Socket.IO Server
    try {
        socket = io({
            auth: { token: token }
        });

        socket.on('connect', () => {
            console.log('✔ تم الاتصال بنجاح بـ Socket.IO Server');
        });

        socket.on('connect_error', (err) => {
            console.error('فشل في مصادقة الـ Socket:', err.message);
        });
    } catch (e) {
        console.error('Error initializing Socket.IO:', e);
    }

    // 2. استقبال الرسائل المباشرة بداخل غرف الاتصال
    socket.on('receive_message', (msg) => {
        // إذا كان الطرف المستلم للرسالة هو المستخدم النشط حالياً في المحادثة المفتوحة
        if (msg.senderId === selectedUserId || msg.senderId === currentUser.id) {
            appendMessage(msg);
            scrollChatToBottom();

            // إذا استلمنا الرسالة من الطرف الآخر وكان هو المحدد حالياً، نخبر السيرفر فوراً بأننا رأيناها
            if (msg.senderId === selectedUserId) {
                socket.emit('mark_seen', { senderId: selectedUserId });
            }
        } else {
            // إذا كنا بصفحة المحادثة لكن في شاشة أخرى، نقوم فقط بتحديث أعداد الرسائل غير المقروءة في القائمة الجانبية
            loadContacts();
        }
    });

    // 3. استقبال حالة الكتابة الفورية
    socket.on('user_typing', ({ senderId, isTyping }) => {
        if (senderId === selectedUserId) {
            const indicator = document.getElementById('typingIndicator');
            indicator.textContent = isTyping ? 'يكتب الآن...' : '';
        }
    });

    // 4. استقبال مؤشر القراءة الفوري (Seen) من الطرف الآخر
    socket.on('messages_seen', ({ seenBy }) => {
        if (seenBy === selectedUserId) {
            // تحديث كافة الرسائل المرسلة من قبلي لتصبح بلون القراءة
            document.querySelectorAll('.msg-status-icon').forEach(icon => {
                icon.className = 'fa-solid fa-check-double seen-indicator msg-status-icon';
            });
        }
    });

    // جلب قائمة جهات الاتصال النشطة
    async function loadContacts() {
        try {
            const response = await fetch('/api/chat/contacts', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const res = await response.json();
            const container = document.getElementById('contactsContainer');

            if (!res.success || res.data.length === 0) {
                container.innerHTML = `<div class="text-center p-4 text-muted small">لا توجد محادثات سابقة.</div>`;
                return;
            }

            container.innerHTML = res.data.map(item => `
                <div class="contact-card ${item.user.id === selectedUserId ? 'active' : ''}" data-id="${item.user.id}" data-name="${item.user.fullName}" data-role="${item.user.role}">
                    <img src="https://via.placeholder.com/150" alt="Contact Avatar" class="user-avatar">
                    <div class="flex-grow-1 overflow-hidden">
                        <div class="d-flex justify-content-between align-items-center">
                            <h6 class="text-white mb-0 text-truncate fw-semibold small">${item.user.fullName}</h6>
                            ${item.unreadCount > 0 ? `<span class="badge bg-danger rounded-pill" style="font-size:0.75rem">${item.unreadCount}</span>` : ''}
                        </div>
                        <p class="text-muted text-truncate mb-0 small mt-1">${item.lastMessage}</p>
                    </div>
                </div>
            `).join('');

            // تفعيل التنقل بين جهات الاتصال
            document.querySelectorAll('.contact-card').forEach(card => {
                card.addEventListener('click', () => {
                    const id = card.getAttribute('data-id');
                    const name = card.getAttribute('data-name');
                    const role = card.getAttribute('data-role');
                    selectContact(id, name, role);
                });
            });

        } catch (err) {
            console.error(err);
        }
    }

    // تحديد وبدء التراسل مع جهة اتصال
    async function selectContact(id, name, role) {
        selectedUserId = id;

        // إظهار واجهة المحادثة النشطة وإخفاء رسالة الترحيب الأولى
        document.getElementById('chatMainPlaceholder').classList.add('d-none');
        document.getElementById('chatActiveContainer').classList.remove('d-none');

        document.getElementById('activeChatName').textContent = name;
        document.getElementById('activeChatRole').textContent = role;

        // تحديث نشاط الكلاس المختار في الشريط الجانبي
        document.querySelectorAll('.contact-card').forEach(c => c.classList.remove('active'));
        const activeCard = document.querySelector(`.contact-card[data-id="${id}"]`);
        if (activeCard) activeCard.classList.add('active');

        // الانضمام لغرفة المحادثة الخاصة مع هذا الشخص
        socket.emit('join_chat', { receiverId: id });

        // إعلام الطرف الآخر فوراً بقراءة الرسائل السابقة الموجهة منه إلينا
        socket.emit('mark_seen', { senderId: id });

        // جلب سجل المحادثة من قاعدة البيانات
        await fetchMessages(id);
        loadContacts(); // إعادة تحميل القائمة الجانبية لتحديث أرقام الرسائل غير المقروءة
    }

    // جلب الرسائل المخزنة تاريخياً
    async function fetchMessages(otherUserId) {
        try {
            const response = await fetch(`/api/chat/history/${otherUserId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const res = await response.json();
            const container = document.getElementById('messagesContainer');
            container.innerHTML = '';

            res.data.forEach(msg => {
                appendMessage(msg);
            });

            scrollChatToBottom();
        } catch (err) {
            console.error('Error fetching chat history:', err);
        }
    }

    // توليد عناصر الرسالة بداخل صندوق الرسائل
    function appendMessage(msg) {
        const container = document.getElementById('messagesContainer');
        const isSentByMe = msg.senderId === currentUser.id;

        const bubble = document.createElement('div');
        bubble.className = `message-bubble ${isSentByMe ? 'sent' : 'received'}`;
        
        const time = new Date(msg.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

        // تحديد أيقونة القراءة التفاعلية
        let statusIcon = '';
        if (isSentByMe) {
            statusIcon = msg.isRead 
                ? '<i class="fa-solid fa-check-double seen-indicator msg-status-icon"></i>' 
                : '<i class="fa-solid fa-check unseen msg-status-icon"></i>';
        }

        bubble.innerHTML = `
            <div>${escapeHTML(msg.content)}</div>
            <div class="message-meta">
                <span>${time}</span>
                ${statusIcon}
            </div>
        `;

        container.appendChild(bubble);
    }

    function scrollChatToBottom() {
        const container = document.getElementById('messagesContainer');
        container.scrollTop = container.scrollHeight;
    }

    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g, 
            tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
        );
    }

    // 5. حدث إرسال الرسالة من النموذج (Form Submit)
    document.getElementById('chatForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('messageInput');
        const content = input.value.trim();

        if (!content || !selectedUserId) return;

        // إرسال الرسالة فورا للسيرفر عبر السوكيت لحفظها وتوزيعها فورا
        socket.emit('send_message', {
            receiverId: selectedUserId,
            content: content
        });

        input.value = '';
        
        // إبلاغ السيرفر بإيقاف الكتابة بعد الإرسال مباشرة
        socket.emit('typing', { receiverId: selectedUserId, isTyping: false });
    });

    // 6. التعامل مع إشعار حالة الكتابة (Typing Notification)
    const inputField = document.getElementById('messageInput');
    inputField.addEventListener('input', () => {
        if (!selectedUserId) return;

        // إرسال حالة الكتابة الفعالة
        socket.emit('typing', { receiverId: selectedUserId, isTyping: true });

        // إيقاف إشعار الكتابة تلقائياً بعد مرور ثانيتين من التوقف عن الضغط على الأزرار
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            socket.emit('typing', { receiverId: selectedUserId, isTyping: false });
        }, 2000);
    });

    // التحميل الأولي للمحادثات عند تشغيل الصفحة
    await loadContacts();
});