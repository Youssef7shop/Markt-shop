// استيراد الدوال الأساسية من حزمة Firebase SDK عبر الـ CDN الرسمي والآمن
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";
import { getMessaging } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging.js";

// تهيئة متغيرات البيئة - نقرأها من نافذة التطبيق أو نضع قيم بديلة آمنة للتطوير المحلي
const firebaseConfig = {
  apiKey: window.env?.FIREBASE_API_KEY || "YOUR_API_KEY",
  authDomain: window.env?.FIREBASE_AUTH_DOMAIN || "YOUR_AUTH_DOMAIN",
  projectId: window.env?.FIREBASE_PROJECT_ID || "YOUR_PROJECT_ID",
  storageBucket: window.env?.FIREBASE_STORAGE_BUCKET || "YOUR_STORAGE_BUCKET",
  messagingSenderId: window.env?.FIREBASE_MESSAGING_SENDER_ID || "YOUR_MESSAGING_SENDER_ID",
  appId: window.env?.FIREBASE_APP_ID || "YOUR_APP_ID",
  measurementId: window.env?.FIREBASE_MEASUREMENT_ID || "YOUR_MEASUREMENT_ID"
};

// تهيئة تطبيق Firebase
const app = initializeApp(firebaseConfig);

// تهيئة الخدمات وتصديرها للاستخدام المباشر في باقي ملفات الـ JS
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const analytics = getAnalytics(app);

// تهيئة Cloud Messaging مع معالجة عدم دعم بعض المتصفحات القديمة للإشعارات
let messaging = null;
try {
  messaging = getMessaging(app);
} catch (error) {
  console.warn("Firebase Cloud Messaging is not supported in this browser context.", error);
}
export { messaging };