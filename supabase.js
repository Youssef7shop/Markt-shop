// استيراد مكتبة Supabase باستخدام نظام الموديولات الحديث بدون برامج وسيطة
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// تذكر استبدال هذه القيم بالروابط الخاصة بمشروعك من لوحة تحكم Supabase
const supabaseUrl = 'https://wftcbzufmcjwyzyichml.supabase.co';
const supabaseKey = 'sb_publishable_ApmI13vCQ93xxioPg7fMxA_jXVgTihiw'; // مفتاح عام للعميل (Public Key) لا تستخدم المفتاح السري هنا

// إنشاء وإطلاق العميل الخاص بـ Supabase
export const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * دالة مساعدة وجاهزة للتحقق من جلسة العميل الحالية وحالته الأمنية
 */
export async function getCurrentUserSession() {
    try {
        const { data, error } = await supabase.auth.getSession();
        if (error || !data.session) return null;
        return data.session;
    } catch (err) {
        console.error("خطأ في التحقق من الجلسة:", err);
        return null;
    }
}