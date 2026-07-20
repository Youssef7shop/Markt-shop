-- schema.sql

-- 1. المستخدمون
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    phone VARCHAR(20),
    password_hash VARCHAR(255) NOT NULL,
    wallet_balance DECIMAL(10,2) DEFAULT 0,
    role VARCHAR(20) DEFAULT 'customer', -- customer / admin
    created_at TIMESTAMP DEFAULT NOW()
);

-- 2. التصنيفات
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    slug VARCHAR(150) UNIQUE NOT NULL,
    parent_id INTEGER REFERENCES categories(id),
    image_url TEXT,
    sort_order INTEGER DEFAULT 0
);

-- 3. العلامات/المنصات
CREATE TABLE IF NOT EXISTS brands (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    slug VARCHAR(150) UNIQUE NOT NULL,
    category_id INTEGER REFERENCES categories(id),
    logo_url TEXT
);

-- 4. المنتجات والخدمات
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    category_id INTEGER REFERENCES categories(id),
    brand_id INTEGER REFERENCES brands(id),
    price DECIMAL(10,2) NOT NULL,
    sale_price DECIMAL(10,2),
    stock_type VARCHAR(20) DEFAULT 'unlimited',
    stock_qty INTEGER,
    warranty_text TEXT,
    delivery_time_text VARCHAR(255),
    image_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    is_featured BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 5. خيارات المنتج (الباقات)
CREATE TABLE IF NOT EXISTS product_variants (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    variant_name VARCHAR(150) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    stock_qty INTEGER
);

-- 6. الطلبات
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(50),
    payment_status VARCHAR(20) DEFAULT 'pending',
    order_status VARCHAR(20) DEFAULT 'processing',
    created_at TIMESTAMP DEFAULT NOW()
);

-- 7. عناصر الطلب
CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id),
    variant_id INTEGER REFERENCES product_variants(id),
    target_link TEXT,
    quantity INTEGER DEFAULT 1,
    price DECIMAL(10,2) NOT NULL
);