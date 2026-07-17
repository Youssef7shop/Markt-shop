import { supabase, getCurrentUserSession, logSystemActivity } from './supabase.js';

let currentClientSession = null;

document.addEventListener('DOMContentLoaded', async () => {
    currentClientSession = await getCurrentUserSession();
    
    // قراءة الفلترة إن وجدت في رابط URL (مثال: القادمة من صفحة الفئات)
    const urlParams = new URLSearchParams(window.location.search);
    const categoryFilter = urlParams.get('cat');

    await fetchMarketplaceServices(categoryFilter);

    // تفعيل محرك البحث النصي اليدوي
    document.getElementById('btn-search').addEventListener('click', () => {
        const query = document.getElementById('search-input').value.trim();
        fetchMarketplaceServices(null, query);
    });
});

async function fetchMarketplaceServices(catId = null, searchQuery = null) {
    const container = document.getElementById('services-marketplace-container');
    container.innerHTML = `<div class="loading-cell-full"><i class="fa-solid fa-circle-notch fa-spin"></i> جاري استدعاء البيانات المحدثة...</div>`;

    try {
        let queryBuilder = supabase.from('services').select('*');

        if (catId) {
            queryBuilder = queryBuilder.eq('category_id', catId);
        }
        if (searchQuery) {
            queryBuilder = queryBuilder.ilike('title', `%${searchQuery}%`);
        }

        const { data: services, error } = await queryBuilder.order('created_at', { ascending: false });
        if (error) throw error;

        if (!services || services.length === 0) {
            container.innerHTML = `<div class="loading-cell-full">لا توجد خدمات مطابقة لبحثك في الوقت الحالي.</div>`;
            return;
        }

        container.innerHTML = '';
        services.forEach(srv => {
            const card = document.createElement('div');
            card.className = 'service-card';
            card.innerHTML = `
                <img class="service-banner" src="${srv.image_url || 'https://via.placeholder.com/350x160'}" alt="Service Image">
                <div class="service-body">
                    <h4>${srv.title}</h4>
                    <p>${srv.description}</p>
                </div>
                <div class="service-footer">
                    <span class="service-price">$${Number(srv.price).toFixed(2)}</span>
                    <button class="btn-buy-service" data-id="${srv.id}" data-price="${srv.price}">
                        <i class="fa-solid fa-bolt"></i> شراء الخدمة
                    </button>
                </div>
            `;
            container.appendChild(card);
        });

        // ربط أكواد الشراء الفورية بجميع الأزرار المستحدثة بكفاءة دقيقة
        document.querySelectorAll('.btn-buy-service').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const srvId = e.target.getAttribute('data-id');
                const srvPrice = Number(e.target.getAttribute('data-price'));
                await executePurchaseOperation(srvId, srvPrice);
            });
        });

    } catch (err) {
        console.error(err);
        container.innerHTML = `<div class="loading-cell-full" style="color:var(--danger)">فشل جلب البيانات: ${err.message}</div>`;
    }
}

// محرك الخصم والشراء وإصدار الفواتير الفوري الحقيقي (Transactional-like Execution Flow)
async function executePurchaseOperation(serviceId, price) {
    if (!currentClientSession) {
        alert("يرجى تسجيل الدخول أولاً لتتمكن من شراء الخدمات الذكية الحية.");
        window.location.href = 'login.html';
        return;
    }

    const confirmOrder = confirm(`هل أنت متأكد من شراء هذه الخدمة بقيمة $${price.toFixed(2)}؟ سيتم مراجعة رصيد محفظتك الرقمية والخصم فوراً.`);
    if (!confirmOrder) return;

    try {
        const userId = currentClientSession.auth.id;

        // 1. فحص رصيد محفظة العميل من قاعدة البيانات لمنع عمليات الاحتيال أو الرصيد السالب
        const { data: wallet, error: walletErr } = await supabase
            .from('wallets')
            .select('balance')
            .eq('user_id', userId)
            .single();

        if (walletErr) throw new Error("تعذر الوصول إلى سجلات محفظتك الرقمية.");
        if (!wallet || wallet.balance < price) {
            alert("⚠️ عذراً! رصيدك الحالي غير كافٍ لإتمام عملية الشراء. يرجى شحن محفظتك أولاً.");
            return;
        }

        // 2. خصم المبلغ آلياً وتحديث سجل المحفظة الرقمية للمستخدم بالرصيد المتبقي الجديد
        const newBalance = wallet.balance - price;
        const { error: updateWalletErr } = await supabase
            .from('wallets')
            .update({ balance: newBalance, updated_at: new Date().toISOString() })
            .eq('user_id', userId);

        if (updateWalletErr) throw updateWalletErr;

        // 3. إنشاء وإدراج سجل طلب الشراء الجديد كلياً داخل جدول orders وتعيين حالته المبدئية كـ pending
        const { error: orderErr } = await supabase
            .from('orders')
            .insert([{
                user_id: userId,
                service_id: serviceId,
                price: price,
                status: 'pending',
                created_at: new Date().toISOString()
            }]);

        if (orderErr) throw orderErr;

        await logSystemActivity('User Completed Service Purchase Transaction and Debited Wallet Successfully');
        alert("🎉 مبروك! تمت عملية الشراء بنجاح وخصم القيمة من محفظتك. يمكنك متابعة مرحلة الإنجاز من لوحة التحكم.");
        window.location.href = 'orders.html';

    } catch (err) {
        alert("خطأ أثناء معالجة عملية الشراء: " + err.message);
    }
}