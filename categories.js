import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    await loadCategoriesWithCounts();
});

async function loadCategoriesWithCounts() {
    const container = document.getElementById('categories-container');
    
    try {
        // جلب الفئات مباشرة من جدول categories في سوبابيز
        const { data: categories, error } = await supabase
            .from('categories')
            .select('*')
            .order('name', { ascending: true });

        if (error) throw error;

        if (!categories || categories.length === 0) {
            container.innerHTML = `<div class="loading-full-page">لا توجد فئات ذكية مضافة حالياً في النظام.</div>`;
            return;
        }

        container.innerHTML = '';
        
        for (const cat of categories) {
            // جلب عدد الخدمات المتوفرة في كل فئة برمجياً (Real-time aggregation check)
            const { count, error: countError } = await supabase
                .from('services')
                .select('*', { count: 'exact', head: true })
                .eq('category_id', cat.id);

            const servicesCount = countError ? 0 : count;

            const card = document.createElement('div');
            card.className = 'category-card';
            // عند الضغط على الفئة يتم توجيهه لصفحة الخدمات مفلترة تلقائياً
            card.onclick = () => window.location.href = `services.html?cat=${cat.id}`;
            
            card.innerHTML = `
                <div class="category-icon-wrapper">
                    <i class="${cat.icon_class || 'fa-solid fa-brain'}"></i>
                </div>
                <h4>${cat.name}</h4>
                <p>${cat.description || 'تصفح أحدث التقنيات والحلول المؤتمتة لهذا القطاع.'}</p>
                <span class="category-counter">${servicesCount} خدمة متاحة</span>
            `;
            container.appendChild(card);
        }

    } catch (err) {
        console.error(err);
        container.innerHTML = `<div class="loading-full-page" style="color:var(--danger)">حدث خطأ أثناء تحميل الفئات: ${err.message}</div>`;
    }
}