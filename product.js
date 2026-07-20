// product.js

document.addEventListener('DOMContentLoaded', () => {
    // استخراج slug من الرابط
    const urlParams = new URLSearchParams(window.location.search);
    const slug = urlParams.get('slug');

    if (slug) {
        fetchProductDetails(slug);
    } else {
        document.getElementById('product-container').innerHTML = '<p>الخدمة غير متوفرة أو الرابط غير صحيح.</p>';
    }

    updateCartCount();
});

let currentProduct = null;

async function fetchProductDetails(slug) {
    const container = document.getElementById('product-container');
    
    try {
        const response = await fetch(`http://localhost:5000/api/products/${slug}`);
        if (!response.ok) throw new Error('المنتج غير موجود');
        
        currentProduct = await response.json();
        renderProduct(currentProduct, container);
    } catch (error) {
        container.innerHTML = `<p style="color: red; text-align: center;">${error.message}</p>`;
    }
}

function renderProduct(product, container) {
    // تجهيز خيارات الباقات (Variants) إذا وجدت
    let variantsOptions = '';
    let initialPrice = product.price;

    if (product.variants && product.variants.length > 0) {
        initialPrice = product.variants[0].price; // السعر الافتراضي لأول باقة
        variantsOptions = product.variants.map((v, index) => 
            `<option value="${v.id}" data-price="${v.price}">${v.variant_name}</option>`
        ).join('');
    } else {
        variantsOptions = `<option value="default" data-price="${product.price}">الباقة الأساسية</option>`;
    }

    container.innerHTML = `
        <div class="product-wrapper">
            <div class="product-image-box">
                <i class="fa-solid fa-box-open"></i>
            </div>
            
            <div class="product-details">
                <h1 class="product-title">${product.name}</h1>
                <p class="product-desc">${product.description || 'لا يوجد وصف متاح لهذه الخدمة حالياً.'}</p>
                
                <div class="price-display" id="display-price">${initialPrice} $</div>

                <div class="form-group">
                    <label>اختر الباقة:</label>
                    <select id="variant-select" class="form-control">
                        ${variantsOptions}
                    </select>
                </div>

                <div class="form-group">
                    <label>الرابط المستهدف (حسابك أو رابط المنشور):</label>
                    <input type="text" id="target-link" class="form-control" placeholder="https://instagram.com/your_username" required>
                </div>

                <button class="add-to-cart-btn" onclick="addToCart()">
                    <i class="fa-solid fa-cart-plus"></i> إضافة إلى السلة
                </button>
            </div>
        </div>
    `;

    // تحديث السعر عند تغيير الباقة
    const variantSelect = document.getElementById('variant-select');
    variantSelect.addEventListener('change', (e) => {
        const selectedOption = e.target.options[e.target.selectedIndex];
        document.getElementById('display-price').innerText = `${selectedOption.dataset.price} $`;
    });
}

function addToCart() {
    if (!currentProduct) return;

    const variantSelect = document.getElementById('variant-select');
    const targetLink = document.getElementById('target-link').value.trim();

    if (!targetLink) {
        alert('الرجاء إدخال الرابط المستهدف لتنفيذ الخدمة.');
        return;
    }

    const selectedOption = variantSelect.options[variantSelect.selectedIndex];
    const item = {
        product_id: currentProduct.id,
        name: currentProduct.name,
        variant_id: variantSelect.value === 'default' ? null : variantSelect.value,
        variant_name: selectedOption.text,
        price: parseFloat(selectedOption.dataset.price),
        target_link: targetLink,
        quantity: 1
    };

    // جلب السلة الحالية من localStorage أو إنشاء واحدة جديدة
    let cart = JSON.parse(localStorage.getItem('darkboost_cart')) || [];
    cart.push(item);
    localStorage.setItem('darkboost_cart', JSON.stringify(cart));

    updateCartCount();
    alert('تمت الإضافة إلى السلة بنجاح!');
}

function updateCartCount() {
    let cart = JSON.parse(localStorage.getItem('darkboost_cart')) || [];
    document.getElementById('cart-count').innerText = cart.length;
}