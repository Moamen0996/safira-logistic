export default function handler(req, res) {
    // السماح بالوصول من أي مصدر Frontend
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // الرد الفوري على طلبات الـ Preflight الخاصة بالمتصفح
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        const { username, password } = body;

        const ADMIN_USER = process.env.ADMIN_USER || 'believer';
        const ADMIN_PASS = process.env.ADMIN_PASSWORD;

        if (!ADMIN_PASS) {
            return res.status(500).json({ success: false, message: 'ADMIN_PASSWORD غير مسجل في متغيرات البيئة' });
        }

        if (username === ADMIN_USER && password === ADMIN_PASS) {
            return res.status(200).json({ success: true, token: 'admin_' + Date.now() });
        } else {
            return res.status(401).json({ success: false, message: 'بيانات الدخول غير صحيحة' });
        }
    } catch (err) {
        console.error("Login Error:", err);
        return res.status(500).json({ success: false, message: 'خطأ في الخادم' });
    }
}
