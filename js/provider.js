// js/provider.js
document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('boostify_token');
    const userStr = localStorage.getItem('boostify_user');

    if (!token || !userStr) {
        window.location.href = 'login.html';
        return;
    }

    const user = JSON.parse(userStr);
    if (user.role !== 'PROVIDER') {
        alert('عذراً، هذه اللوحة مخصصة لمزودي الخدمات والشركاء فقط.');
        window.location.href = 'dashboard.html';
        return;
    }

    document.getElementById('navName').textContent = user.fullName;
    document.getElementById('welcomeMsg').textContent = `مرحباً بك مجدداً شريكنا المطور ${user.fullName}! إليك تقاريرك المالية الحالية.`;

    const addServiceModal = new bootstrap.Modal(document.getElementById('addServiceModal'));
    const withdrawModal = new bootstrap.Modal(document.getElementById('withdrawModal'));

    // تسجيل الخروج
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.clear();
        window.location.href = 'login.html';
    });

    // 1. جلب وتحديث الإحصائيات والأرباح
    async function loadDashboardStats() {
        try {
            const response = await fetch('/api/provider/dashboard-data', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const resData = await response.json();
            if (!response.ok) throw new Error(resData.error);

            const stats = resData.data;
            document.getElementById('providerBalance').textContent = `${stats.balance.toFixed(2)} $`;
            document.getElementById('totalEarnings').textContent = `${stats.totalEarnings.toFixed(2)} $`;
            document.getElementById('servicesCount').textContent = stats.servicesCount;
            document.getElementById('activeSalesCount').textContent = stats.activeSalesCount;

            // تعبئة الطلبات الواردة (المبيعات)
            const salesTbody = document.getElementById('salesTableBody');
            if (stats.recentSales.length > 0) {
                salesTbody.innerHTML = stats.recentSales.map(sale => `
                    <tr>
                        <td><span class="fw-semibold text-white">${sale.service.title}</span></td>
                        <td>
                            <div class="d-flex align-items-center gap-2">
                                <img src="${sale.client.avatarUrl || 'https://via.placeholder.com/150'}" class="rounded-circle" style="width:24px; height:24px;">
                                <span>${sale.client.fullName}</span>
                            </div>
                        </td>
                        <td class="fw-bold text-success">${sale.price.toFixed(2)} $</td>
                        <td class="text-muted small">${new Date(sale.createdAt).toLocaleDateString('ar-EG')}</td>
                        <td><span class="status-badge ${getStatusClass(sale.status)}">${formatStatus(sale.status)}</span></td>
                    </tr>
                `).join('');
            } else {
                salesTbody.innerHTML = `<tr><td colspan="5" class="text-center py-5 text-muted">لم تستقبل مبيعات جديدة في حسابك حتى هذه اللحظة.</td></tr>`;
            }

        } catch (err) {
            console.error('Error loading provider data:', err);
        }
    }

    // 2. جلب وتحديث معرض الخدمات
    async function loadProviderServices() {
        try {
            const response = await fetch('/api/provider/services', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const resData = await response.json();
            const grid = document.getElementById('servicesGrid');

            if (resData.data.length === 0) {
                grid.innerHTML = `<div class="col-12 text-center py-5 text-muted">لا يوجد خدمات منشورة باسمك حالياً. ابدأ بإضافة خدمتك الأولى!</div>`;
                return;
            }

            grid.innerHTML = resData.data.map(service => `
                <div class="col-md-4" id="service-card-${service.id}">
                    <div class="service-card h-100 d-flex flex-column justify-content-between">
                        <div>
                            <img src="${service.imageUrl || 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=600&q=80'}" class="service-img" alt="غلاف الخدمة">
                            <div class="p-3">
                                <span class="badge bg-secondary mb-2">${service.category.name}</span>
                                <h5 class="fw-bold text-white mb-2">${service.title}</h5>
                                <p class="text-muted small mb-0">${service.description.substring(0, 80)}...</p>
                            </div>
                        </div>
                        <div class="p-3 border-top border-secondary d-flex justify-content-between align-items-center">
                            <div>
                                <span class="text-muted small">سعر الخدمة</span>
                                <div class="fw-bold text-success">${service.price.toFixed(2)} $</div>
                            </div>
                            <button class="btn btn-sm btn-outline-danger btn-delete-service" data-id="${service.id}"><i class="fa-solid fa-trash"></i> حذف</button>
                        </div>
                    </div>
                </div>
            `).join('');

            // تفعيل أزرار الحذف الفورية للخدمات
            document.querySelectorAll('.btn-delete-service').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const sId = btn.getAttribute('data-id');
                    if (confirm('هل أنت متأكد من رغبتك بحذف هذه الخدمة الرقمية نهائياً من المعرض؟')) {
                        await deleteService(sId);
                    }
                });
            });

        } catch (err) {
            console.error('Error fetching services:', err);
        }
    }

    // 3. حذف خدمة حقيقي بالربط مع السيرفر وقاعدة البيانات
    async function deleteService(id) {
        try {
            const response = await fetch(`/api/provider/services/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);

            // إزالة العنصر من الواجهة فوراً للتفاعل السريع
            const card = document.getElementById(`service-card-${id}`);
            card.remove();
            await loadDashboardStats(); // لتحديث إجمالي الخدمات

        } catch (err) {
            alert(err.message);
        }
    }

    // 4. جلب التصنيفات لتعبئة القائمة المنسدلة في نافذة الإضافة
    async function loadCategories() {
        try {
            const response = await fetch('/api/provider/categories', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const resData = await response.json();
            const select = document.getElementById('serviceCategory');

            if (resData.data.length > 0) {
                select.innerHTML = `<option value="">اختر القسم المناسب للخدمة...</option>` + 
                resData.data.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('');
            }
        } catch (err) {
            console.error('Error loading categories:', err);
        }
    }

    // 5. إرسال نموذج إضافة الخدمة المتقدم (يدعم رفع الملفات الحقيقي)
    document.getElementById('addServiceForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const title = document.getElementById('serviceTitle').value.trim();
        const categoryId = document.getElementById('serviceCategory').value;
        const price = document.getElementById('servicePrice').value;
        const deliveryTime = document.getElementById('deliveryTime').value;
        const description = document.getElementById('serviceDescription').value.trim();
        const imageFile = document.getElementById('serviceImage').files[0];

        // استخدام FormData لنقل البيانات الثنائية الخاصة بصورة الغلاف
        const formData = new FormData();
        formData.append('title', title);
        formData.append('categoryId', categoryId);
        formData.append('price', price);
        formData.append('deliveryTime', deliveryTime);
        formData.append('description', description);
        if (imageFile) {
            formData.append('image', imageFile);
        }

        const btnPublish = document.getElementById('btnPublish');
        btnPublish.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> جاري النشر...`;
        btnPublish.setAttribute('disabled', 'true');

        try {
            const response = await fetch('/api/provider/services', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData // يرسل الـ FormData مباشرة دون تحديد Content-Type ليتعامل المتصفح معه تلقائياً
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error);

            addServiceModal.hide();
            document.getElementById('addServiceForm').reset();
            
            // تحديث البيانات على الشاشة فوراً
            await loadProviderServices();
            await loadDashboardStats();

        } catch (err) {
            alert(err.message);
        } finally {
            btnPublish.innerHTML = `نشر الخدمة فوراً`;
            btnPublish.removeAttribute('disabled');
        }
    });

    // 6. تأكيد وإرسال طلب سحب الأرباح المالي للسيرفر
    document.getElementById('withdrawForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const amount = document.getElementById('withdrawAmount').value;
        const btn = document.getElementById('btnConfirmWithdraw');

        btn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> جاري التحقق وتسجيل طلب السحب...`;
        btn.setAttribute('disabled', 'true');

        try {
            const response = await fetch('/api/provider/withdraw', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ amount })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error);

            alert(data.message);
            withdrawModal.hide();
            document.getElementById('withdrawForm').reset();
            await loadDashboardStats();

        } catch (err) {
            alert(err.message);
        } finally {
            btn.innerHTML = `تأكيد طلب السحب`;
            btn.removeAttribute('disabled');
        }
    });

    function getStatusClass(status) {
        switch (status) {
            case 'PENDING': return 'status-pending';
            case 'IN_PROGRESS': return 'status-progress';
            case 'COMPLETED': return 'status-completed';
            default: return 'status-cancelled';
        }
    }

    function formatStatus(status) {
        switch (status) {
            case 'PENDING': return 'معلق';
            case 'IN_PROGRESS': return 'جاري التنفيذ';
            case 'COMPLETED': return 'مكتمل';
            default: return 'ملغي';
        }
    }

    // التنفيذ الفوري لتحميل البيانات بمجرد تشغيل الصفحة
    await loadDashboardStats();
    await loadProviderServices();
    await loadCategories();
});