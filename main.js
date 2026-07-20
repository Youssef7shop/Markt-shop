// main.js

document.addEventListener('DOMContentLoaded', () => {
    fetchCategories();
});

// دالة لجلب التصنيفات من الـ API
async function fetchCategories() {
    const container = document.getElementById('categories-container');
    
    try {
        // الاتصال بالخادم الخاص بك
        const response = await fetch('http://localhost:5000/api/categories');
        
        if (!response.ok) {
            throw new Error('فشل في جلب البيانات');
        }
        
        const categories = await response.json();
        
        // تفريغ الحاوية من رسالة "جاري التحميل"
        container.innerHTML = '';
        
        if (categories.length === 0) {
            container.innerHTML = '<p style="text-align: center; width: 100%;">لا توجد تصنيفات متاحة حالياً.</p>';
            return;
        }

        // إنشاء بطاقات التصنيفات وعرضها
        categories.forEach(category => {
            const card = document.createElement('div');
            card.className = 'category-card';
            
            // استخدام أيقونة افتراضية إذا لم تكن هناك صورة
            card.innerHTML = `
                <div class="category-img">
                    <i class="fa-solid fa-layer-group"></i>
                </div>
                <div class="category-info">
                    <h3>${category.name}</h3>
                    <a href="category.html?slug=${category.slug}" class="view-btn">تصفح الخدمات</a>
                </div>
            `;
            container.appendChild(card);
        });

    } catch (error) {
        console.error('Error fetching categories:', error);
        container.innerHTML = '<p style="text-align: center; width: 100%; color: #ff7675;">حدث خطأ في تحميل الأقسام. يرجى التأكد من تشغيل الخادم.</p>';
    }
}