import { supabase, getCurrentUserSession } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. التحقق من صلاحيات الدخول (لغرض هذا المشروع المسطح، سنتحقق من وجود الجلسة فقط)
    // في المشاريع الإنتاجية يتم التحقق من جدول خاص بالصلاحيات (Roles)
    const session = await getCurrentUserSession();
    if (!session) {
        window.location.href = 'login.html';
        return;
    }

    // 2. تشغيل وظائف الإدارة
    await loadAllPlatformOrders();
    await loadCategoriesDropdown();

    // 3. التقاط حدث إرسال نموذج الخدمة الجديدة
    document.getElementById('add-service-form').addEventListener('submit', handleAddNewService);
});

// ==========================================
// إدارة الطلبات (Orders Management)
// ==========================================
async function loadAllPlatformOrders() {
    const tbody = document.getElementById('admin-orders-body');
    
    try {
        const { data: orders, error } = await supabase
            .from('orders')
            .select(`
                id, price, status, created_at,
                services ( title )
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!orders || orders.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">لا توجد طلبات في النظام حتى الآن.</td></tr>`;
            return;
        }

        tbody.innerHTML = '';
        orders.forEach(order => {
            const dateStr = new Date(order.created_at).toLocaleDateString('ar-EG');
            const tr = document.createElement('tr');
            
            tr.innerHTML = `
                <td style="font-family:monospace;">#${order.id}</td>
                <td>${order.services?.title || 'خدمة مجهولة'}</td>
                <td style="color:var(--success); font-weight:bold;">$${order.price}</td>
                <td>${dateStr}</td>
                <td>
                    <select class="status-select" data-order-id="${order.id}">
                        <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>قيد الانتظار</option>
                        <option value="processing" ${order.status === 'processing' ? 'selected' : ''}>جاري التنفيذ</option>
                        <option value="completed" ${order.status === 'completed' ? 'selected' : ''}>مكتمل</option>
                        <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>ملغي</option>
                    </select>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // تفعيل استشعار التغيير في حالة الطلب
        document.querySelectorAll('.status-select').forEach(select => {
            select.addEventListener('change', async (e) => {
                const orderId = e.target.getAttribute('data-order-id');
                const newStatus = e.target.value;
                await updateOrderStatus(orderId, newStatus, e.target);
            });
        });

    } catch (err) {
        console.error("Error loading orders:", err);
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4" style="color:var(--danger)">حدث خطأ أثناء جلب البيانات.</td></tr>`;
    }
}

async function updateOrderStatus(orderId, newStatus, selectElement) {
    selectElement.disabled = true;
    try {
        const { error } = await supabase
            .from('orders')
            .update({ status: newStatus })
            .eq('id', orderId);

        if (error) throw error;
        alert(`تم تحديث حالة الطلب #${orderId} بنجاح.`);
    } catch (err) {
        alert("فشل تحديث الحالة: " + err.message);
    } finally {
        selectElement.disabled = false;
    }
}

// ==========================================
// إدارة الخدمات (Services Management)
// ==========================================
async function loadCategoriesDropdown() {
    const select = document.getElementById('srv-category');
    try {
        const { data: categories, error } = await supabase.from('categories').select('id, name');
        if (error) throw error;

        select.innerHTML = '<option value="" disabled selected>-- اختر الفئة --</option>';
        categories.forEach(cat => {
            select.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
        });
    } catch (err) {
        console.error("Error loading categories:", err);
        select.innerHTML = '<option value="">فشل جلب الفئات</option>';
    }
}

async function handleAddNewService(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-add-service');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري النشر...';

    const newService = {
        title: document.getElementById('srv-title').value.trim(),
        category_id: document.getElementById('srv-category').value,
        price: Number(document.getElementById('srv-price').value),
        image_url: document.getElementById('srv-image').value.trim(),
        description: document.getElementById('srv-desc').value.trim(),
        created_at: new Date().toISOString()
    };

    try {
        const { error } = await supabase.from('services').insert([newService]);
        if (error) throw error;

        alert("🎉 تم نشر الخدمة الجديدة في السوق بنجاح!");
        document.getElementById('add-service-form').reset();
    } catch (err) {
        alert("فشل إضافة الخدمة: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> نشر الخدمة في السوق';
    }
}