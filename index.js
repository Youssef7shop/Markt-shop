import { supabase, getCurrentUserSession } from './supabase.js';

let currentUser = null;
let userWallet = null;
let allServices = [];

document.addEventListener('DOMContentLoaded', async () => {
    // 1. التحقق من تسجيل الدخول
    const session = await getCurrentUserSession();
    if (!session) {
        window.location.href = 'login.html';
        return;
    }
    currentUser = session.user;

    // 2. تهيئة الواجهة
    await fetchUserProfileAndWallet();
    await fetchCategories();
    await fetchServices();

    // 3. مستمعات الأحداث (Event Listeners)
    setupEventListeners();
});

// ==========================================
// جلب البيانات (Fetch Data)
// ==========================================

async function fetchUserProfileAndWallet() {
    try {
        // جلب الاسم
        const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', currentUser.id)
            .single();
            
        if (profile) {
            document.getElementById('user-name-display').textContent = `أهلاً، ${profile.full_name}`;
        }

        // جلب المحفظة
        const { data: wallet } = await supabase
            .from('wallets')
            .select('*')
            .eq('user_id', currentUser.id)
            .single();

        if (wallet) {
            userWallet = wallet;
            updateWalletUI(wallet.balance);
        }
    } catch (err) {
        console.error("Error fetching user data:", err);
    }
}

function updateWalletUI(amount) {
    const formatted = parseFloat(amount).toFixed(2);
    document.getElementById('user-balance-display').textContent = formatted;
    document.getElementById('modal-balance-display').textContent = `${formatted}$`;
}

async function fetchCategories() {
    const container = document.getElementById('categories-container');
    const { data: categories } = await supabase.from('categories').select('*');
    
    if (categories) {
        categories.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = 'category-btn';
            btn.dataset.id = cat.id;
            btn.textContent = cat.name;
            container.appendChild(btn);
        });
    }

    // تفعيل أزرار الفلترة
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            renderServices(e.target.dataset.id);
        });
    });
}

async function fetchServices() {
    const { data: services, error } = await supabase.from('services').select('*');
    if (!error && services) {
        allServices = services;
        renderServices('all'); // عرض الكل مبدئياً
    } else {
        document.getElementById('services-container').innerHTML = '<p class="text-muted">حدث خطأ أثناء تحميل الخدمات.</p>';
    }
}

// ==========================================
// العرض والتفاعل (Render & Logic)
// ==========================================

function renderServices(categoryId) {
    const container = document.getElementById('services-container');
    container.innerHTML = '';

    const filtered = categoryId === 'all' 
        ? allServices 
        : allServices.filter(s => s.category_id == categoryId);

    if (filtered.length === 0) {
        container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted);">لا توجد خدمات في هذا التصنيف حالياً.</p>';
        return;
    }

    filtered.forEach(service => {
        const card = document.createElement('div');
        card.className = 'service-card';
        card.innerHTML = `
            <img src="${service.image_url || 'https://via.placeholder.com/300x160?text=AI+Service'}" alt="Service" class="service-img">
            <div class="service-content">
                <h4 class="service-title">${service.title}</h4>
                <p class="service-desc">${service.description}</p>
                <div class="service-footer">
                    <span class="service-price">$${service.price}</span>
                    <button class="btn-buy" data-id="${service.id}" data-price="${service.price}">
                        <i class="fa-solid fa-cart-shopping"></i> شراء
                    </button>
                </div>
            </div>
        `;
        container.appendChild(card);
    });

    // تفعيل أزرار الشراء
    document.querySelectorAll('.btn-buy').forEach(btn => {
        btn.addEventListener('click', handlePurchase);
    });
}

// ==========================================
// عمليات الشراء والمحفظة
// ==========================================

async function handlePurchase(e) {
    const serviceId = e.currentTarget.dataset.id;
    const price = parseFloat(e.currentTarget.dataset.price);

    if (!userWallet || userWallet.balance < price) {
        alert("⚠️ رصيدك غير كافٍ! يرجى شحن المحفظة أولاً.");
        openWalletModal();
        return;
    }

    const confirmBuy = confirm(`هل أنت متأكد من شراء هذه الخدمة مقابل $${price}؟`);
    if (!confirmBuy) return;

    try {
        e.currentTarget.disabled = true;
        e.currentTarget.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري...';

        // 1. خصم الرصيد
        const newBalance = userWallet.balance - price;
        const { error: walletError } = await supabase
            .from('wallets')
            .update({ balance: newBalance })
            .eq('id', userWallet.id);
        
        if (walletError) throw walletError;

        // 2. تسجيل الطلب في قاعدة البيانات
        const { error: orderError } = await supabase
            .from('orders')
            .insert([{
                user_id: currentUser.id,
                service_id: serviceId,
                price: price,
                status: 'pending' // حالة افتراضية حتى يغيرها المشرف
            }]);

        if (orderError) throw orderError;

        // نجاح العملية
        userWallet.balance = newBalance;
        updateWalletUI(newBalance);
        alert("🎉 تم الشراء بنجاح! جاري تحويل طلبك للتنفيذ.");

    } catch (err) {
        alert("❌ حدث خطأ أثناء إتمام عملية الشراء: " + err.message);
    } finally {
        e.currentTarget.disabled = false;
        e.currentTarget.innerHTML = '<i class="fa-solid fa-cart-shopping"></i> شراء';
    }
}

// ==========================================
// أدوات التحكم بالنافذة المنبثقة وتسجيل الخروج
// ==========================================

function setupEventListeners() {
    // فتح وإغلاق المحفظة
    document.getElementById('btn-open-wallet').addEventListener('click', openWalletModal);
    document.getElementById('btn-header-wallet').addEventListener('click', openWalletModal);
    document.getElementById('btn-close-wallet').addEventListener('click', closeWalletModal);

    // شحن الرصيد الوهمي
    document.getElementById('btn-confirm-deposit').addEventListener('click', async () => {
        const amount = parseFloat(document.getElementById('deposit-amount').value);
        if (!amount || amount <= 0) return alert('أدخل مبلغاً صحيحاً.');

        const btn = document.getElementById('btn-confirm-deposit');
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري الشحن...';
        
        try {
            const newBalance = userWallet.balance + amount;
            const { error } = await supabase
                .from('wallets')
                .update({ balance: newBalance })
                .eq('id', userWallet.id);

            if (error) throw error;

            userWallet.balance = newBalance;
            updateWalletUI(newBalance);
            document.getElementById('deposit-amount').value = '';
            alert('✅ تم شحن محفظتك بنجاح!');
            closeWalletModal();
        } catch (err) {
            alert("خطأ في الشحن: " + err.message);
        } finally {
            btn.innerHTML = '<i class="fa-solid fa-bolt"></i> شحن الرصيد الآن';
        }
    });

    // تسجيل الخروج
    document.getElementById('btn-logout').addEventListener('click', async (e) => {
        e.preventDefault();
        await supabase.auth.signOut();
        window.location.href = 'login.html';
    });
}

function openWalletModal() {
    document.getElementById('wallet-modal').classList.add('active');
}

function closeWalletModal() {
    document.getElementById('wallet-modal').classList.remove('active');
}