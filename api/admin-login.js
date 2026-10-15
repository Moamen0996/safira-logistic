import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI || process.env.MONGO_URL;

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        const { username, password } = body;

        // الحساب الافتراضي المباشر (يمكنك تعديله هنا مباشرة إذا أردت)
        const ownerUser = "believer"; 
        const ownerPass = "123456"; // استبدلها بكلمة المرور التي تريدها أو اتركها مطابقة لما تكتبه

        if (username && password) {
            // التحقق المباشر من الحساب الافتراضي
            if (username.trim() === ownerUser && password.trim() === ownerPass) {
                return res.status(200).json({
                    success: true,
                    message: 'تم تسجيل الدخول بنجاح',
                    user: { username: ownerUser, role: 'owner', name: 'المدير العام' }
                });
            }

            // التحقق من متغيرات البيئة في Vercel إن وجدت
            const envUser = process.env.ADMIN_USERNAME || process.env.ADMIN_USER;
            const envPass = process.env.ADMIN_PASSWORD || process.env.ADMIN_PASS;
            if (envUser && envPass && username.trim() === envUser.trim() && password.trim() === envPass.trim()) {
                return res.status(200).json({
                    success: true,
                    message: 'تم تسجيل الدخول بنجاح',
                    user: { username: envUser, role: 'owner', name: 'المدير العام' }
                });
            }
        }

        return res.status(401).json({ success: false, message: 'اسم المستخدم أو كلمة المرور غير صحيحة!' });

    } the (error) {
        console.error("Login API Error:", error);
        return res.status(500).json({ success: false, message: 'خطأ داخلي في الخادم' });
    }
}
