// server.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
// ... (الكود السابق في server.js)

const authRoutes = require('./routes/auth');
const categoryRoutes = require('./routes/categories'); // مسار التصنيفات
const productRoutes = require('./routes/products');   // مسار المنتجات

app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes); // تفعيل API التصنيفات
app.use('/api/products', productRoutes);    // تفعيل API المنتجات

// ... (باقي الكود)
// server.js (النسخة المحدثة)
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());

// استدعاء المسارات
const authRoutes = require('./routes/auth');
const categoryRoutes = require('./routes/categories');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders'); // مسار الطلبات
const adminRoutes = require('./routes/admin');   // مسار الإدارة

// تفعيل المسارات
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);

app.get('/', (req, res) => {
  res.send('🚀 Digital Store API is fully operational...');
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});