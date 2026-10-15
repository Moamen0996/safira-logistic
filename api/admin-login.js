import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI || process.env.MONGO_URL;

export default async function handler(req, res) {
    // إعدادات CORS لضمان استقبال الطلبات من الواجهة الأمامية
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

        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'اسم المستخدم وكلمة المرور مطلوبان' });
        }

        // 1. الفحص من خلال متغيرات البيئة في Vercel (تأمين قراءة كل المسميات المحتملة)
        const envUser = process.env.ADMIN_USERNAME || process.env.ADMIN_USER || process.env.OWNER_USERNAME || process.env.OWNER_USER;
        const envPass = process.env.ADMIN_PASSWORD || process.env.ADMIN_PASS || process.env.OWNER_PASSWORD || process.env.OWNER_PASS;

        if (envUser && envPass) {
            if (username.trim() === envUser.trim() && password.trim() === envPass.trim()) {
                return res.status(200).json({
                    success: true,
                    message: 'تم تسجيل الدخول بنجاح',
                    user: { username: envUser, role: 'owner', name: 'مالك النظام' }
                });
            }
        }

        // 2. الفحص الاحتياطي داخل قاعدة بيانات MongoDB Atlas (في حال وجود الحساب كـ Staff/Admin)
        if (uri) {
            let client;
            try {
                client = new MongoClient(uri);
                await client.connect();
                const db = client.db('safira');
                
                // البحث في كولكشن staff أو users
                const userDoc = await db.collection('staff').findOne({ 
                    $or: [{ username: username }, { email: username }] 
                });

                if (userDoc && userDoc.password === password) {
                    return res.status(200).json({
                        success: true,
                        message: 'تم تسجيل الدخول بنجاح',
                        user: { username: userDoc.username, role: userDoc.role || 'admin', name: userDoc.name || username }
                    });
                }
            } catch (dbErr) {
                console.error("MongoDB Login Check Error:", dbErr);
            } finally {
                if (client) await client.close();
            }
        }

        // إذا لم تطابق البيانات المتغيرات البيئية أو قاعدة البيانات
        return res.status(401).json({ success: false, message: 'اسم المستخدم أو كلمة المرور غير صحيحة!' });

    } catch (error) {
        console.error("Login API Error:", error);
        return res.status(500).json({ success: false, message: 'خطأ داخلي في الخادم' });
    }
}
